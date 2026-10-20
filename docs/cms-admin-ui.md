# CMS administration UI

The admin sidebar now includes Storefront CMS, with dedicated routes:

- `/cms/settings`: store identity, locale/currency, logo/favicon selectors, announcement, header/footer, contacts and links.
- `/cms/theme`: color pickers, font/layout controls and an illustrative theme preview.
- `/cms/pages`: page title/SEO and all 14 registered section types, content forms, image selectors, visibility/responsive controls, duplication and accessible up/down ordering.
- `/cms/navigation`: nested menu items with stable IDs, labels, safe links, add/remove and ordering controls.
- `/cms/media`: paginated images, validated upload, thumbnails and asset IDs.

All document editors connect to the existing authenticated CMS API. Create a document key, edit and save a draft. SUPER_ADMIN can publish, schedule, cancel a schedule, unpublish, archive or publish a historical version. History can also be loaded into the editor and saved as a new immutable draft. ADMIN can edit drafts; STAFF receives a read-only editor. API enforcement remains authoritative.

The editor retains unsaved input on failed requests or revision conflicts. Reloading, switching documents and navigation warn before discarding edits. Document lists, version history and media lists are paginated; image selectors can load additional batches. Publication actions require a saved draft.

New `POST /api/v1/admin/cms/media` accepts one multipart `file` from ADMIN/SUPER_ADMIN, up to 5 MB. It reuses Sharp signature/dimension validation, WebP re-encoding and the existing local/S3 storage provider under a CMS scope. A failed database registration removes the uploaded objects. No migration is needed for this endpoint. CMS media deletion/alt-text editing are not exposed by this UI.

Validation completed: admin TypeScript, targeted UI ESLint, API build, admin webpack production build including all six CMS routes, and 28 isolated database HTTP checks including upload, invalid-image rejection and STAFF upload denial. An initial concurrent build attempt hit environment memory errors; bounded-memory sequential checks passed. Browser interaction/visual inspection and live S3 upload were not run in this environment.

To open locally, run the API and admin with the usual development commands and visit `http://localhost:3001/cms/settings`. Restart the API if it is running an older compiled build. Scheduled publishing still requires the previously documented `cms:publish-due` deployment worker. The previews are illustrative admin previews; publishing stores public snapshots, while actual dynamic storefront rendering remains separate work.

Checks:

```powershell
corepack pnpm --filter admin exec tsc --noEmit
corepack pnpm --filter admin exec eslint src/components/cms src/app/cms src/components/admin/sidebar.tsx
corepack pnpm --filter api build
corepack pnpm --filter admin build --webpack
# With CMS_TEST_DATABASE_URL pointing to an isolated commerce_cms_validation_... database:
corepack pnpm --filter api test:cms:http
```
