# Storefront shopping implementation

The storefront now supports browsing, product selection, persistent carts, guest/account checkout, order confirmation and tracking. It continues to render published CMS themes, pages, menus and images. Existing admin catalog/customer/order modules remain the source of truth.

## Customer pages

| URL | Behavior |
| --- | --- |
| `/` | Published selected CMS homepage; local homepage remains `hero` |
| `/shop` | Public products, category/search filters, effective-price range, sorting and pagination |
| `/categories`, `/category/:slug` | Public category browsing |
| `/product/:slug` | Image gallery, variant selection, stock, price, quantity, cart/wishlist actions and product metadata |
| `/cart` | Browser-persistent cart with quantity/removal controls and server-verified quote |
| `/checkout` | Guest or signed-in delivery form, available payment methods, signed quote and order submission |
| `/account` | Registration, login/logout, password change and newsletter preferences |
| `/orders`, `/orders/:id` | Own order history, totals, address, status and shipment tracking |
| `/wishlist` | Browser-local saved products; current stock/prices are checked on the product page and checkout |
| `/help`, `/contact` | Shopping help and published store contact details |
| `/robots.txt`, `/sitemap.xml` | Public indexing rules and published catalog/CMS URLs, excluding private/noindex records |

Cart and wishlist storage contain product information, not payment credentials or delivery addresses. A cart supports up to 100 distinct product/variant lines. Quantity is checked again by the server; display prices in browser storage are never authoritative.

## Checkout and customer APIs

Customer browser calls go through `/api/shop/...` on the storefront origin. The bridge permits only known shopping routes, passes only the shopper cookie, checks write origins/custom headers, bounds request sizes, and marks responses no-store. Admin session cookies are never forwarded.

The API adds `/api/v1/shop` routes for `me`, `register`, `login`, `logout`, `password`, `payment-methods`, `quote`, `orders`, `orders/:id`, `newsletter` and `newsletter/preferences`. Shopper cookies are separate from admin sessions, HttpOnly/SameSite, with opaque random tokens stored as hashes. Sessions expire after 30 days. Scrypt password hashing reuses the existing password utility.

Checkout quotes expire after ten minutes and are HMAC-signed against the shopper session, requested products/variants/quantities and subtotal. The order transaction rechecks availability, active category ancestors and prices; a changed total returns a conflict instead of silently charging it. Existing idempotent order creation and conditional inventory reservations prevent duplicate orders and overselling. Guest order access is recorded in the same transaction as order creation. An account session cannot access other customers' orders or internal notes/events/payment metadata.

Creating an account or signing in from a valid guest browser preserves that browser's guest orders. Guest ownership transfer is serialized and audited. Sessions from a different authenticated customer are never merged. Password changes revoke the account's other sessions. Admin-created customer records cannot be claimed solely by entering their email: a separate shopper credential is required. Email verification and self-service password reset email delivery are not integrated; account recovery currently goes through store contact.

## Payments and charges

The user requested COD, SSLCommerz, bKash, Nagad and bank transfer, and confirmed that merchant configuration is not yet available.

| Method | Current status |
| --- | --- |
| COD | Implemented and enabled. Orders remain UNPAID until existing admin collection/accounting workflows record receipt. |
| Bank transfer | Implemented as a manual, unpaid order; enabled only when the bank account settings below are supplied. Store staff verify receipt through the existing admin payment ledger. |
| SSLCommerz, bKash, Nagad | Selection slots are present but disabled. Live provider adapters, merchant credentials and verified callbacks/settlement integration are still required. Entering credentials alone does not activate these methods. |

No card details are collected and no fake online success/paid state is produced. All amounts are BDT. The current existing order engine charges zero shipping and additional tax; shipping/tax/coupon engines have not been invented or silently enabled. The verified total displays those charges explicitly.

API environment settings:

```text
# Required for production; generate a stable random secret of at least 32 characters.
STOREFRONT_CHECKOUT_SECRET=<private random secret>

# Supply all three to enable manual bank transfers.
BANK_NAME=
BANK_ACCOUNT_NAME=
BANK_ACCOUNT_NUMBER=
BANK_BRANCH=
```

The development signing secret is process-local; restarting the API requires a fresh cart quote. Production replicas must share the same configured secret. Never put provider credentials/signing secrets in NEXT_PUBLIC variables or CMS documents.

Storefront settings:

```text
STOREFRONT_API_BASE_URL=http://localhost:4000/api/v1
STOREFRONT_ORIGIN=http://localhost:3000
```

Set the public HTTPS origin for a deployed environment. Merchant onboarding, sandbox/live payment verification and actual deployment were not performed.

## Newsletter

CMS newsletter sections now have a real consent-required signup form. Email addresses are normalized and saved idempotently. Signed-in shoppers can unsubscribe/resubscribe through account preferences. This records subscriptions; it does not send marketing campaigns or transactional emails. Anonymous signup does not reactivate an unsubscribed address. An email delivery/verification service is a separate integration.

## Migration and operations

Migration `20261018170000_storefront_shopping` adds shopper accounts/sessions/order access, newsletter subscriptions and shared throttle buckets. It adds relationships to existing Customer/Order models without replacing their tables or resetting any business data. Existing immutable order snapshots/ledger guards remain in place. The migration passed on isolated databases before local application. The local schema drift check reported no difference.

Before local deployment, a PostgreSQL backup was saved to ignored `.local-backups/commerce-before-storefront-shopping.dump`. Production databases were not touched. Prefer a forward fix over removing account/order history. Restore backups into a separate database for verification before any recovery switch.

Expired throttle rows can be removed by deployment housekeeping. Expired shopper sessions with order-access relationships must not be blindly deleted. The current shared rate limiter sees the API transport address; configure trusted proxy-aware limits before a high-traffic deployment through a shared proxy.

The sitemap is bounded to 20,000 catalog and 20,000 CMS entries per response. Larger catalogs should use a sitemap index. Published CMS pages marked noindex and private shopping routes are excluded.

## Verification and local use

Passed checks include API and storefront production builds, TypeScript, API lint and storefront ESLint (only two existing unoptimized-image warnings in older catalog components); existing order unit/database regressions; shopping HTTP tests for signed pricing, invalid input, retries, stock, privacy, account sessions and newsletter preferences; real Chrome browser testing of product → cart → mobile checkout → order confirmation → registration and API-bridge origin restrictions.

Final results: 34 existing order tests, 39 CMS/auth/catalog-rules/media tests, 52 shopping HTTP checks, and 25 real-browser/API-bridge checks passed. Concurrent checkout of the last stock unit succeeds for exactly one buyer. Bank-transfer tests use fixture account details only and verify that orders remain unpaid. Creating an account on the guest browser retains access to its guest order. All 11 local storefront/SEO routes returned 200 with the verified API running; the selected published hero remains visible.

Environment limitation: clean Prisma regeneration initially encountered a Windows engine DLL lock, then an optional retry after releasing this task's API process encountered a machine-level memory allocation failure. The generated client/compatible engine used by the successful builds and tests is operational; the verified compiled API and storefront were restored. Retry `prisma generate` and rebuild when memory is available. No user browser was terminated and no business database was reset.

Browser screenshots are available in ignored `.local-backups/storefront-checkout-desktop.png` and `.local-backups/storefront-checkout-mobile.png`. Test fixtures live only in isolated validation databases; test orders did not enter the local business database.

```powershell
# API build/start
corepack pnpm --filter api build
corepack pnpm --filter api start:dev

# Storefront build/start (or use the usual dev command)
corepack pnpm --filter storefront build --webpack
corepack pnpm --filter storefront start --port 3000

# Configure SHOP_TEST_DATABASE_URL to an isolated commerce_cms_validation_... database.
# Apply all migrations to that isolated database before these scripts.
corepack pnpm --filter api test:shop:http
corepack pnpm --filter api test:shop:browser
```

The browser runner needs Chrome (Windows default path or CHROME_PATH), built API/storefront output, and an isolated database. It starts/stops its own servers and a separate headless Chrome profile, never the user's normal browser profile.
