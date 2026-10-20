BEGIN;
-- Additive migration: abort rather than rewrite conflicting legacy catalog data.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM products p JOIN product_variants v ON lower(btrim(p.sku)) = lower(btrim(v.sku)))
    OR EXISTS (SELECT 1 FROM products GROUP BY lower(btrim(sku)) HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM product_variants GROUP BY lower(btrim(sku)) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Catalog migration blocked: duplicate global SKUs require manual reconciliation';
  END IF;
END $$;
-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "canonicalUrl" TEXT,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "noIndex" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "product_images" ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "combinationKey" TEXT,
ADD COLUMN     "costPrice" DECIMAL(12,2),
ADD COLUMN     "height" DECIMAL(12,3),
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "length" DECIMAL(12,3),
ADD COLUMN     "weight" DECIMAL(12,3),
ADD COLUMN     "width" DECIMAL(12,3);

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "backorderPolicy" TEXT NOT NULL DEFAULT 'DENY',
ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "canonicalUrl" TEXT,
ADD COLUMN     "collections" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "compareAtPrice" DECIMAL(12,2),
ADD COLUMN     "costPrice" DECIMAL(12,2),
ADD COLUMN     "countryOfOrigin" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'BDT',
ADD COLUMN     "dimensionUnit" TEXT NOT NULL DEFAULT 'cm',
ADD COLUMN     "freeShipping" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "height" DECIMAL(12,3),
ADD COLUMN     "hsCode" TEXT,
ADD COLUMN     "internalNotes" TEXT,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "length" DECIMAL(12,3),
ADD COLUMN     "manufacturer" TEXT,
ADD COLUMN     "noIndex" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "options" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "requiresShipping" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "saleEndsAt" TIMESTAMP(3),
ADD COLUMN     "saleStartsAt" TIMESTAMP(3),
ADD COLUMN     "shippingClass" TEXT,
ADD COLUMN     "socialDescription" TEXT,
ADD COLUMN     "socialImage" TEXT,
ADD COLUMN     "socialTitle" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "taxClass" TEXT NOT NULL DEFAULT 'standard',
ADD COLUMN     "taxInclusive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trackInventory" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "weight" DECIMAL(12,3),
ADD COLUMN     "weightUnit" TEXT NOT NULL DEFAULT 'kg',
ADD COLUMN     "width" DECIMAL(12,3);

-- CreateTable
CREATE TABLE "catalog_audit_logs" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_redirects" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fromSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_redirects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "catalog_audit_logs_entity_entityId_createdAt_idx" ON "catalog_audit_logs"("entity", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "catalog_redirects_entityId_idx" ON "catalog_redirects"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_redirects_entity_fromSlug_key" ON "catalog_redirects"("entity", "fromSlug");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_productId_combinationKey_key" ON "product_variants"("productId", "combinationKey");

-- CreateIndex
CREATE INDEX "products_brand_idx" ON "products"("brand");

-- CreateIndex
CREATE INDEX "products_updatedAt_id_idx" ON "products"("updatedAt", "id");

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE products ADD CONSTRAINT products_price_check CHECK (price >= 0 AND ("salePrice" IS NULL OR ("salePrice" >= 0 AND "salePrice" <= price)) AND ("costPrice" IS NULL OR "costPrice" >= 0) AND ("compareAtPrice" IS NULL OR "compareAtPrice" >= price));
ALTER TABLE products ADD CONSTRAINT products_sale_dates_check CHECK ("saleStartsAt" IS NULL OR "saleEndsAt" IS NULL OR "saleStartsAt" < "saleEndsAt");
ALTER TABLE product_variants ADD CONSTRAINT variants_price_check CHECK (price >= 0 AND ("salePrice" IS NULL OR ("salePrice" >= 0 AND "salePrice" <= price)) AND ("costPrice" IS NULL OR "costPrice" >= 0));
ALTER TABLE categories ADD CONSTRAINT categories_parent_check CHECK ("parentId" IS NULL OR "parentId" <> id);
CREATE UNIQUE INDEX products_normalized_sku_key ON products (lower(btrim(sku)));
CREATE UNIQUE INDEX variants_normalized_sku_key ON product_variants (lower(btrim(sku)));
CREATE UNIQUE INDEX variants_default_key ON product_variants ("productId") WHERE "isDefault";
CREATE UNIQUE INDEX images_primary_key ON product_images ("productId") WHERE "isPrimary";

CREATE TABLE catalog_skus (sku TEXT PRIMARY KEY, entity TEXT NOT NULL, "entityId" TEXT NOT NULL);
CREATE UNIQUE INDEX "catalog_skus_entity_entityId_key" ON catalog_skus(entity, "entityId");
INSERT INTO catalog_skus SELECT lower(btrim(sku)), 'products', id FROM products;
INSERT INTO catalog_skus SELECT lower(btrim(sku)), 'product_variants', id FROM product_variants;

CREATE FUNCTION catalog_global_sku_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- The shared unique index remains correct across concurrent transactions,
  -- including inserts into different owner tables.
  DELETE FROM catalog_skus WHERE entity = TG_TABLE_NAME AND "entityId" = NEW.id;
  INSERT INTO catalog_skus VALUES (lower(btrim(NEW.sku)), TG_TABLE_NAME, NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER products_global_sku BEFORE INSERT OR UPDATE OF sku ON products FOR EACH ROW EXECUTE FUNCTION catalog_global_sku_guard();
CREATE TRIGGER variants_global_sku BEFORE INSERT OR UPDATE OF sku ON product_variants FOR EACH ROW EXECUTE FUNCTION catalog_global_sku_guard();

CREATE FUNCTION catalog_variant_combination_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF jsonb_typeof(NEW.attributes) <> 'object' OR NEW.attributes = '{}'::jsonb THEN
    RAISE EXCEPTION 'Variant attributes require at least one option' USING ERRCODE = '23514';
  END IF;
  SELECT jsonb_object_agg(lower(btrim(key)), lower(btrim(value)))::text INTO NEW."combinationKey" FROM jsonb_each_text(NEW.attributes);
  RETURN NEW;
END $$;
-- Existing duplicate combinations fail the unique index; no variants or stock are deleted.
UPDATE product_variants SET "combinationKey" = (SELECT jsonb_object_agg(lower(btrim(key)), lower(btrim(value)))::text FROM jsonb_each_text(attributes)) WHERE attributes <> '{}'::jsonb;
CREATE TRIGGER variants_combination BEFORE INSERT OR UPDATE OF attributes ON product_variants FOR EACH ROW EXECUTE FUNCTION catalog_variant_combination_guard();

CREATE FUNCTION catalog_category_tree_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE bad boolean; too_deep boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(71421001);
  WITH RECURSIVE ancestors AS (
    SELECT c.id, c."parentId", ARRAY[c.id] AS path, false AS cycle FROM categories c WHERE c.id = NEW."parentId"
    UNION ALL SELECT c.id, c."parentId", a.path || c.id, c.id = ANY(a.path) FROM categories c JOIN ancestors a ON c.id = a."parentId" WHERE NOT a.cycle
  ) SELECT COALESCE(bool_or(id = NEW.id OR cycle), false), COALESCE(max(array_length(path, 1)) >= 8, false) INTO bad, too_deep FROM ancestors;
  IF bad OR too_deep THEN RAISE EXCEPTION 'Invalid category hierarchy' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER categories_tree BEFORE INSERT OR UPDATE OF "parentId" ON categories FOR EACH ROW EXECUTE FUNCTION catalog_category_tree_guard();

CREATE FUNCTION catalog_media_owner_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."variantId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_variants WHERE id = NEW."variantId" AND "productId" = NEW."productId") THEN
    RAISE EXCEPTION 'Image variant belongs to a different product' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER images_variant_owner BEFORE INSERT OR UPDATE OF "variantId", "productId" ON product_images FOR EACH ROW EXECUTE FUNCTION catalog_media_owner_guard();

CREATE FUNCTION catalog_movement_owner_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."variantId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_variants WHERE id = NEW."variantId" AND "productId" = NEW."productId") THEN
    RAISE EXCEPTION 'Movement variant belongs to a different product' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER movements_variant_owner BEFORE INSERT OR UPDATE OF "variantId", "productId" ON inventory_movements FOR EACH ROW EXECUTE FUNCTION catalog_movement_owner_guard();
COMMIT;
