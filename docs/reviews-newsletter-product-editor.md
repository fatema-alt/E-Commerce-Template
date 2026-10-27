# Reviews, newsletter and product editor

## Changes and root causes

- Storefront review SVGs previously depended on Tailwind sizing utilities that were not present in the storefront stylesheet. The redesigned review component uses explicit SVG width/height attributes, inline dimensions and scoped CSS. Stars remain 22px at every breakpoint.
- Review listing errors were silently swallowed and looked like an empty catalog. Fetch errors now have a retry action; empty states are separate. Rating summaries, percentages, verified counts and five-item pages come from the backend response.
- Storefront review/Q&A endpoints accidentally required an admin session through the global admin guard. The storefront controller now follows the public shop route convention while retaining global CSRF checks, DTO validation, throttling, optional HttpOnly shopper-session identity, and the existing service's guest moderation/verified-purchase policy. Admin review endpoints retain their existing access controls. Review/question submissions include the DTO-required product ID, with the path ID authoritative at the controller.
- The review models existed in Prisma without a corresponding migration. The new additive migration creates their enums, tables, indexes and relations on clean deployments and accommodates tables already created with `db push`. No Prisma model or product constraints were changed.
- Newsletter forms inherited the browser fieldset border and the padded generic consent row. Dedicated newsletter styles reset the fieldset and checkbox, align a two-column dark panel and stack the controls on mobile. Native email/consent validation and existing subscription API are retained, with synchronous submission locking and accessible success/error messages. The subscription endpoint records consent; it does not issue a coupon. Numeric percentage-discount headings are therefore replaced by neutral copy until actual promotion fulfilment is connected.
- Product creation/editing now uses a single vertically scrollable editor. Pricing, inventory, variants and shipping remain in the main column; status, organization and collapsed SEO are in the sidebar. Advanced metadata and audit history remain available in an accordion. No product field or service was removed. SKU suggestions are generated on user input and can be edited. Slug suggestions stop overwriting manual edits. Draft and publish actions use explicit status values through the existing API.
- Existing uploads, primary-image controls, alt text, ordering, replacement, variant assignment and deletion remain available. Queued images can be reordered before upload. Aggregate upload progress reflects completed files. If an image fails after the product was created, the saved ID/version is retained and retries update that product rather than creating a duplicate.
- Inventory and shipping fields hide when not applicable while retaining existing saved data. Variable products must still be created as zero-parent-stock drafts before configuring/publishing variants. Basic option editing supports the existing JSON contract; raw option data remains accessible.

## Verification

Production builds passed for storefront, admin and API. Targeted admin/storefront lint and TypeScript checks passed.

- `pnpm --filter storefront test:product`: isolated browser tests cover the existing purchase/gallery/cart flows plus review pagination, actual summary data, rating selection, failed submission retention, moderated success, newsletter validation, consent, double-submit prevention, and light/dark layouts at 390/768/1366px. Screenshots are generated under `apps/storefront/.product-check`.
- `pnpm --filter admin test:editor`: isolated browser API contracts cover required fields, SKU suggestions, draft creation, image failures/retries, revision-protected editing/publishing, retained stock, conditional variant/shipping controls, responsive themes and staff restrictions. Screenshots are generated under `apps/admin/.editor-check`. These checks use intercepted APIs and do not write store data.
- After `pnpm --filter api build`, `pnpm --filter api test:editor` creates a uniquely named temporary `commerce_catalog_validation_editor_*` database on the configured database server, deploys migrations, and runs catalog/review/auth/media integration and unit tests. It removes only that generated database afterward. The 36 checks cover actual product validation/editing, variant combinations, inventory adjustments, publishing visibility, guest moderation and idempotent subscription persistence.

## Deployment

Run `pnpm --filter api exec prisma migrate deploy` before restarting the API. Deploy the rebuilt admin and storefront together. The store database was not migrated or populated by these tests; no live reviews, subscriptions or products were created. No unrelated pages were redesigned and no new dependency was added.

## Modified files

- `apps/storefront/src/components/product-reviews.tsx`
- `apps/storefront/src/components/newsletter.tsx`
- `apps/storefront/src/components/cms-sections.tsx`
- `apps/storefront/src/components/home-sections.tsx`
- `apps/storefront/src/app/globals.css`
- `apps/storefront/scripts/verify-product.mjs`
- `apps/admin/src/components/catalog/products-page.tsx`
- `apps/admin/src/components/catalog/product-fields.tsx`
- `apps/admin/src/components/catalog/product-editor-section.tsx`
- `apps/admin/src/components/catalog/product-options-editor.tsx`
- `apps/admin/src/components/catalog/pending-product-images.tsx`
- `apps/admin/src/app/globals.css`
- `apps/admin/scripts/verify-product-editor.mjs`
- `apps/admin/package.json`, `apps/admin/.gitignore`
- `apps/api/src/reviews/reviews.controller.ts`
- `apps/api/src/reviews/reviews.service.ts`
- `apps/api/src/reviews/reviews.module.ts`
- `apps/api/src/reviews/reviews.spec.ts`
- `apps/api/src/reviews/reviews.controller.spec.ts`
- `apps/api/src/reviews/reviews.integration.spec.ts`
- `apps/api/src/shop/shop.module.ts`
- `apps/api/prisma/migrations/20261027133000_product_reviews_and_questions/migration.sql`
- `apps/api/scripts/verify-editor-backend.mjs`
- `apps/api/package.json`
- `docs/reviews-newsletter-product-editor.md`
