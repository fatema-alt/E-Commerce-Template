-- CreateTable
CREATE TABLE "dashboard_layouts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "layout" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dashboard_layouts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_layouts_userId_key" ON "dashboard_layouts"("userId");

-- CreateIndex
CREATE INDEX "orders_createdAt_status_idx" ON "orders"("createdAt", "status");

-- CreateIndex
CREATE INDEX "analytics_events_sessionId_kind_createdAt_idx" ON "analytics_events"("sessionId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "order_addresses_district_idx" ON "order_addresses"("district");
