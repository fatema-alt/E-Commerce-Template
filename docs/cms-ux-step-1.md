# CMS UX refactor ? Step 1 review

Branch: feat/cms-admin-ux. Isolated worktree: .worktrees/cms-ux. Shipping/order work remains in the original checkout on main.

## Delivered

- First commit removes fabricated homepage testimonials and makes the existing section render nothing. Saved section configurations remain valid. The real approved-review feed is deferred to Step 6.
- Five main CMS task areas: Store info, Look, Homepage, Pages and Menus. Media Library remains a shared utility.
- Store info groups identity/logo, contact details, announcements and floating contact settings in one editor and one existing settings document. Legacy announcement/contact routes open the unified editor; custom document query parameters still work.
- Look provides four API-valid presets and simple brand-color, font and button controls. Other theme fields live in Advanced. Presets preserve unrelated settings rather than resetting the whole document.
- Existing configuration selection is still accessible under Advanced, with the normal store/theme document opening automatically. New stores can create their first settings/look draft without understanding document keys.
- Existing draft/publish APIs and backend role checks are unchanged. Homepage selection, simplified publication and autosave belong to later steps.

## Main files

- apps/admin/src/components/admin/sidebar.tsx
- apps/admin/src/components/cms/cms-workspace.tsx
- apps/admin/src/components/cms/cms-task-config.ts
- apps/admin/src/components/cms/store-look-editor.tsx
- apps/admin/src/app/cms/{settings,theme,homepage,pages,navigation,announcements,contact-widget}/page.tsx
- apps/admin/src/app/globals.css
- apps/storefront/src/components/customer-reviews-section.tsx
- New scripts: verify-cms-tasks.mjs, verify-cms-tasks-browser.mjs and verify-testimonials-hidden.mjs.

## Verification

Admin and storefront production builds and TypeScript checks passed; targeted admin lint passed. Four presets passed the real API content validator. Existing CMS validation/engagement/auth suites passed 41 tests. The testimonials runtime test confirms existing configs render no fake content.

The isolated browser check passed at 390px in light/dark themes: task navigation, unified fields, legacy route compatibility, draft save isolation, preservation of homepage/header/announcement settings, native keyboard preset/Advanced activation and STAFF/ADMIN UI restrictions. API responses are intercepted fixtures; this is not a real database integration run. Backend role unit tests run independently.

## Review locally

From this worktree, build/start admin on a free port and visit /cms/settings, /cms/theme, /cms/homepage, /cms/pages and /cms/navigation. Existing /cms/announcements and /cms/contact-widget open Store info. Save a draft and verify the storefront stays unchanged until an authorized explicit publication.

Automated commands (after API and admin builds):

    node apps/admin/scripts/verify-cms-tasks.mjs
    node apps/admin/scripts/verify-cms-tasks-browser.mjs
    node apps/storefront/scripts/verify-testimonials-hidden.mjs

No schema, migrations, public response shapes or stored content were changed. Nothing has been pushed. Stop here for review before Step 2.
