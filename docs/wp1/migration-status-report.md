# WP1 local migration status (read-only)

Date: 2026-10-28, Asia/Dhaka. Branch: `feat/wp1-claims-cleanup`.

## Command attempted

From `apps/api`, with `DATABASE_URL` loaded without printing credentials and checked to target only local `commerce_db` on port 5434:

```text
node node_modules/prisma/build/index.js migrate status
```

This is the repository-installed Prisma CLI equivalent of `pnpm --filter api exec prisma migrate status`. No install, generate, deploy, dev, reset or db-push command was run.

Full result (exit 1):

```text
Target: local commerce_db on port 5434 (credentials omitted)
Loaded Prisma config from prisma.config.ts.

Prisma config detected, skipping environment variable loading.
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "commerce_db", schema "public" at "localhost:5434"
Error: Schema engine error:
```

## Follow-up evidence

- A SELECT-only Prisma probe against `127.0.0.1:5434` returned `Can't reach database server at 127.0.0.1:5434`.
- No listener was found on local TCP port 5434.
- `docker ps -a` failed because the `dockerDesktopLinuxEngine` named pipe did not exist; the local Docker Linux daemon is unavailable.
- No database/container/service was started or changed. No database record or migration state was modified.

Therefore the current applied/pending/failed migration list is **unverified**. This is a connection failure, not an assertion that migrations are up to date or failed on the server. Restore the intended local database service, then rerun `migrate status` before approving any separate migration work. Production was not contacted.

## Why the coupons table was missing in Step 0

The earlier successful Step 0 local read found no `public.coupons` table. Source inspection now confirms:

- `apps/api/prisma/schema.prisma` declares `model Coupon` mapped with `@@map("coupons")` and related coupon models.
- **None of the 14 tracked migration SQL files creates `coupons`.** A model declaration or generated Prisma client does not create a table in the database.
- The current main branch also has no migration creating that table. Consequently applying only the currently tracked migrations cannot supply this missing coupon table.
- The primary source-level gap is schema/migration drift: the coupon model lacks a checked-in table-creation migration. Current database history cannot be rechecked while the service is unavailable; production's state is unknown.

Do not fix this with db-push/reset or a hand-written production table. A separately approved migration must reconcile the complete model/history safely, after checking actual database state. This WP1 commit adds no migration or Prisma/schema/config/generated-client change.

Tracked migration directories:

```text
20261013111936_init_categories
20261013115224_add_products
20261013120253_advanced_catalog_foundation
20261017090914_admin_auth_sessions
20261017113102_customer_management
20261017120000_catalog_management
20261017192234_orders_initial
20261018063602_cms_foundation
20261018090000_orders_operations
20261018100000_order_snapshot_guards
20261018120000_cms_publishing_guards
20261018170000_storefront_shopping
20261020120000_dashboard_analytics
20261027133000_product_reviews_and_questions
```

## Main/WP1 comparison warning

WP1 branched from `81e3c7a`. Main has since gained separate catalogue/deployment commits, including `be5aaf9` (Linux Prisma binary target) and `9610dbf` (Prisma config fallback URL). A two-dot `main..feat/wp1-claims-cleanup` endpoint diff consequently shows those main-only changes in reverse, including Prisma files and catalogue image deletions. Those are **not edits introduced by WP1**, and must not be used as a patch to revert main.

Use `git diff --stat main...feat/wp1-claims-cleanup` and the WP1 commit list to inspect this branch's introduced changes. No merge/rebase/cherry-pick of the new main commits was done during this step. Reconcile branch ancestry only through a separately reviewed integration step; do not deploy this older branch as if it included main's newer deployment fixes.
