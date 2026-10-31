-- Add paymentOption column to orders to track selected payment model (e.g. OPTION_A, OPTION_B, OPTION_C, BANK_TRANSFER, COD)
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paymentOption" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "couponId" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "couponCode" TEXT;
ALTER TYPE "OrderPaymentMethod" ADD VALUE IF NOT EXISTS 'BKASH';
ALTER TYPE "OrderPaymentMethod" ADD VALUE IF NOT EXISTS 'NAGAD';
ALTER TYPE "OrderPaymentMethod" ADD VALUE IF NOT EXISTS 'SSLCOMMERZ';
