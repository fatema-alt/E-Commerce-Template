# Read-only production inventory audit

Script: `apps/api/scripts/audit-production-readonly.mjs`.

## What it does

- Requires the explicit `--read-only-audit` flag before loading a database client or opening a connection.
- Executes fixed, parameterized **SELECT statements only** through `$queryRawUnsafe`; identifiers are allowlisted/validated. No transactions, SET statements, migration commands, writes, cleanup or deletes are issued.
- Counts and lists products, variants, categories, customers, coupons and CMS documents; also lists distinct product brands.
- Customer selection/output is restricted to internal ID and available status/timestamp flags. It never selects names, emails, phones, addresses or notes from customer tables.
- Flags short titles, repeated letters, lorem/demo markers, possible keyboard gibberish and suspect prices for manual review. It prints paths/reasons rather than descriptions or CMS text excerpts. It scans all stored CMS versions, so findings may be historical rather than live.
- Counts/lists product-image and CMS-asset records with blank/null alt metadata. Category images are reported separately because their renderer derives alt text from the category name. It does not certify rendered HTML alt attributes or inspect embedded image text.
- Handles unavailable tables as `count: null, unavailable: table-not-visible-or-missing`, rather than falsely claiming zero. PostgreSQL metadata visibility depends on role grants, so an audit account cannot always distinguish a missing table from one it cannot see. No table or column is created.

The `--limit` (1..500, default 100) caps listings only. Counts and placeholder detection still scan all applicable records in batches of 200. Full historical content scans can be expensive on a large store: schedule appropriately. Counts/lists are not an atomic snapshot during concurrent edits.

## Run it

Use a **SELECT-only database account** supplied through the deployment environment. The script does not inspect/enforce the role's write grants; this is an additional operational safeguard. Do not put credentials directly in a command, screenshot or committed file. It does not load dotenv automatically or silently fall back to another database URL.

The built API Prisma client must exist at `apps/api/dist/generated/prisma/client.js`; use the already-built deployment artifact. Do not run migrations to prepare this audit. The local production build has verified this import path.

From the repository root, PowerShell (assuming the read-only connection is already provided in `READ_ONLY_DATABASE_URL`):

```powershell
$env:AUDIT_DATABASE_URL = $env:READ_ONLY_DATABASE_URL
node apps/api/scripts/audit-production-readonly.mjs --read-only-audit --limit=100 --schema=public > audit-report.json
```

Linux/container equivalent:

```sh
AUDIT_DATABASE_URL="$READ_ONLY_DATABASE_URL" node apps/api/scripts/audit-production-readonly.mjs --read-only-audit --limit=100 --schema=public > audit-report.json
```

Help (no connection):

```sh
node apps/api/scripts/audit-production-readonly.mjs --help
```

Do not commit or publicly upload the resulting inventory report: product IDs, unpublished coupon codes, timestamps and internal customer IDs can still be sensitive/linkable even though customer personal fields are omitted. The script logs no database URL and suppresses raw Prisma connection/query error messages.

## Validation and limitations

```text
node apps/api/scripts/verify-readonly-audit.mjs
PASS: explicit flag, SELECT-only guard, missing tables, listing caps, complete placeholder scan, alt metadata, customer redaction (27 SELECTs)
```

The test uses an in-memory adapter, exercises the constructed SQL statements, missing coupons table, capped listings/full scanning, and deliberately returns extra customer private fields to verify output whitelisting. CLI execution without the flag exits nonzero without opening a connection. Syntax checks and help also pass.

The local PostgreSQL/Docker service was unavailable during commit (d). Therefore a fresh live-database run, real SQL integration result and production counts are **not verified**. No production connection was attempted. Run this exact script with the intended read-only account after reviewing the code. Findings never authorize deleting/editing demo data.
