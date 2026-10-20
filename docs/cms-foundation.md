# Dynamic storefront CMS — Steps 1 and 2

## Step 1: repository inspection (18 October 2026)

Verified in source: cookie-based AdminGuard with SUPER_ADMIN/ADMIN/STAFF, CSRF header and origin checks; catalog CRUD, inventory, customer profiles; order operations including payment records, reservations, shipping, returns and reports. Payment records do not by themselves establish that a live gateway is integrated. The dashboard explicitly describes itself as presentation-only. The storefront is still the Next.js starter page.

Reusable infrastructure: PrismaService, transaction-based catalog auditing patterns, Sharp image validation, local/S3 storage, admin fetch helpers, and existing authorization. Preserve these modules and the multi-category catalog.

A partial CMS already exists: CmsDocument, CmsVersion, CmsAuditEvent and CmsMediaAsset with an applied migration. Its module was not imported by AppModule. Only five-color themes were accepted; settings/navigation were disabled; page configurations had no block-specific schemas. Publication incorrectly used the document revision as a version number after publishing incremented that revision. No scheduling executor, publication feed or database ownership constraint protected the published pointer.

Baseline database checks: ten migrations applied; Prisma reported no schema difference. Existing three CMS validation tests passed. Baseline API build is checked before foundation changes.

## Step 2 scope

Extend the existing CMS storage and expose validated administrative and published-only APIs. Versioned JSON documents represent site settings, themes, pages and navigation; section ordering and nested menu items live inside their immutable version snapshot. This deliberately avoids duplicate settings/theme/page tables and mutable child rows that could leak draft section changes into a live page.

Theme editor UI, actual storefront rendering, drag-and-drop editor UI, navigation builder UI, media upload/library UI, Next.js cache webhooks and deployment scheduling are later steps. They are not considered complete by this foundation task.

## Implemented foundation

- Registered CmsModule in the existing application, reusing global authentication, RBAC, CSRF protection and Prisma.
- Strict, bounded schemas for SITE_SETTINGS, THEME, PAGE and NAVIGATION. The schema endpoint exposes defaults and all 14 section types. Unknown properties, unsafe links and executable/CSS input are rejected. Rich text currently means plain text paragraphs; a future HTML editor requires a separate sanitization contract.
- Immutable version snapshots, canonical content hashes, optimistic revision checks, transaction-scoped document locks and serializable transactions. Version numbers are independent from document revisions. A stale mutation returns 409.
- Separate draft and published pointers; publish latest or an explicit historical version, rollback, unpublish, archive, schedule and cancel schedule. Saving a draft preserves the published snapshot and any pinned scheduled version.
- Atomic audit and publication events. A commit-ordered publication feed supports a future cache consumer. Current public responses deliberately use no-store: no webhook/cache invalidation integration is claimed.
- Media references are recorded per immutable version and restrict physical deletion. Referenced assets must exist, have a safe URL and not be soft-deleted. This is metadata/reference infrastructure, not the later CMS upload interface.

## API contract

All paths below use `/api/v1`. Kind values are uppercase; keys are lowercase letters, digits, underscores or hyphens, at most 64 characters. ADMIN and SUPER_ADMIN may save drafts; STAFF may read administration data. Publication operations and the change feed require SUPER_ADMIN. Mutations require the existing session cookie and `X-Commerce-Admin: 1` header, with existing origin validation.

| Method/path | Purpose |
| --- | --- |
| GET `/admin/cms?kind=THEME&page=1&limit=25` | Paginated documents |
| GET `/admin/cms/schema` | Schemas, block registry and default theme |
| GET `/admin/cms/media` | Paginated asset metadata |
| GET `/admin/cms/changes?after=0&limit=25` | Publication feed; serialize sequence/cursor as strings |
| GET `/admin/cms/:kind/:key` | Draft/document metadata |
| GET `/admin/cms/:kind/:key/versions` | Paginated snapshots |
| GET `/admin/cms/:kind/:key/events` | Paginated audit history |
| GET `/admin/cms/:kind/:key/versions/:version` | Authenticated snapshot preview |
| PATCH `/admin/cms/:kind/:key/draft` | `{expectedRevision, content}`; new documents start at revision 0 |
| POST `/admin/cms/:kind/:key/publish` | `{expectedRevision, version?}` |
| POST `/admin/cms/:kind/:key/rollback` | `{expectedRevision, version}`; version required |
| POST `/admin/cms/:kind/:key/schedule` | `{expectedRevision, version?, scheduledAt}`; future ISO timestamp within 366 days |
| POST `/admin/cms/:kind/:key/cancel-schedule` | `{expectedRevision}` |
| POST `/admin/cms/:kind/:key/unpublish` | `{expectedRevision}` |
| POST `/admin/cms/:kind/:key/archive` | `{expectedRevision}` |
| GET `/storefront/cms/:kind/:key` | Public published snapshot only, ETag/If-None-Match; absent or unpublished returns 404 |

Admin responses use no-store. Public data excludes draft content, internal revision, schedule and actor metadata. There is no unauthenticated preview endpoint.

## Migration and recovery

`20261018120000_cms_publishing_guards` extends existing tables and adds CmsAssetReference and CmsPublicationEvent. Composite foreign keys prevent publication/scheduling/version events from referencing another document's snapshot. CHECK constraints protect state/pointer consistency, complete schedule metadata, revisions and media dimensions. Database triggers reject updates/deletes to versions, audit history and publication history.

The migration runs in one transaction and refuses ambiguous legacy schedules or foreign-document published pointers. It does not reset catalog/customer/order data. Published legacy documents receive a publication-feed entry. Prisma schema drift checks do not inspect the custom triggers/checks; integration tests exercise these database protections directly.

Before the local migration, a PostgreSQL custom-format backup was saved to ignored `.local-backups/commerce-before-cms-20261018.dump`. The migration passed on a separate `commerce_cms_validation_20261018` database before application to local `commerce_db`. All 11 migrations are now applied locally; Prisma reports no schema difference. Production databases have not been touched.

Prefer a forward fix if application rollback is necessary: retain immutable snapshots and history, stop the publication worker, and deploy compatible application code. Do not drop history tables/triggers to make an old client work. For full disaster recovery, restore the backup into a separate database and verify it before switching DATABASE_URL; restoring over a working database loses all writes since the backup.

## Verification and PowerShell commands

Run from `apps/api`; configure an isolated test database URL without printing credentials:

```powershell
corepack pnpm build
$env:CMS_TEST_DATABASE_URL = '<isolated PostgreSQL URL; database name commerce_cms_validation_...>'
corepack pnpm test:cms
corepack pnpm test:cms:http
corepack pnpm exec oxlint src/cms/
corepack pnpm exec prisma migrate status
corepack pnpm exec prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code
```

For another environment, take its own backup and review migration preflight failures before running `corepack pnpm exec prisma migrate deploy`. Never use reset or db push as a migration substitute.

Passed: API build; 16 schema/validation tests plus 10 isolated PostgreSQL integration tests; 23 real HTTP checks for authentication, role restrictions, CSRF, required rollback version, private drafts, stale revisions, ETag/304 and unpublish; local migration deployment and schema drift check. Integration cases also cover concurrent saves, immutable history, cross-document publication rejection, pinned schedules, multiple workers, revoked publisher authority and media references.

Failed/remaining environment limitation: a final `prisma generate` retry encountered Windows EPERM when replacing `query_engine-windows.dll.node`, which is held by a running process. Generated TypeScript and the existing same-version engine successfully built and ran all tests, but a clean regeneration is still required after the process using that DLL is stopped. Then run `corepack pnpm exec prisma generate` and rebuild. No user process was terminated automatically.

Not executed in this step: production deployment, browser/editor tests, S3 uploads, live payment tests, Next.js cache webhooks, or operating-system scheduled task installation. Admin/storefront source was not changed for this CMS foundation step.

## Scheduled publishing operations

After building, `corepack pnpm cms:publish-due` runs one bounded batch of up to 50 due documents. Run repeatedly using your deployment scheduler (for example every minute); multiple workers safely recheck locked records. A revoked or inactive scheduling SUPER_ADMIN cannot publish. The command emits per-document results and exits nonzero for failed publications. The scheduler and monitoring must be explicitly configured in deployment; saving scheduledAt alone does not run a timer.

## Files and next step

Implementation: `apps/api/src/cms/` (schema registry, validation, DTOs, controllers, service, worker and tests), `apps/api/scripts/test-cms.mjs`, `apps/api/scripts/smoke-cms.mjs`, `apps/api/src/app.module.ts`, `apps/api/package.json`, `apps/api/prisma/schema.prisma`, and the migration above. Existing authentication, catalog and storage providers are reused.

Step 3 is the theme editor and storefront CSS-variable integration. Before that integration, complete the clean Prisma generation, agree the storefront rendering contract, and connect authenticated admin forms to these APIs. The subsequent page builder must render only registry-approved blocks and public snapshots; the subsequent CMS uploader must register assets through the existing validated storage infrastructure. No claim is made that the full storefront CMS UI is complete.
