# Dynamic dashboard

The admin dashboard retains its existing card layout, colors, and responsive grids. It reads authenticated, uncached data from `GET /api/v1/dashboard`, refreshes every minute while visible, and refreshes when the tab regains focus. Failed refreshes preserve the last successful snapshot and offer a retry; an unavailable API is never presented as zero sales.

## Metrics

- **Total sales:** all-time BDT order totals minus successful refund transactions; cancelled orders contribute zero. This follows the order report's order-cohort basis, not cash received or accounting profit. Other currencies are excluded instead of added together.
- **Orders:** all recorded orders, including cancelled orders and other currencies.
- **Customers:** non-deleted customer records, including guest customer records.
- **Inventory:** on-hand units, including reserved units, across non-deleted simple products and variable-product variants. Parent variable-product stock is not counted twice.
- **Revenue chart:** seven calendar days in Asia/Dhaka, including today; absent days are zero-filled. Revenue is BDT net sales. Order counts include all BDT statuses. The two bar series have separate scales; hover reveals exact values.
- **Monthly target:** an administrator-set BDT goal for the current Asia/Dhaka calendar month. Progress uses the same month's net sales. Zero or an unset goal shows no percentage. Targets are persisted and audited; only ADMIN and SUPER_ADMIN can edit them through `PATCH /api/v1/dashboard/target`.
- **Top categories:** current-month BDT net sales allocated among order items by their share of line totals, then grouped by the product's current category. Cancelled orders are excluded. Deleted/missing products are grouped as Uncategorized. The chart shows the top five categories and their shares of that displayed total.
- **Active customers:** non-deleted customer records with a non-cancelled order in the last 30 days.
- **New customers:** non-deleted customer records created this month.
- **Returning customers:** customers who ordered before this month and again this month.
- **Repeat purchase rate:** customers with two or more non-cancelled orders divided by customers with any non-cancelled orders, over all time.
- **Funnel:** unique tracked sessions reaching product pages, adding to cart, or visiting checkout this month. Purchases are verified non-cancelled BDT orders this month, not browser-submitted purchase events. These are activity counts, not a strictly ordered cohort conversion rate; guest purchases or visitors who opt out of tracking can differ from the browsing counts.
- **Traffic:** tracked sessions active this month, grouped by first-touch source: direct, organic search, social, referral, and email. UTM values and referrer host classify the source; raw URLs, query parameters, names, email addresses, and IP addresses are not stored.

## Storefront tracking

The invisible `StoreAnalytics` component records page, product-page, and checkout visits. Successful cart additions record add-to-cart events. Requests go through the storefront's same-origin `/api/analytics` route, which validates origin, request headers, allowed event types, and bounded payloads. It forwards a server-only credential to the API. Tracking failure never blocks shopping.

An HttpOnly, same-site cookie identifies a 30-minute inactivity session. Requests are serialized in the browser to establish the cookie before the next event. Event UUIDs make request retries idempotent; funnel metrics deduplicate by session, first-touch source remains unchanged, and ingestion is limited to 300 events per session per hour. Browser Do Not Track is respected. Browser analytics are indicative and may include automated traffic; they are not used to calculate order revenue.

Historical orders populate commerce metrics immediately. Visitor and funnel history starts after this feature is deployed; it cannot be reconstructed from old orders.

## Deployment

1. Deploy the API with the new `20261020120000_dashboard_analytics` migration. The configured startup command `pnpm --filter api exec prisma migrate deploy && pnpm --filter api start:prod` applies it before starting the API.
2. In the storefront resource, add **STOREFRONT_CHECKOUT_SECRET** with the same value as the API's existing checkout secret. Enable runtime availability only. It must contain at least 32 characters and must never have a `NEXT_PUBLIC_` prefix. Existing `STOREFRONT_API_BASE_URL` and `STOREFRONT_ORIGIN` remain required.
3. Rebuild/deploy the admin and storefront. Their existing domains and ports remain the same.
4. Visit a product, add it to the cart, and open checkout. Return to the dashboard; focus or the next automatic refresh loads the new session metrics. Use the target icon to save a monthly target.

## Validation

Generate Prisma and build the API before running the database/HTTP regression check:

```sh
pnpm --filter api exec prisma generate
pnpm --filter api exec tsc -p tsconfig.build.json
pnpm --filter api exec node scripts/test-dashboard.mjs
```

Set `DASHBOARD_TEST_DATABASE_URL` to a migrated, separate `commerce_dashboard_validation_*` PostgreSQL database. The script validates the database name and never resets or connects to the production database. It adds fixtures to the test database and checks month boundaries, sales/refund/currency calculations, categories, inventory, tracking deduplication, first-touch sources, admin authentication, and target permissions. Use a fresh test database for repeated full validation.
