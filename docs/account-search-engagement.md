# Account, search, announcements and contact support

## Implemented

The account page uses a centered 480px authentication card, compact typography, the existing DS Mart logo, password visibility control, native accessible validation and a full-width lime action. Password creation rules appear only during registration. The existing HttpOnly shopper session and login/register/logout/password endpoints are preserved. Signed-in shoppers see account details, recent orders, order tracking, wishlist, password management and newsletter preferences. No unsupported password recovery or saved-address service is advertised.

The header uses a 300ms debounced catalog combobox backed by the existing active-product search API. Results include real names, images and BDT prices. Arrow keys, Enter, Escape, outside click and navigation are supported, with loading/error/empty states and an ordinary full-search form as fallback. Query autocomplete is set to `off` on the input and form. The old global input focus rule caused competing black outlines; the search now uses one blue container ring. Browsers and extensions may still display their own suggestions; the application cannot guarantee suppression of browser-controlled UI.

The Smart Announcement Ribbon supports multiple enabled, ordered messages, optional emoji and CTA, colors, UTC start/end schedules, device targeting, fade/slide-up/slide-left/static display, and 3–30 second rotation. Hover, keyboard focus, explicit pause and reduced-motion preferences stop automatic rotation. Rotation keeps a fixed-height surface. The legacy single announcement remains supported until the new ribbon configuration is added; its master toggle takes precedence.

The global contact widget uses merchant-configured channels only. It supports WhatsApp with encoded message, `tel:` and `mailto:` links, position/device settings, colors and theme variants, icon style, radius, animation intensity, route exclusions, delay, outside close and session dismissal preference. It starts closed and never claims online availability. Close/Escape restore launcher focus; the panel is a non-modal labelled dialog. Its launcher respects safe areas and yields when it overlaps checkout CTAs or marked avoidance elements. A session dismissal suppresses the breathing animation; users can still reopen support.

## CMS routes and persistence

- `/cms/announcements` — Announcement Bar editor and desktop/mobile draft preview.
- `/cms/contact-widget` — Floating Contact Widget editor and desktop/mobile draft preview.
- Both are linked from Storefront CMS navigation and edit the selected existing `SITE_SETTINGS` document, default key `default` (or `CMS_SETTINGS_KEY`).
- New JSON properties are `announcementRibbon` and `contactWidget`. No database table, enum or migration was added.
- Existing CMS draft, immutable versions, optimistic revisions, publish, scheduling, rollback and authorization are reused. ADMIN/SUPER_ADMIN may save drafts; only SUPER_ADMIN publishes, as before. STAFF sees a read-only editor. Publishing a Site Settings document also publishes its other saved changes, explained in the editor.
- Dates are entered in the administrator's local timezone and saved as UTC. Item order is controlled by the existing move-up/down controls. Route exclusions accept pathnames and include descendant routes.
- The public storefront reads published documents with `no-store`. Persistent browser layouts refresh the selected public settings every 60 seconds and on focus/visibility return, without requiring a rebuild for content changes. Failed refreshes keep the last known published settings.
- No contacts are enabled by default. Configure accurate contact details, enable a channel and the widget, save, then publish. Support promises/hours are deliberately authored CMS text.

New storefront endpoints:

- `GET /api/search?q=...` — bounded catalog suggestions, normalized from the existing backend, with real failure responses.
- `GET /api/storefront-settings` — only published ribbon/widget/legacy announcement settings; no admin credentials or unrelated settings are exposed.

## Checks and limits

- Storefront, admin and API production builds passed.
- All three application TypeScript checks passed.
- Targeted storefront/admin ESLint and API Oxlint passed. The pre-existing raw-image preview warning in `schema-fields.tsx` remains; previews intentionally preserve merchant media origins.
- 41 API tests passed across CMS validation, safe channel URLs, schedule validation, legacy settings compatibility and actual CMS handler authorization metadata.
- Admin isolated browser checks passed: announcement create/edit/reorder/delete, draft versus publish, revision handling, contact settings reload, previews, staff read-only controls, 375/768/1440px and light/dark layouts. These checks intercept API contracts; they do not claim PostgreSQL persistence.
- Storefront isolated browser checks exercise real Next route handlers against local fixture upstream data: sign-in error/success, registration, sign-out, recent orders, password visibility, duplicate guard, catalog debounce and keyboard selection, no-result/error fallback, schedule/device filtering, rotation and pause, reduced motion, contact links/focus/Escape/outside close, exclusions and settings refresh without rebuild. Responsive screenshots cover 320/375/768/1440px. Existing product, review, newsletter, cart, checkout and order regressions are retained.
- `test:engagement` in the API creates and removes a uniquely named isolated PostgreSQL database and runs CMS integration tests, including the new settings publication snapshots. That check could not run in this session: PostgreSQL at `localhost:5434` and the Docker daemon were unavailable. No store database was changed. Real production authentication and external messaging/payment actions were not exercised.
- Screenshots are ignored under `apps/storefront/.product-check` and `apps/admin/.editor-check`.

Deploy the API first so its CMS schema knows the new fields, then rebuild/redeploy admin and storefront. Select the same Site Settings key used by the storefront before publishing. Existing production `STOREFRONT_ORIGIN` and database environment configuration still need to be correct; this feature does not alter hosting variables.

## Files modified or added

- `apps/storefront/src/components/account-orders.tsx`
- `apps/storefront/src/components/store-shell.tsx`
- `apps/storefront/src/components/search-combobox.tsx`
- `apps/storefront/src/components/store-engagement.tsx`
- `apps/storefront/src/lib/cms.ts`
- `apps/storefront/src/lib/engagement.ts`
- `apps/storefront/src/app/layout.tsx`
- `apps/storefront/src/app/globals.css`
- `apps/storefront/src/app/api/search/route.ts`
- `apps/storefront/src/app/api/storefront-settings/route.ts`
- `apps/storefront/scripts/verify-product.mjs`
- `apps/admin/src/app/cms/announcements/page.tsx`
- `apps/admin/src/app/cms/contact-widget/page.tsx`
- `apps/admin/src/components/cms/engagement-preview.tsx`
- `apps/admin/src/components/cms/cms-workspace.tsx`
- `apps/admin/src/components/cms/schema-fields.tsx`
- `apps/admin/src/components/admin/sidebar.tsx`
- `apps/admin/src/app/globals.css`
- `apps/admin/scripts/verify-engagement.mjs`
- `apps/admin/package.json`
- `apps/api/src/cms/cms-schema.ts`
- `apps/api/src/cms/cms-validation.ts`
- `apps/api/src/cms/engagement.spec.ts`
- `apps/api/src/cms/cms.integration.spec.ts`
- `apps/api/scripts/verify-engagement-backend.mjs`
- `apps/api/package.json`
- `docs/account-search-engagement.md`
