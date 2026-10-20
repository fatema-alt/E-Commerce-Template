-- Additive migration: no rows or columns are removed. Existing return events
-- remain historical; no legacy goods are automatically restocked or refunded.
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'RETURN_APPROVED';

ALTER TABLE "order_shipments"
  ADD COLUMN "parcelDetails" VARCHAR(500),
  ADD COLUMN "codCollected" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "codSettled" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "codFees" DECIMAL(14,2) NOT NULL DEFAULT 0;

CREATE TABLE "order_returns" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orderId" TEXT NOT NULL REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "reason" VARCHAR(500) NOT NULL,
  "adminNote" VARCHAR(500),
  "createdByAdminId" TEXT NOT NULL,
  "resolvedByAdminId" TEXT,
  "receivedByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  CONSTRAINT "order_returns_status_check" CHECK ("status" IN ('REQUESTED','APPROVED','REJECTED','RECEIVED'))
);
CREATE INDEX "order_returns_orderId_createdAt_idx" ON "order_returns"("orderId", "createdAt");

CREATE TABLE "order_return_items" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "returnId" TEXT NOT NULL REFERENCES "order_returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "orderItemId" TEXT NOT NULL REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "quantity" INTEGER NOT NULL,
  "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
  "sellableQuantity" INTEGER NOT NULL DEFAULT 0,
  "restockedQuantity" INTEGER NOT NULL DEFAULT 0,
  "refundableAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  CONSTRAINT "return_quantities_check" CHECK ("quantity" > 0 AND "receivedQuantity" BETWEEN 0 AND "quantity" AND "sellableQuantity" BETWEEN 0 AND "receivedQuantity" AND "restockedQuantity" BETWEEN 0 AND "sellableQuantity" AND "refundableAmount" >= 0)
);
CREATE UNIQUE INDEX "order_return_items_returnId_orderItemId_key" ON "order_return_items"("returnId", "orderItemId");

-- NOT VALID avoids a blocking scan at installation while enforcing all new
-- writes. Validate historical rows separately after reviewing existing data.
ALTER TABLE "orders" ADD CONSTRAINT "orders_balance_check"
  CHECK ("grandTotal" >= 0 AND "paidTotal" BETWEEN 0 AND "grandTotal" AND "refundedTotal" BETWEEN 0 AND "paidTotal" AND "version" >= 0) NOT VALID;
ALTER TABLE "inventories" ADD CONSTRAINT "orders_inventory_balance_check"
  CHECK ("quantity" >= 0 AND "reserved" BETWEEN 0 AND "quantity") NOT VALID;
ALTER TABLE "order_shipments" ADD CONSTRAINT "shipment_cod_balance_check"
  CHECK ("codCollected" >= 0 AND "codSettled" >= 0 AND "codFees" >= 0 AND "codSettled" + "codFees" <= "codCollected" AND ("shippingCost" IS NULL OR "shippingCost" >= 0)) NOT VALID;
