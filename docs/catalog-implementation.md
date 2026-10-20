# Catalog management

## Initial gap analysis

The initial repository had product/category CRUD, basic image uploads, editable variant JSON, cookie authentication and stock movements. Product/category lists were unbounded. Category parents were in the schema but absent from validated editors. Variant mutation routes did not enforce product ownership. Uploads trusted caller-supplied MIME types. Prices were accepted as JavaScript numbers. Publishing status was derived from a checkbox; there were no explicit visibility, shipping, scheduled-sale or audit controls.

## Design and compatibility

- Preserve `Product.categoryId`; no many-to-many category migration is needed. Existing category foreign keys and all stock/movement records remain intact.
- Existing `GET /products` and `GET /categories` retain array responses, bounded to 100 rows. New consumers use `paginated=true&page=1&pageSize=25` and receive `{items,total,page,pageSize}`. Page size is capped at 100. Integrations expecting more than 100 legacy rows must adopt pagination.
- Product search includes name, SKU, barcode and variant identifiers. Category filtering includes descendants. Sorting uses an allowlist with stable ID ties. Queries and counts execute in a repeatable-read transaction. Low stock uses each inventory record's threshold and accounts for reservations. Editors submit the loaded `expectedUpdatedAt` timestamp to reject stale saves; existing product edits omit stock entirely so price changes cannot undo stock adjustments.
- Prices accept decimal strings; numeric legacy requests are converted to strings at validation. Services use Prisma Decimal. The UI submits monetary strings. `Inventory.quantity` and `reserved` remain authoritative, with serializable adjustment transactions and movement records. Variable products use variant stock; parent adjustments are rejected.
- New products default to drafts. Explicit legacy `isActive=true` remains supported; the new editor uses `status`. Variable products start as drafts with zero parent stock. Changing a simple product to variable requires zero parent stock. Existing variants and movements are never deleted.
- Product descriptions remain plain text. Consumers must render them as text; no rich HTML editor or HTML rendering was introduced.

## Schema and migration

`20261017120000_catalog_management` adds catalog metadata, shipping/publishing settings, sale schedules, option definitions, variant metadata and media association. Existing values receive conservative defaults. Cost, compare-at and shipping measurements use Decimal columns.

Three narrowly scoped models are added:

| Model | Purpose and constraints |
| --- | --- |
| CatalogAuditLog | Actor ID, action, entity and before/change data. Entity/time index supports paginated history. Logs are written in the mutation transaction. No passwords or session tokens are logged. Hashed-address login-attempt events also support shared rate limiting. |
| CatalogRedirect | Unique entity/historical slug points to a stable entity ID. Resolves to the current slug, avoiding redirect chains. Reclaiming one's own old slug removes that historical entry. |
| CatalogSku | Shared normalized SKU primary key across products and variants. Triggers maintain it; the unique index protects cross-table races. |

SQL constraints enforce non-negative prices, sale relationships, category self-parenting, a single primary image/default variant, normalized SKU uniqueness and unique variant combinations. Triggers validate media/movement ownership and category ancestry. Hierarchy services serialize moves and validate the entire affected tree (maximum eight levels).

The migration wraps DDL in a transaction. Conflicting legacy global SKUs, prices, combinations or primary-image records abort it. Reconcile such data explicitly; never reset the database or delete history to force deployment. Existing empty variant attributes are preserved, while new variants require valid options.

Deployment sequence:

1. Coordinate with any other task changing the Prisma schema or migration directory.
2. Back up the database and media volume. Check `prisma migrate status`; review pending migrations. Compare the live schema to the last deployed schema, accounting for deliberately pending changes. Stop on unexplained drift.
3. Validate all migration SQL in a separate PostgreSQL 17 database. The catalog integration runner refuses databases without a `commerce_catalog_validation_` prefix.
4. Run `pnpm --filter api exec prisma generate` (Windows processes holding the generated engine DLL may need a coordinated restart).
5. Run `pnpm --filter api exec prisma migrate deploy`, then deploy the API and admin together.
6. Verify login, roles, category moves, product pagination, image uploads and stock adjustments.

Rollback: prefer rolling application code back while retaining additive columns/tables and audit history. Do not drop catalog fields after administrators begin using them. Restoring a database snapshot loses subsequent writes and requires an explicitly planned recovery window. A down migration must remove dependent triggers/indexes before dropping columns and preserve exported audit/redirect data. Do not rewrite a migration already applied to a shared database.

## APIs and authorization

Existing product/category/variant/inventory endpoints remain. Added endpoints:

- `GET /products/summary`, `POST /products/bulk`
- `POST /products/:id/variants/generate`, `POST /products/:id/variants/bulk`
- `PATCH /products/:id/images/:imageId` for alt text, ordering, variant association and primary status
- `GET /categories/summary`, `GET /categories/tree`
- `GET /catalog/:entity/:id/audit` (administrators only, paginated)
- Public `/storefront/products`, `/storefront/products/:slug`, `/storefront/categories`, `/storefront/categories/:slug`, `/storefront/sitemap`

Staff can read protected catalog data. Cost prices, internal notes and valuation are removed from staff responses. Admin and Super Admin can create/edit/archive, upload/delete media and adjust stock. Super Admin alone can delete categories or soft-delete products and invoke bulk product deletion. Product/variant deletion retains stock and movement history. Roles are checked on the server, including bulk endpoints. Each bulk result explicitly records success/failure; operations on separate entities may partially succeed.

All mutations, including login, require `X-Commerce-Admin: 1`. The admin fetch helper, login/logout and uploader send it. Cross-origin browser forms cannot supply it; CORS allows only `ADMIN_ORIGINS`, and cross-site origins/fetch metadata are rejected. API clients must add this header as well as the session cookie. Sessions remain HttpOnly, SameSite=Lax and Secure in production. Login attempts are limited to ten per IP per rolling 15 minutes through PostgreSQL advisory locks and the shared audit-event index. Limits survive process restarts and apply across API replicas. Only address hashes are stored; no passwords or raw IPs are recorded. Do not trust arbitrary forwarded IP headers.

Public endpoints use explicit field projections and omit draft, archived, deleted, hidden and inactive products and products beneath hidden/inactive category ancestors. Scheduled pricing is evaluated at read time. Historical product slugs redirect only to public products. Sitemap entries include products and categories, are paginated and exclude noindex entries. JSON-LD and breadcrumb data are returned for storefront integration. The existing placeholder storefront has not been rebuilt.

## Media

`MEDIA_STORAGE` is an injectable storage interface; the bundled local provider uses `MEDIA_ROOT` (default `apps/api/uploads` when the API starts from its package directory). Deploy local storage only on a durable shared volume. The S3 adapter is selected with `MEDIA_STORAGE=s3`, `MEDIA_S3_BUCKET`, `AWS_REGION`, `MEDIA_PUBLIC_URL` (an HTTPS CDN/public asset origin) and optional `MEDIA_S3_PREFIX`. It uses the standard AWS credential chain, uploads immutable WebP objects and thumbnails, and checks deletion errors. Production local mode requires an explicit `MEDIA_ROOT`. Credentials and bucket/CDN provisioning remain deployment configuration; no AWS account is accessed during offline tests.

Uploads are held in bounded memory (5 MB), decoded by Sharp, restricted to JPEG/PNG/WebP, limited to 32–8192 pixels per side and 32 megapixels, stripped of metadata and re-encoded as WebP. Each asset has a 320px thumbnail and collision-resistant key. Product galleries are limited to 20 images. File removal accepts only generated UUID filenames inside the chosen scope. Database ownership is verified before media mutation. Static files use nosniff headers and a restrictive content policy.

Database and filesystem operations cannot share a transaction. Failed creates remove newly stored files; replaced/deleted images are cleaned after the database commits. Interrupted cleanup can leave orphan files. Run `pnpm --filter api media:cleanup` for a dry run; `pnpm --filter api media:cleanup --apply` removes only unreferenced generated files older than 24 hours and their thumbnails. The same command supports local volumes and S3 through the selected provider. Schedule it against the correct environment. When changing providers, migrate existing assets/URLs or keep their original location served; existing media URLs are never silently rewritten. Never delete the uploads directory wholesale.

## Validation

- `pnpm --filter admin lint`
- `pnpm --filter admin exec tsc --noEmit`
- `pnpm --filter admin build`
- `pnpm --filter api build`
- `pnpm --filter api test` (database tests skip unless explicitly configured)
- After building the API, `pnpm --filter api test:catalog:http` runs real HTTP assertions against the explicitly configured isolated database.
- Set `CATALOG_TEST_DATABASE_URL` to an isolated database and run `pnpm --filter api test:catalog` to deploy migrations there and run database regressions.

Coverage includes cross-instance login throttling, offline S3 upload/security behavior, stale saves, concurrent hierarchy moves, repeatable combination generation, scheduled sales, decimal validation, pagination compatibility, cycle prevention, deletion safeguards, duplicate/global SKUs, duplicate variant combinations, mismatched variant ownership, concurrent stock reduction against reservations, history retention, partial bulk failure, public visibility, slug changes, CSRF headers and forged image uploads.

## Deliberate boundaries

No second authentication or inventory system, destructive reset, many-to-many category conversion, carrier integration or rich-text rendering was introduced. Scheduled product publishing and product import remain outside this implementation; scheduled sale pricing is supported. Browser-level accessibility and visual regression tests require a browser runner. Tax settings, shipping class and backorder policy are catalog configuration; there is no checkout/tax/carrier engine in this repository to consume them. Production rollout still requires coordinated migration application, durable media provisioning and deployment-specific proxy configuration.

## Verified on 17 October 2026

Admin lint, both TypeScript checks, API build and the isolated admin production build passed. The PostgreSQL regression run passed 22 tests across six test files; the compiled API HTTP smoke test passed 35 assertions. S3 requests were mocked: no cloud credentials or live bucket were used. The shared development database reported six applied migrations and no Prisma schema difference. Customer-module changes from the concurrent task were preserved.

Validation databases `commerce_catalog_validation_20261017` and `commerce_catalog_validation_20261017_v2` were created separately from the existing commerce database. They contain test fixtures and can be retained for reruns. No existing commerce records were reset or deleted by the catalog test runners. A browser runner was unavailable, so visual and browser accessibility checks remain unverified.
