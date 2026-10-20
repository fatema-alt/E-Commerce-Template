BEGIN;
-- Refuse ambiguous legacy state; never reset, discard or guess publication data.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM cms_documents WHERE "scheduledAt" IS NOT NULL) THEN
  RAISE EXCEPTION 'Resolve legacy CMS schedules explicitly before applying publishing guards';
 END IF;
 IF EXISTS (SELECT 1 FROM cms_documents d JOIN cms_versions v ON v.id = d."publishedVersionId" WHERE v."documentId" <> d.id) THEN
  RAISE EXCEPTION 'CMS publication points to another document';
 END IF;
END $$;
-- DropForeignKey
ALTER TABLE "cms_documents" DROP CONSTRAINT "cms_documents_publishedVersionId_fkey";

-- AlterTable
ALTER TABLE "cms_documents" ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "scheduledBy" TEXT,
ADD COLUMN     "scheduledVersionId" TEXT;

-- AlterTable
ALTER TABLE "cms_media_assets" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "thumbnailUrl" TEXT,
ADD COLUMN     "url" TEXT;

-- CreateTable
CREATE TABLE "cms_asset_references" (
    "versionId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,

    CONSTRAINT "cms_asset_references_pkey" PRIMARY KEY ("versionId","assetId")
);

-- CreateTable
CREATE TABLE "cms_publication_events" (
    "sequence" BIGSERIAL NOT NULL,
    "documentId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "versionId" TEXT,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cms_publication_events_pkey" PRIMARY KEY ("sequence")
);

-- CreateIndex
CREATE INDEX "cms_asset_references_assetId_idx" ON "cms_asset_references"("assetId");

-- CreateIndex
CREATE INDEX "cms_publication_events_documentId_createdAt_idx" ON "cms_publication_events"("documentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "cms_publication_events_documentId_revision_key" ON "cms_publication_events"("documentId", "revision");

-- CreateIndex
CREATE INDEX "cms_documents_scheduledAt_idx" ON "cms_documents"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "cms_versions_id_documentId_key" ON "cms_versions"("id", "documentId");

-- AddForeignKey
ALTER TABLE "cms_documents" ADD CONSTRAINT "cms_documents_publishedVersionId_id_fkey" FOREIGN KEY ("publishedVersionId", "id") REFERENCES "cms_versions"("id", "documentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_documents" ADD CONSTRAINT "cms_documents_scheduledVersionId_id_fkey" FOREIGN KEY ("scheduledVersionId", "id") REFERENCES "cms_versions"("id", "documentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_asset_references" ADD CONSTRAINT "cms_asset_references_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "cms_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_asset_references" ADD CONSTRAINT "cms_asset_references_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "cms_media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_publication_events" ADD CONSTRAINT "cms_publication_events_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "cms_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_publication_events" ADD CONSTRAINT "cms_publication_events_versionId_documentId_fkey" FOREIGN KEY ("versionId", "documentId") REFERENCES "cms_versions"("id", "documentId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE cms_documents ADD CONSTRAINT cms_revision_nonnegative CHECK (revision >= 0);
ALTER TABLE cms_versions ADD CONSTRAINT cms_version_positive CHECK (version > 0);
ALTER TABLE cms_documents ADD CONSTRAINT cms_publication_state CHECK ((state = 'PUBLISHED' AND "publishedVersionId" IS NOT NULL) OR (state <> 'PUBLISHED' AND "publishedVersionId" IS NULL));
ALTER TABLE cms_documents ADD CONSTRAINT cms_schedule_complete CHECK (("scheduledAt" IS NULL AND "scheduledVersionId" IS NULL AND "scheduledBy" IS NULL) OR ("scheduledAt" IS NOT NULL AND "scheduledVersionId" IS NOT NULL AND "scheduledBy" IS NOT NULL AND state <> 'ARCHIVED'));
ALTER TABLE cms_media_assets ADD CONSTRAINT cms_media_limits CHECK (bytes >= 0 AND (width IS NULL OR width > 0) AND (height IS NULL OR height > 0));

CREATE FUNCTION cms_immutable_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'CMS versions and audit/publication events are immutable' USING ERRCODE = '23514'; END $$;
CREATE TRIGGER cms_versions_immutable BEFORE UPDATE OR DELETE ON cms_versions FOR EACH ROW EXECUTE FUNCTION cms_immutable_record();
CREATE TRIGGER cms_audit_immutable BEFORE UPDATE OR DELETE ON cms_audit_events FOR EACH ROW EXECUTE FUNCTION cms_immutable_record();
CREATE TRIGGER cms_publications_immutable BEFORE UPDATE OR DELETE ON cms_publication_events FOR EACH ROW EXECUTE FUNCTION cms_immutable_record();

-- Establish a cache change entry for existing published documents, if any.
INSERT INTO cms_publication_events ("documentId", revision, "versionId", action, "actorId") SELECT id, revision, "publishedVersionId", 'PUBLISHED', 'system:migration' FROM cms_documents WHERE state = 'PUBLISHED';
COMMIT;
