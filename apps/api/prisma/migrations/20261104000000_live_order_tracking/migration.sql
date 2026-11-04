ALTER TABLE "order_shipments"
  ADD COLUMN "courierStatus" TEXT,
  ADD COLUMN "courierUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "trackingCheckedAt" TIMESTAMP(3),
  ADD COLUMN "trackingError" TEXT;

CREATE TABLE "courier_configs" (
  "provider" TEXT NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT false,
  "isSandbox" BOOLEAN NOT NULL DEFAULT true,
  "credentials" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedBy" TEXT,
  CONSTRAINT "courier_configs_pkey" PRIMARY KEY ("provider")
);
