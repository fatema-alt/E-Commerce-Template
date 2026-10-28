# CMS UX refactor - Step 2 review

Branch: feat/cms-admin-ux, worktree .worktrees/cms-ux. Shipping/order changes remain in the original checkout.

## Changes

New pages are created from a title. The address generator supports Latin accents, length bounds and a deterministic URL-safe fallback for Bengali-only titles. The new page address can be edited in Advanced before creation. Existing page URLs are read-only. Availability is checked on creation; the backend independently rejects reserved addresses for new pages and uses revision checks/unique document identity to prevent collision overwrites. Existing legacy documents remain editable.

Homepage opens the currently assigned published Site Settings page instead of assuming home. Pages show readable titles and a Current homepage badge. Published pages offer Use as homepage with a live-impact confirmation. Publishing a different page shows an inline Published. This page is not your homepage. notice and the assignment action. STAFF cannot create pages; ADMIN cannot assign the homepage. Backend enforcement remains authoritative.

## Homepage assignment safety

The new admin-only POST /admin/cms/homepage/assign requires SUPER_ADMIN and expected revisions for both the settings and target page. The transaction locks both documents and verifies that the target page and settings are published. It starts from the published settings snapshot, replaces only homePageKey, records a new immutable snapshot and publishes that snapshot.

If an unpublished settings snapshot already exists, an exact copy is retained as the highest snapshot so the existing inspect/editor behavior continues to show the private draft. The original snapshots and pinned schedule are not modified. This explicit publication creates version/audit history; it is unrelated to the deferred autosave work. The publication audit records the actor, previous/next homepage and target published page version. Stale revisions stop with a conflict; no overwrite or automatic retry occurs.

If Store info has never been published, the UI/API ask for that prerequisite rather than publishing its drafts implicitly. The selected settings document uses CMS_SETTINGS_KEY (default: default). Keep the admin CMS_HOME_KEY fallback aligned with the storefront when using the legacy environment fallback instead of a published homePageKey.

Public CMS response shapes, Prisma schema and storefront renderers are unchanged. The admin document list adds a display title; private draft titles remain on authenticated admin routes only.

## Files

Admin: cms-workspace.tsx, cms-api.ts, new page-address.ts helper, homepage/pages route wrappers, globals.css, verify-page-address.mjs and verify-cms-pages-browser.mjs.

API: cms.service.ts, cms.controller.ts, cms.dto.ts, new page-address.ts, cms-homepage.spec.ts and cms-homepage.integration.spec.ts.

## Validation

- Admin and API production builds, both TypeScript checks and targeted lint passed.
- Standalone slug tests passed, including actual Bengali Unicode and Latin accent inputs.
- CMS/permission unit selection: 75 tests passed.
- PostgreSQL became available: the existing safe test runner created a disposable commerce_cms_validation_ database, applied the 14 committed migrations, ran all CMS/guard suites (89 tests passed), then removed only that temporary database. The store database was not modified.
- Isolated browser flow at 390px passed: actual homepage loading, new title/slug creation, URL read-only behavior, collision/reserved rejection, draft save isolation, non-homepage publish notice, confirmed assignment, ADMIN/STAFF restrictions and light/dark layouts. Browser API responses are fixtures; the separate PostgreSQL suite verifies the real persistence behavior.

## Review

Visit /cms/pages, create About Us, save and publish. Confirm the non-homepage notice. As SUPER_ADMIN, choose Use as homepage, then open /cms/homepage and confirm it opens About Us. Existing settings drafts remain private. Page URLs remain available after homepage assignment.

Run after API/admin builds:

    node apps/admin/scripts/verify-page-address.mjs
    node apps/admin/scripts/verify-cms-pages-browser.mjs

Stop for review before Step 3. No push has been performed.
