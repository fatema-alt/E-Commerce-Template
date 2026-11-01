-- Earlier payment/coupon models were introduced without a deployable migration.
-- Preserve databases previously initialized with db push as well as migration-only databases.
DO $$ BEGIN
  CREATE TYPE "CouponType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "coupons" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "type" "CouponType" NOT NULL DEFAULT 'PERCENTAGE',
  "value" DECIMAL(12,2) NOT NULL,
  "minOrderAmount" DECIMAL(12,2),
  "maxDiscountAmount" DECIMAL(12,2),
  "usageLimit" INTEGER,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "perCustomerLimit" INTEGER NOT NULL DEFAULT 1,
  "startsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "coupons_code_key" ON "coupons"("code");
CREATE INDEX IF NOT EXISTS "coupons_code_isActive_idx" ON "coupons"("code", "isActive");

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "couponId" TEXT,
  ADD COLUMN IF NOT EXISTS "couponCode" TEXT;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='orders_couponId_fkey' AND conrelid='orders'::regclass) THEN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
 END IF;
END $$;

CREATE TABLE IF NOT EXISTS "coupon_usages" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "couponId" TEXT NOT NULL REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "orderId" TEXT NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "customerId" TEXT,
  "customerPhone" TEXT,
  "customerEmail" TEXT,
  "discountAmount" DECIMAL(12,2) NOT NULL,
  "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "coupon_usages_couponId_customerId_idx" ON "coupon_usages"("couponId", "customerId");
CREATE INDEX IF NOT EXISTS "coupon_usages_couponId_customerPhone_idx" ON "coupon_usages"("couponId", "customerPhone");
CREATE INDEX IF NOT EXISTS "coupon_usages_orderId_idx" ON "coupon_usages"("orderId");

CREATE TABLE IF NOT EXISTS "payment_gateway_configs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT false,
  "isSandbox" BOOLEAN NOT NULL DEFAULT true,
  "config" JSONB NOT NULL DEFAULT '{}',
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "payment_gateway_configs_provider_key" ON "payment_gateway_configs"("provider");
