-- CreateEnum
CREATE TYPE "CmsDocumentKind" AS ENUM ('SITE_SETTINGS', 'THEME', 'PAGE', 'NAVIGATION');

-- CreateEnum
CREATE TYPE "CmsDocumentState" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "cms_documents" (
    "id" TEXT NOT NULL,
    "kind" "CmsDocumentKind" NOT NULL,
    "key" TEXT NOT NULL,
    "state" "CmsDocumentState" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "publishedVersionId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_versions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cms_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_audit_events" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "versionId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cms_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_media_assets" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "altText" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cms_media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cms_documents_kind_state_idx" ON "cms_documents"("kind", "state");

-- CreateIndex
CREATE UNIQUE INDEX "cms_documents_kind_key_key" ON "cms_documents"("kind", "key");

-- CreateIndex
CREATE INDEX "cms_versions_documentId_createdAt_idx" ON "cms_versions"("documentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "cms_versions_documentId_version_key" ON "cms_versions"("documentId", "version");

-- CreateIndex
CREATE INDEX "cms_audit_events_documentId_createdAt_idx" ON "cms_audit_events"("documentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "cms_media_assets_storageKey_key" ON "cms_media_assets"("storageKey");

-- CreateIndex
CREATE INDEX "cms_media_assets_createdAt_idx" ON "cms_media_assets"("createdAt");

-- AddForeignKey
ALTER TABLE "cms_documents" ADD CONSTRAINT "cms_documents_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "cms_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_versions" ADD CONSTRAINT "cms_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "cms_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_audit_events" ADD CONSTRAINT "cms_audit_events_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "cms_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
