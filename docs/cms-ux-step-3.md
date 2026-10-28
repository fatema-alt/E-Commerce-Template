# CMS UX refactor — Step 3 review

Branch: `feat/cms-admin-ux`, isolated worktree `.worktrees/cms-ux`. Shipping/order work remains in the original checkout.

## Delivered

Explicit **Save draft** remains. Successful saves use the existing API and create immutable history versions. There are no schema changes, new backend endpoints or new dependencies.

Unsaved editor content is copied to browser localStorage, including incomplete and schema-invalid input. Copies are isolated by API, authenticated administrator, content type and document address. Revisiting offers **Restore unsaved changes** or **Discard local copy**; nothing is restored or sent to the API automatically. New unsaved pages retain their address in the editor URL so recovery works after reload. Successful server saves remove their safety copy. Storage failures show a warning without discarding in-memory input.

The safety copy retains its original server revision. Restoring it against a newer revision blocks writes. A server 409 also stops saving/publication and preserves input. There is no force overwrite or retry loop. Confirmed writes followed by refresh failures require reloading before another write.

One shared **Publish** button and **Save draft** control serve both classic and visual editors. Statuses are **Not saved**, **Saved**, **Live**, **Draft changes (not live)** and **Scheduled**. History, restore-and-publish, schedule, unpublish and archive are inside **History and options**. Native confirmations explain live-site effects. Users without permission see a disabled Publish button and **Ask a Super Admin to publish**. Backend permissions remain authoritative. The builder now disables editing for read-only users. Leave-page warnings remain; same-page fragment links and new-tab links do not imply leaving the editor.

## Deferred

Server-side autosave without history remains deferred. The current draft API creates immutable `CmsVersion` records, and the database prevents modifying these snapshots. A separate mutable draft store would require the schema/model change that was explicitly declined. Browser recovery is a safety net, not a server save or cross-device backup.

## Files

- `apps/admin/src/components/cms/local-draft.ts`: recovery helpers, statuses and confirmation text.
- `apps/admin/src/components/cms/publication-controls.tsx`: shared publication/history UI.
- `apps/admin/src/components/cms/cms-workspace.tsx`: local recovery and revision-safe actions.
- `apps/admin/src/components/cms/visual-homepage-builder.tsx`: remove duplicate publication controls, enforce read-only UI, tighten preview types and replace fabricated review preview with a neutral notice.
- `apps/admin/src/components/cms/cms-api.ts`: optional latest-snapshot identity typing.
- `apps/admin/src/app/globals.css`: scoped responsive/dark styles.
- New `verify-cms-publication.mjs` and `verify-cms-publication-browser.mjs`; previous task/page browser scripts updated for the unified Publish action.

## Validation

Admin production build and TypeScript passed. Targeted lint has no errors; the existing builder raw-image optimization warning remains. Helper tests cover invalid input round-trip, account/API/document isolation, damaged storage, quota errors, clearing, statuses and confirmation messages.

The isolated 390px browser suite passed invalid input reload/restore, new unpublished-page recovery, no server autosave requests, clear-on-save, publish cancellation/confirmation, keyboard history controls, scheduling/cancellation, rollback/unpublish, conflict blocking, stale recovery, storage warnings, native leave-page warnings and ADMIN/STAFF restrictions. Light/dark screenshots were inspected. Previous Step 1 and Step 2 browser suites also passed. Browser API responses are fixtures.

Separately, the safe local PostgreSQL runner created a disposable database, applied the 14 existing migrations, ran **89 CMS/permission tests**, and removed that temporary database. This includes real concurrent-revision and immutable-history checks. The store database was not modified.

After building admin/API, run:

```sh
node apps/admin/scripts/verify-cms-publication.mjs
node apps/admin/scripts/verify-cms-publication-browser.mjs
node apps/admin/scripts/verify-cms-tasks-browser.mjs
node apps/admin/scripts/verify-cms-pages-browser.mjs
```

Stop for review before Step 4. Nothing has been pushed.
