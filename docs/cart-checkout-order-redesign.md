# Cart, checkout and order details

The existing shopping routes now share compact cards, product thumbnails, price summaries and status badges. No new dependencies, database migrations or replacement checkout routes were introduced.

## Behavior

- Cart uses a roughly 65/35 desktop grid and stacked mobile layout, linked product images/titles, quantity steppers, line totals, remove feedback and a dedicated empty state.
- Quantity changes request a server quote before changing browser storage. Rejected inventory quantities leave the previous quantity and totals intact. Coupon eligibility and discounts come from the existing quote API. Quote validity includes both items and coupon code; stale totals cannot authorize checkout.
- Checkout has separate contact, delivery, payment and confirmation cards, aligned with its summary. Bangladesh mobile validation and native required/email validation provide field-level browser feedback. Address/contact drafts survive navigation in sessionStorage and are removed after successful creation. No payment information is stored in the draft.
- Enabled payment methods are selected from the API. Disabled methods have readable explanations. The API also rejects disabled methods before order creation. Existing signed quotes, server stock reservations, shopper sessions, scoped idempotency keys and verified online payment flows remain authoritative.
- Synchronous submission locks prevent rapid duplicate submissions. A retry retains form values and the idempotency key for an unchanged payload. Price/stock failures refresh the quote. Browser cart-storage failures after successful order creation cannot cause a second order attempt.
- Order details use persisted financial snapshots. The scoped order API additionally returns the existing phone, note, variant attributes, current catalog thumbnail and shipment timestamps. A deleted product displays a bag icon; historical prices are never recalculated from catalog data.
- Official order numbers remain intact; UUID-shaped references use a short visual suffix with the full stable identifier available in the title. Payment and order statuses are separate. The timeline includes order creation and actual recorded shipment timestamps only, without inferred intermediate timestamps.
- No courier tracking URL exists in the current API, so no guessed tracking links are displayed. No unsupported cancellation, refund or return action was added.
- Payment callback query strings no longer claim a successful transaction; the persisted backend payment status is displayed instead.

## Verification

- Storefront production build and targeted ESLint: passed.
- API production build and TypeScript checks: passed.
- API targeted Oxlint: completed with the pre-existing `no-misused-spread` warning in quote calculation (line 290).
- Targeted API Vitest: 29 tests passed across shopper order access/checkout boundaries, order financial rules and admin authorization. These are unit tests; no production database was modified.
- `node apps/storefront/scripts/verify-product.mjs`: isolated browser fixtures exercise real Next route handlers. Cart quantity changes, stock rejection, invalid/valid/removed coupons, guest form validation, disabled gateway, draft persistence, price-conflict retry, duplicate submission, successful redirect, persisted order data and empty-cart removal pass. Existing product/review/newsletter regressions also pass.
- Browser layout checks and light/dark screenshots cover 320, 375, 430, 768, 1024 and 1440px. No horizontal document overflow was detected. Representative desktop cart, mobile checkout and dark order screenshots were visually inspected. Artifacts are ignored under `apps/storefront/.product-check`.
- Live gateway transactions and production infrastructure were not exercised.

## Deployment

Rebuild/redeploy both API and storefront. This change needs no additional schema migration. The separately committed review migration is still required if it has not already been deployed.

The existing production origin configuration must match the public storefront URL (`STOREFRONT_ORIGIN`, including the correct scheme and hostname). This UI redesign does not repair an incorrect hosting environment variable. API migration commands must run in an environment containing its PostgreSQL `DATABASE_URL`.

## Files changed

- `apps/storefront/src/components/cart-checkout.tsx`
- `apps/storefront/src/components/account-orders.tsx`
- `apps/storefront/src/components/order-details.tsx`
- `apps/storefront/src/components/shopping-ui.tsx`
- `apps/storefront/src/lib/shop-client.ts`
- `apps/storefront/src/app/globals.css`
- `apps/storefront/scripts/verify-product.mjs`
- `apps/api/src/shop/shop.service.ts`
- `apps/api/src/shop/shop.service.spec.ts`
- `docs/cart-checkout-order-redesign.md`
