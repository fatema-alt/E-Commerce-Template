-- Additive migration: historical totals, references and ledger entries are preserved.
CREATE TYPE "PaymentMethodType" AS ENUM ('mobile_banking', 'bank', 'gateway');
CREATE TYPE "PaymentPlan" AS ENUM ('FULL_PAYMENT', 'PARTIAL_ADVANCE', 'COD');
CREATE TYPE "ManualPaymentStatus" AS ENUM ('awaiting_verification', 'confirmed', 'rejected');
CREATE TABLE "payment_settings" (
  "id" TEXT NOT NULL DEFAULT 'default', "fullEnabled" BOOLEAN NOT NULL DEFAULT true,
  "discountType" TEXT NOT NULL DEFAULT 'percentage', "discountValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "maxDiscountCap" DECIMAL(14,2), "partialEnabled" BOOLEAN NOT NULL DEFAULT true,
  "advanceType" TEXT NOT NULL DEFAULT 'delivery_charge_only', "advanceValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "codEnabled" BOOLEAN NOT NULL DEFAULT false, "codMin" DECIMAL(14,2), "codMax" DECIMAL(14,2),
  "allowStacking" BOOLEAN NOT NULL DEFAULT false, "maxTotalDiscountPercent" DECIMAL(5,2),
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "payment_settings_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "payment_methods" (
  "id" TEXT NOT NULL, "type" "PaymentMethodType" NOT NULL, "name" TEXT NOT NULL, "logo" TEXT,
  "details" JSONB NOT NULL, "instruction" TEXT NOT NULL DEFAULT '', "isEnabled" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "deletedAt" TIMESTAMP(3), CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "orders" ADD COLUMN "paymentPlan" "PaymentPlan",
  ADD COLUMN "couponDiscount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "prepaidDiscount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "coupons" ADD COLUMN "combineWithPrepaidDiscount" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "order_payments" (
  "id" TEXT NOT NULL, "orderId" TEXT NOT NULL, "plan" "PaymentPlan" NOT NULL,
  "paymentMethodId" TEXT NOT NULL, "methodSnapshot" JSONB NOT NULL,
  "amountDueNow" DECIMAL(14,2) NOT NULL, "amountDueOnDelivery" DECIMAL(14,2) NOT NULL,
  "senderInfo" TEXT NOT NULL, "reference" TEXT NOT NULL,
  "status" "ManualPaymentStatus" NOT NULL DEFAULT 'awaiting_verification', "rejectReason" TEXT,
  "verifiedBy" TEXT, "verifiedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "order_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "order_payments_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "order_payments_positive_amounts" CHECK ("amountDueNow" > 0 AND "amountDueOnDelivery" >= 0)
);
CREATE INDEX "payment_methods_deletedAt_isEnabled_sortOrder_idx" ON "payment_methods"("deletedAt", "isEnabled", "sortOrder");
CREATE UNIQUE INDEX "order_payments_paymentMethodId_reference_key" ON "order_payments"("paymentMethodId", "reference");
CREATE UNIQUE INDEX "order_payments_reference_key" ON "order_payments"("reference");
CREATE INDEX "order_payments_orderId_createdAt_idx" ON "order_payments"("orderId", "createdAt");
CREATE INDEX "order_payments_status_createdAt_idx" ON "order_payments"("status", "createdAt");
-- Legacy discount attribution cannot safely be inferred for old C/coupon combinations.
-- Preserve discountTotal; attribute to coupon only where there is an actual coupon.
UPDATE "orders" SET "paymentPlan" = CASE
  WHEN "paymentOption" = 'OPTION_A' THEN 'PARTIAL_ADVANCE'::"PaymentPlan"
  WHEN "paymentOption" IN ('OPTION_B','OPTION_C','MANUAL_BKASH','MANUAL_NAGAD','BANK_TRANSFER') THEN 'FULL_PAYMENT'::"PaymentPlan"
  WHEN "paymentMethod" = 'COD' THEN 'COD'::"PaymentPlan"
  WHEN "paymentMethod" IN ('MANUAL','BANK_TRANSFER') THEN 'FULL_PAYMENT'::"PaymentPlan"
  ELSE NULL END,
  "couponDiscount" = CASE WHEN "couponId" IS NOT NULL THEN "discountTotal" ELSE 0 END,
  "prepaidDiscount" = CASE WHEN "couponId" IS NULL AND "paymentOption" = 'OPTION_C' THEN "discountTotal" ELSE 0 END;
-- Plans preserve previous A/B/C availability; COD intentionally starts OFF.
INSERT INTO "payment_settings" ("id", "fullEnabled", "partialEnabled", "discountType", "discountValue", "updatedAt")
SELECT 'default', COALESCE(("config"->>'optionBEnabled')::boolean, true) OR COALESCE(("config"->>'optionCEnabled')::boolean, true),
 COALESCE(("config"->>'optionAEnabled')::boolean, true),
 CASE WHEN COALESCE(("config"->>'optionCDiscountPercent')::numeric,0)>0 THEN 'percentage' ELSE 'fixed' END,
 CASE WHEN COALESCE(("config"->>'optionCDiscountPercent')::numeric,0)>0 THEN ("config"->>'optionCDiscountPercent')::numeric ELSE COALESCE(("config"->>'optionCDiscountFixed')::numeric,0) END,
 CURRENT_TIMESTAMP FROM "payment_gateway_configs" WHERE "provider"='PAYMENT_OPTIONS';
INSERT INTO "payment_settings" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
-- Bring configured accounts across; keep enabled only when required fields are complete.
INSERT INTO "payment_methods" ("id","type","name","details","instruction","isEnabled","sortOrder","updatedAt")
SELECT "id", CASE WHEN "provider"='BANK_TRANSFER' THEN 'bank'::"PaymentMethodType" ELSE 'mobile_banking'::"PaymentMethodType" END,
 CASE "provider" WHEN 'MANUAL_BKASH' THEN 'bKash' WHEN 'MANUAL_NAGAD' THEN 'Nagad' ELSE COALESCE("config"->>'name','Bank Transfer') END,
 CASE WHEN "provider"='BANK_TRANSFER' THEN jsonb_build_object('bankName',COALESCE("config"->>'name',''),'accountName',COALESCE("config"->>'accountName',''),'accountNumber',COALESCE("config"->>'accountNumber',''),'branch',COALESCE("config"->>'branch',''),'routingNumber',COALESCE("config"->>'routingNumber',''))
 ELSE jsonb_build_object('accountNumber',COALESCE("config"->>'accountNumber',''),'accountType',CASE WHEN "config"->>'accountType'='merchant' THEN 'Merchant' WHEN "config"->>'accountType'='agent' THEN 'Agent' ELSE 'Personal' END) END,
 COALESCE("config"->>'instructions',''),
 "isEnabled" AND CASE WHEN "provider"='BANK_TRANSFER' THEN
  COALESCE("config"->>'name','')<>'' AND COALESCE("config"->>'accountName','')<>'' AND COALESCE("config"->>'accountNumber','')<>'' AND COALESCE("config"->>'branch','')<>'' AND COALESCE("config"->>'routingNumber','')<>''
 ELSE COALESCE("config"->>'accountNumber','') ~ '^01[3-9][0-9]{8}$' AND COALESCE("config"->>'accountType','') IN ('personal','merchant','agent') END,
 0, CURRENT_TIMESTAMP
FROM "payment_gateway_configs" WHERE "provider" IN ('MANUAL_BKASH','MANUAL_NAGAD','BANK_TRANSFER');
-- Old gateway configuration is retained for historical callbacks, excluded from new checkout.
CREATE FUNCTION commerce_manual_payment_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Manual payment history cannot be deleted'; END IF;
 IF ROW(NEW."orderId",NEW.plan,NEW."paymentMethodId",NEW."methodSnapshot",NEW."amountDueNow",NEW."amountDueOnDelivery",NEW."senderInfo",NEW.reference)
 IS DISTINCT FROM ROW(OLD."orderId",OLD.plan,OLD."paymentMethodId",OLD."methodSnapshot",OLD."amountDueNow",OLD."amountDueOnDelivery",OLD."senderInfo",OLD.reference)
 THEN RAISE EXCEPTION 'Manual payment snapshot is immutable'; END IF;
 IF OLD.status <> 'awaiting_verification' THEN RAISE EXCEPTION 'Reviewed manual payments are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER manual_payment_snapshot_guard BEFORE UPDATE OR DELETE ON order_payments FOR EACH ROW EXECUTE FUNCTION commerce_manual_payment_guard();
CREATE FUNCTION commerce_payment_plan_snapshot_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW."paymentPlan",NEW."couponDiscount",NEW."prepaidDiscount") IS DISTINCT FROM ROW(OLD."paymentPlan",OLD."couponDiscount",OLD."prepaidDiscount")
 THEN RAISE EXCEPTION 'Order payment pricing snapshot is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER order_payment_pricing_guard BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION commerce_payment_plan_snapshot_guard();
