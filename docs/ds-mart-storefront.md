# DS Mart storefront

The existing Next.js storefront now uses the supplied DS Mart wordmark and DS symbol. Original uploads remain at the repository root; public copies are in `apps/storefront/public/brand`. CSS frames the transparent artwork without changing the source images. The app icon uses DS lettering and the orange brand dot.

The shared design uses navy (`#0B2344`), cyan (`#00AEEF`), accessible blue buttons (`#0076AB`), pale blue backgrounds and orange accents. Header, footer, category navigation, product cards, forms, checkout panels, mobile layouts and dark mode share this palette. CMS heroes without an image display the DS artwork. Published page content, menus, contact details and shopping behavior remain connected to the existing APIs.

Brand name and palette are set by the storefront code. `getCmsConfig` applies DS Mart color tokens after published theme tokens; other CMS settings and layout tokens remain available. Root metadata is static DS Mart metadata, so the brand title and icon do not require an available CMS server. Page-specific CMS SEO is still used. The previous Next.js favicon was replaced with the DS icon.

The store frame explicitly renders at request time under Suspense. If CMS configuration cannot be loaded, it renders a branded unavailable screen rather than exposing a failed fetch. Home/custom-page metadata preserves Next.js control-flow exceptions and returns noindex on operational failures. This does not repair or replace the database/API service.

Validation on 2026-10-19:

- Storefront TypeScript check passed.
- Webpack production build passed, including prerender generation.
- Temporary isolated API fixtures verified production HTTP rendering for home, shop, categories, category detail, product detail, search, cart, checkout, account, orders, wishlist, help and contact.
- Verified published CMS homepage content, default DS artwork, logo/icon responses and the API outage screen with noindex metadata; no blocking metadata errors appeared.
- The fixture server and production verification server were stopped after checks. Fixtures were not written to a real database.

Interactive browser/mobile visual inspection and real database-backed checkout/payment verification were not performed. The PostgreSQL/API startup issue must still be resolved for live shopping.
