# Published CMS to storefront integration

The storefront now renders published CMS documents through the existing public API. It keeps catalog browsing, search, category pages and product detail pages. No admin API, admin session or database credential is sent to a storefront browser.

## Admin workflow and document keys

1. In **Storefront CMS → Site Settings**, create/save/publish the key `default`.
2. In **Theme**, create/save/publish the key `default`.
3. In **Navigation**, create/publish the key `main`. Alternatively set header menuKey/categoryMenuKey and footer-column menuKey values in Site Settings to other published navigation keys.
4. In **Pages**, create/publish the key `home` for `/`. Alternatively, enable **Home Page Key** in the `default` Site Settings document, enter another published page key (such as `hero`), and publish the settings. Add supported sections in the desired order. Publishing a page by itself does not assign it to the homepage.
5. Additional published pages such as `about` appear at `/about`. Use their paths in Navigation. Existing application routes (`search`, `categories`, `category/...`, `product/...`) keep their dedicated behavior and take precedence over CMS keys.

Drafts and archived/unpublished custom pages are unavailable publicly. A missing published homepage uses the existing catalog-based landing page; a deliberately published page with zero sections remains empty. Missing settings/theme documents use first-run defaults. API failures surface an unavailable state instead of substituting unpublished content.

Optional server-side environment variables on the storefront:

```text
STOREFRONT_API_BASE_URL=http://localhost:4000/api/v1
CMS_SETTINGS_KEY=default
CMS_THEME_KEY=default
CMS_HOME_KEY=home
```

Published Site Settings `homePageKey` overrides `CMS_HOME_KEY`; otherwise the default is `home`. The local `.env.local` now selects the existing published `hero` document, fixing the reported homepage mismatch without copying/overwriting CMS documents. The Pages editor explains page URLs and links to homepage settings.

CMS document reads are request-scoped and no-store. A newly published snapshot appears on the next server request/refresh, without rebuilding. An already open tab does not receive push updates. Catalog reads also use no-store, preventing a stale cached price from surviving a publication. No deployment webhook or cross-process cache invalidation service is required for this delivery strategy.

## Connected features

- Published theme tokens drive scoped CSS variables for colors, body/heading fonts and sizes, spacing, radius, button/card styles, header/footer tone and layout presets.
- Site settings provide store name/tagline, logo, favicon, announcement and link, header search placement/layout, contact information, social/legal links and footer columns. Content language is set on the storefront wrapper.
- Nested published menus work without hover-only interactions and remain usable on mobile.
- All 14 registry types have explicit renderers: hero, banner slider, category grid, product grid/carousel, collections, brands, flash sale, promo banner, image/text, plain rich text, FAQ, newsletter information and trust features. Unknown blocks are ignored; HTML strings are escaped, never injected.
- Section order, visibility and mobile/tablet/desktop settings control rendering. Banner controls support pause/play and reduced motion; sale events show an expiry countdown.
- Product sources use server-side public catalog filters for featured, latest, category, selected IDs and currently active sale prices. Selected ordering is applied before pagination. Private, inactive, deleted or invisible-category products retain existing visibility protections. Category selections resolve requested IDs across the catalog rather than just the first catalog page.
- Only image metadata referenced by the published snapshot is projected publicly; upload actors/storage keys and other asset records are excluded. Relative local image paths resolve against the API origin, including local HTTP development.
- Published page SEO supplies title, description, canonical URL and noindex. Custom page routes return Next.js not-found behavior when no public snapshot exists.

Product money remains the existing BDT catalog pricing. Changing the settings currency does not convert catalog prices. Newsletter content is rendered, but subscription capture is visibly unavailable until an email/subscriber service is configured; no fake signup or success response is shown. Checkout/account/customer authentication and marketing delivery are outside this integration.

## Scheduled publications

The API now starts a bounded scheduled-publication batch every 60 seconds while it is running. CmsScheduler reuses existing pinned-version transactions, active SUPER_ADMIN checks and multi-worker locking. It prevents overlapping batches within a process and logs failed batches. This handles up to 50 due documents per tick; large backlogs drain across subsequent ticks. While the API is stopped, no publications run; overdue eligible schedules are processed after it resumes.

Set `CMS_SCHEDULER_ENABLED=false` if the deployment already runs the separate `corepack pnpm --filter api cms:publish-due` command. Multiple API replicas remain protected by document locking/rechecks. No Windows scheduled task or production deployment was installed by this change.

## Verification

Passed: storefront TypeScript and targeted lint, API build and targeted lint, storefront webpack production build; 28 CMS validation/database/scheduler tests; 28 authenticated HTTP checks; 26 actual API-to-production-storefront checks against an isolated validation database. End-to-end checks cover all block configurations, dynamic pages, nested menus, theme variables, media URLs, escaped text, selected order before pagination, active-sale/featured filtering, private product exclusion, draft isolation and publication without a rebuild.

The integration runner creates unique fixtures only in `commerce_cms_validation_...` databases and starts/stops its own temporary API/storefront processes. No production CMS documents were seeded or published. No schema migration was required for this integration.

```powershell
corepack pnpm --filter api build
corepack pnpm --filter storefront build --webpack
# Set CMS_TEST_DATABASE_URL to a separate commerce_cms_validation_... database first:
corepack pnpm --filter api test:cms
corepack pnpm --filter api test:cms:http
corepack pnpm --filter api test:cms:storefront
```

Browser visual/mobile inspection, live S3 access and production deployment remain unexecuted. Responsive rules and controls were compiled/linted and exercised through rendered HTML; no interactive browser automation was available in this workspace.
