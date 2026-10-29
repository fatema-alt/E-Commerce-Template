import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../generated/prisma/client.js';
import { ProductsService } from '../products/products.service.js';
import { ProductVariantsService } from '../products/variants/product-variants.service.js';
import { CategoriesService } from '../categories/categories.service.js';
import { VariantStockAdjustmentType } from '../products/variants/dto/adjust-variant-stock.dto.js';
import { CatalogQueryDto } from './catalog-query.dto.js';
import { StorefrontQueryDto } from './storefront-query.dto.js';
import { StorefrontController } from './storefront.controller.js';
import { AuthService } from '../auth/auth.service.js';

describe.skipIf(!process.env.CATALOG_TEST_DATABASE_URL)(
  'Catalog with isolated PostgreSQL',
  () => {
    let db: PrismaClient;
    let products: ProductsService;
    let categories: CategoriesService;
    let variants: ProductVariantsService;
    let categoryId: string;
    const suffix = randomUUID().slice(0, 8);
    const product = (name: string, extra: object = {}) => ({
      name,
      slug: name.toLowerCase() + '-' + suffix,
      sku: name + '-' + suffix,
      categoryId,
      price: '19.99',
      stock: 0,
      ...extra,
    });
    beforeAll(async () => {
      const url = new URL(process.env.CATALOG_TEST_DATABASE_URL!);
      if (!url.pathname.startsWith('/commerce_catalog_validation_'))
        throw new Error(
          'Integration tests require an isolated commerce_catalog_validation_ database',
        );
      db = new PrismaClient({ datasourceUrl: url.toString() });
      await db.$connect();
      products = new ProductsService(db as never);
      categories = new CategoriesService(db as never);
      variants = new ProductVariantsService(db as never);
      categoryId = (await categories.create({
        name: 'Test category',
        slug: 'test-' + suffix,
      }))!.id;
    });
    afterAll(async () => {
      await db?.$disconnect();
    });

    it('shares login rate limits across service instances', async () => {
      const a = new AuthService(db as never),
        b = new AuthService(db as never);
      const address = 'isolated-test-' + suffix;
      for (let index = 0; index < 10; index++)
        await expect(
          (index % 2 ? a : b).login(
            'missing-' + suffix + '@test.invalid',
            'invalid-test-password',
            address,
          ),
        ).rejects.toThrow('Invalid credentials');
      await expect(
        a.login('missing@test.invalid', 'invalid-test-password', address),
      ).rejects.toThrow('Too many login attempts');
    }, 15000);

    it('paginates and searches without changing the legacy array contract', async () => {
      await products.create(product('PaginationA'));
      await products.create(product('PaginationB'));
      const result = await products.findAll(
        Object.assign(new CatalogQueryDto(), {
          paginated: true,
          search: suffix,
          pageSize: 1,
        }),
      );
      expect(Array.isArray(result)).toBe(false);
      if (Array.isArray(result)) throw new Error('Expected paginated response');
      expect(result.items).toHaveLength(1);
      expect(result.total).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(await products.findAll())).toBe(true);
    });

    it('validates decimal prices and merged updates', async () => {
      await expect(
        products.create(product('BadPrice', { salePrice: '20.00' })),
      ).rejects.toThrow('Sale price');
      const row = (await products.create(
        product('Price', { salePrice: '9.99' }),
      ))!;
      await expect(products.update(row.id, { price: '8.99' })).rejects.toThrow(
        'Sale price',
      );
      const updated = (await products.update(row.id, {
        price: '10.01',
        salePrice: '10.00',
      }))!;
      expect(updated.price.toString()).toBe('10.01');
      await expect(
        products.update(row.id, {
          name: 'Stale change',
          expectedUpdatedAt: row.updatedAt.toISOString(),
        }),
      ).rejects.toThrow('changed since');
    });

    it('maintains global SKU uniqueness across concurrent product and variant inserts', async () => {
      const parent = (await products.create(
        product('RaceParent', { type: 'VARIABLE' }),
      ))!;
      const sku = 'race-' + suffix;
      const results = await Promise.allSettled([
        products.create(product('RaceProduct', { sku })),
        variants.create(parent.id, {
          name: 'Racing variant',
          sku: sku.toUpperCase(),
          attributes: { Size: 'One' },
          price: '2.00',
          stock: 0,
        }),
      ]);
      expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(
        1,
      );
    });

    it('prevents opposite concurrent category moves from forming a cycle', async () => {
      const a = (await categories.create({
        name: 'Branch A',
        slug: 'branch-a-' + suffix,
      }))!;
      const b = (await categories.create({
        name: 'Branch B',
        slug: 'branch-b-' + suffix,
      }))!;
      const results = await Promise.allSettled([
        categories.update(a.id, { parentId: b.id }),
        categories.update(b.id, { parentId: a.id }),
      ]);
      expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(
        1,
      );
    });

    it('generates bounded combinations and skips existing combinations on retry', async () => {
      const parent = (await products.create(
        product('Generated', {
          type: 'VARIABLE',
          options: [
            { name: 'Size', values: ['M', 'L'] },
            { name: 'Color', values: ['Black', 'White'] },
          ],
        }),
      ))!;
      const generated = await variants.generate(parent.id, {
        skuPrefix: 'generated-' + suffix,
      });
      expect(generated.results.filter((row) => row.success)).toHaveLength(4);
      const repeated = await variants.generate(parent.id, {
        skuPrefix: 'generated-' + suffix,
      });
      expect(repeated.results.every((row) => row.skipped)).toBe(true);
      expect(
        await db.productVariant.count({ where: { productId: parent.id } }),
      ).toBe(4);
      expect(
        await db.productVariant.count({
          where: { productId: parent.id, isDefault: true },
        }),
      ).toBe(1);
    });

    it('evaluates scheduled sale dates at public read time', async () => {
      const row = (await products.create(
        product('SaleSchedule', {
          status: 'ACTIVE',
          price: '10.00',
          salePrice: '8.99',
          saleStartsAt: new Date(Date.now() + 86400000).toISOString(),
        }),
      ))!;
      const publicCatalog = new StorefrontController(db as never);
      const response = { redirect: vi.fn() };
      const future = await publicCatalog.product(row.slug, response as never);
      expect(future?.effectivePrice?.toString()).toBe('10');
      await products.update(row.id, {
        saleStartsAt: new Date(Date.now() - 86400000).toISOString(),
      });
      const current = await publicCatalog.product(row.slug, response as never);
      expect(current?.effectivePrice?.toString()).toBe('8.99');
    });

    it('prevents self-parenting, descendant moves and deleting assigned categories', async () => {
      const child = (await categories.create({
        name: 'Child category',
        slug: 'child-' + suffix,
        parentId: categoryId,
      }))!;
      await expect(
        categories.update(categoryId, { parentId: child.id }),
      ).rejects.toThrow('descendant');
      await expect(
        categories.update(categoryId, { parentId: categoryId }),
      ).rejects.toThrow('descendant');
      await expect(categories.remove(categoryId)).rejects.toThrow('Reassign');
    });

    it('rejects mismatched variant edits and adjustments without adding movements', async () => {
      const parent = (await products.create(
        product('Variable', { type: 'VARIABLE' }),
      ))!;
      const other = (await products.create(
        product('Other', { type: 'VARIABLE' }),
      ))!;
      const variant = (await variants.create(parent.id, {
        name: 'Black M',
        sku: 'variant-' + suffix,
        attributes: { Color: 'Black', Size: 'M' },
        price: '19.99',
        stock: 2,
      }))!;
      await expect(
        variants.update(other.id, variant.id, { name: 'Hijacked' }),
      ).rejects.toThrow('belong');
      const before = await db.inventoryMovement.count({
        where: { variantId: variant.id },
      });
      await expect(
        variants.adjustStock(other.id, variant.id, {
          type: VariantStockAdjustmentType.IN,
          quantity: 1,
        }),
      ).rejects.toThrow('belong');
      expect(
        await db.inventoryMovement.count({ where: { variantId: variant.id } }),
      ).toBe(before);
      await expect(
        variants.create(parent.id, {
          name: 'Duplicate',
          sku: 'duplicate-' + suffix,
          attributes: { size: 'm', color: 'black' },
          price: '19.99',
          stock: 0,
        }),
      ).rejects.toThrow('already exists');
      await expect(
        products.create(product('CrossSku', { sku: 'VARIANT-' + suffix })),
      ).rejects.toThrow('already exists');
    });

    it('serializes adjustments and never oversells reserved stock', async () => {
      const parent = (await products.create(
        product('StockParent', { type: 'VARIABLE' }),
      ))!;
      const row = (await variants.create(parent.id, {
        name: 'Only size',
        sku: 'stock-' + suffix,
        attributes: { size: 'M' },
        price: '1.00',
        stock: 2,
      }))!;
      await db.inventory.update({
        where: { variantId: row.id },
        data: { reserved: 1 },
      });
      const attempts = await Promise.allSettled(
        [1, 2].map(() =>
          variants.adjustStock(parent.id, row.id, {
            type: VariantStockAdjustmentType.OUT,
            quantity: 1,
          }),
        ),
      );
      expect(
        attempts.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      const inventory = await db.inventory.findUniqueOrThrow({
        where: { variantId: row.id },
      });
      expect(inventory.quantity).toBe(1);
      expect(inventory.reserved).toBe(1);
    });

    it('keeps stock history on product deletion and reports partial bulk failures', async () => {
      const row = (await products.create(product('DeleteMe')))!;
      const before = await db.inventoryMovement.count({
        where: { productId: row.id },
      });
      const result = await products.bulk({
        ids: [row.id, randomUUID()],
        action: 'ARCHIVE',
      });
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
      await products.remove(row.id);
      expect(
        await db.inventoryMovement.count({ where: { productId: row.id } }),
      ).toBe(before);
      expect(
        await db.catalogAuditLog.count({ where: { entityId: row.id } }),
      ).toBeGreaterThanOrEqual(3);
    });

    it('keeps draft, hidden and archived products out of public results and resolves historical slugs', async () => {
      const publicCatalog = new StorefrontController(db as never);
      const active = (await products.create(
        product('Public', { status: 'ACTIVE' }),
      ))!;
      await products.create(
        product('Hidden', { status: 'ACTIVE', isVisible: false }),
      );
      await products.create(product('Draft'));
      const result = await publicCatalog.products(
        Object.assign(new CatalogQueryDto(), { search: suffix, pageSize: 100 }),
      );
      expect(result.items.some((row) => row.id === active.id)).toBe(true);
      expect(
        result.items.every((row) => !['Hidden', 'Draft'].includes(row.name)),
      ).toBe(true);
      expect(result.items[0]).not.toHaveProperty('costPrice');
      expect(result.items[0]).not.toHaveProperty('internalNotes');
      await products.update(active.id, { slug: 'renamed-' + suffix });
      const response = { redirect: vi.fn() };
      await publicCatalog.product(active.slug, response as never);
      expect(response.redirect).toHaveBeenCalledWith(
        301,
        '/api/v1/storefront/products/renamed-' + suffix,
      );
      await products.update(active.id, { slug: active.slug });
      expect(
        await db.catalogRedirect.findUnique({
          where: {
            entity_fromSlug: { entity: 'product', fromSlug: active.slug },
          },
        }),
      ).toBeNull();
    });

    it('accurately counts active visible products across parent and child categories, excluding soft-deleted, inactive, and hidden products', async () => {
      const publicCatalog = new StorefrontController(db as never);
      const testSuffix = randomUUID().slice(0, 8);

      // 1. Create parent and child categories
      const parentCat = (await categories.create({
        name: 'Parent Category ' + testSuffix,
        slug: 'parent-' + testSuffix,
      }))!;
      const childCat = (await categories.create({
        name: 'Child Category ' + testSuffix,
        slug: 'child-' + testSuffix,
        parentId: parentCat.id,
      }))!;

      // 2. In child category: create 1 active visible product
      await products.create({
        name: 'Active Child Product ' + testSuffix,
        slug: 'active-child-' + testSuffix,
        sku: 'ACT-C-' + testSuffix,
        categoryId: childCat.id,
        price: '49.99',
        stock: 5,
        status: 'ACTIVE',
        isActive: true,
        isVisible: true,
      });

      // 3. In child category: create 1 soft-deleted product
      const softDeleted = await products.create({
        name: 'Soft Deleted Product ' + testSuffix,
        slug: 'deleted-child-' + testSuffix,
        sku: 'DEL-C-' + testSuffix,
        categoryId: childCat.id,
        price: '29.99',
        stock: 5,
        status: 'ACTIVE',
        isActive: true,
        isVisible: true,
      });
      await db.product.update({
        where: { id: softDeleted!.id },
        data: { deletedAt: new Date() },
      });

      // 4. In parent category: create 1 inactive product
      await products.create({
        name: 'Inactive Parent Product ' + testSuffix,
        slug: 'inactive-parent-' + testSuffix,
        sku: 'INACT-P-' + testSuffix,
        categoryId: parentCat.id,
        price: '19.99',
        stock: 5,
        status: 'DRAFT',
        isActive: false,
        isVisible: true,
      });

      // 5. In parent category: create 1 hidden product
      await products.create({
        name: 'Hidden Parent Product ' + testSuffix,
        slug: 'hidden-parent-' + testSuffix,
        sku: 'HIDDEN-P-' + testSuffix,
        categoryId: parentCat.id,
        price: '39.99',
        stock: 5,
        status: 'ACTIVE',
        isActive: true,
        isVisible: false,
      });

      // 6. Query categories with includeCounts = true
      const query = new StorefrontQueryDto();
      query.includeCounts = true;
      query.ids = parentCat.id;

      const result = (await publicCatalog.categories(query)) as Array<{
        id: string;
        name: string;
        productCount?: number;
      }>;

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(parentCat.id);
      // Parent must count ONLY the 1 active visible product in its descendant tree
      expect(result[0].productCount).toBe(1);
    });
  },
);
