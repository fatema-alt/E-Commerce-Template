# Product editor and storefront rendering

The product editor now uses TipTap for headings, bold, italic, underline, lists, quotes, safe links, undo/redo and clearing formatting. The name and description occupy the main form column; status and organization remain in the sidebar.

`@commerce/product-content` converts legacy plain text/Markdown and sanitizes supported HTML through one shared allowlist. New or edited descriptions are normalized on the API and sanitized again when rendered. Opening and saving an unchanged legacy description preserves its stored string. There is no database migration or rewrite of existing records.

The compact image gallery supports drag ordering, accessible move controls and a details dialog for primary image, alt text, variant association, replacement and removal. The API validates that an ordering request includes every current image exactly once and updates order transactionally. File cleanup retains assets referenced by another product, a CMS asset or a category.

The product header consumes the review section's authoritative summary. Empty products show “No reviews yet”; catalog cards no longer display invented ratings. Description typography, short description, price and benefits are styled explicitly. Benefits link to real checkout, order and support routes without unsupported delivery/authenticity promises.

## Modified files

- `packages/product-content/{package.json,index.js,index.d.ts}`: shared conversion, sanitization and safe links.
- `apps/admin/src/components/catalog/{product-rich-editor.tsx,product-gallery-manager.tsx,products-page.tsx}`: rich editor, gallery and form integration.
- `apps/api/src/products/{products.service.ts,product-images.controller.ts}`: description persistence and image ordering/cleanup.
- `apps/api/src/products/{product-content.spec.ts,product-description-save.spec.ts,product-images.spec.ts}`: content, persistence and gallery tests.
- `apps/storefront/src/components/{product-rich-text.tsx,product-feedback.tsx,product-reviews.tsx,product-overview.tsx,product-purchase.tsx,product-card.tsx}`: safe display, real reviews, benefits and pricing.
- `apps/storefront/src/app/product/[slug]/page.tsx` and `apps/storefront/src/lib/product-seo.ts`: shared description rendering and plain-text metadata.
- Both apps' `src/app/globals.css`: scoped editor, gallery and product styles.
- Both browser verification scripts, all three app package manifests and `pnpm-lock.yaml`.

## Validation

Admin, storefront and API production builds and TypeScript checks passed. Thirty focused API tests passed, including the existing review tests. Targeted lint had no errors; existing raw-image/navigation and DTO-spread warnings remain.

The isolated admin browser suite passed formatted content save/reopen/edit, Bengali/English/emoji and lists, image upload failure/retry, ordering, primary selection, alt text, replacement, removal, publication, responsive light/dark layouts and role restrictions. Browser API responses are intercepted fixtures; these checks do not claim a production database write.

Local PostgreSQL was unavailable and Docker was not running, so real database integration could not be executed. No production data was accessed or changed. No migration is required. Deploy all three applications together and install workspace dependencies from the updated lockfile.
