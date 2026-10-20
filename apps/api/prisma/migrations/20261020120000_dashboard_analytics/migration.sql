CREATE TABLE "analytics_sessions" (
  "id" UUID NOT NULL PRIMARY KEY,
  "source" VARCHAR(20) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "analytics_events" (
  "id" UUID NOT NULL PRIMARY KEY,
  "sessionId" UUID NOT NULL REFERENCES "analytics_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "kind" VARCHAR(20) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "analytics_sessions_createdAt_source_idx" ON "analytics_sessions"("createdAt", "source");
CREATE INDEX "analytics_events_createdAt_kind_sessionId_idx" ON "analytics_events"("createdAt", "kind", "sessionId");
CREATE INDEX "analytics_events_sessionId_createdAt_idx" ON "analytics_events"("sessionId", "createdAt");
CREATE TABLE "dashboard_targets" (
  "month" VARCHAR(7) NOT NULL PRIMARY KEY,
  "amount" DECIMAL(14,2) NOT NULL CHECK ("amount" >= 0),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
