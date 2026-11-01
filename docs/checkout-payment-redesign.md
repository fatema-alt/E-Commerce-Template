# Manual checkout payment redesign

## Behavior and architecture

New checkout uses `FULL_PAYMENT`, `PARTIAL_ADVANCE`, and `COD`. Plans are priced independently of payment methods in `apps/api/src/payments/plan-pricing.ts`, using the existing Prisma Decimal and two-decimal rounding convention. Checkout previews and transactional order creation call that same pricing function; admin order views use the stored pricing snapshot. Product sale-price selection and existing shipping-rate configuration are unchanged.

Full Payment discounts products, never delivery. Coupons either stack sequentially (global OR coupon permission) or compete by actual savings, with a customer-visible explanation of the winner. Free shipping always combines. The combined percentage cap allocates the allowed discount to the coupon first and then prepaid discount. Orders retain `discountTotal`, `shippingTotal`, and the existing successful-payment ledger for report compatibility, and add `couponDiscount`, `prepaidDiscount`, and `paymentPlan`. Existing `shippingTotal` is the delivery-charge field; it is not duplicated.

Partial advances support delivery-only, fixed, and percentage of the final discounted total including delivery. Advances are capped at the total. An advance that covers the entire order becomes PAID on confirmation because no balance remains. Delivery-only advances disappear when delivery is free; other advances remain available. COD starts OFF and visibility depends exclusively on its toggle and inclusive minimum/maximum final order totals.

Checkout requires sender/reference before confirmation for prepaid plans. Server-signed previews bind plan, coupon, products, delivery and due-now/delivery amounts. Order creation recomputes prices, checks current plan/method availability, snapshots recipient details and creates the order, payment submission, coupon usage, inventory reservations and shopper access in one serializable transaction. Submission does not credit the ledger or mark payment paid. If discounts and free delivery make the entire order zero, no method/reference or zero-value transfer is requested; the zero balance is recorded as PAID without a manual submission.

`CheckoutPaymentsModule` does not import or inject the legacy gateway module, adapters or service. `ManualPaymentHandler` validates mobile/bank submissions through a handler registry. Only the method enum reserves `gateway`; write DTOs, UI and registered handlers allow mobile banking/bank only. The new `order_payments` table has no gateway fields.

## Admin workflow

As SUPER_ADMIN, open **Settings → Payments**:

- **Plans:** configure plan toggles, discounts/caps, advance type/value, COD limits and stacking rules.
- **Methods:** add/edit bank or mobile accounts, upload a logo through the existing validated image-upload service, enter sanitized rich-text instructions, change sort order or enable/disable. Deletion is always soft deletion. Used methods cannot change category.
- **Promotions:** each coupon has **Combine with prepaid discount**, available when creating a coupon and as a toggle on existing coupons.
- **Orders:** select **Awaiting verification** in the payment filter. Open the order to inspect its account snapshot, sender/reference, advance and COD balance. Independently verify receipt before confirming. Reject requires a customer-visible reason.

Confirmation records reviewer/time, credits one successful entry in the existing ledger and confirms a pending order. Full Payment becomes PAID; a partial advance with a remaining balance becomes PARTIALLY_PAID. The usual delivered-shipment COD collection records the remaining amount. Direct manual accounting cannot bypass review of new checkout submissions. Pending or rejected submissions block fulfillment until verified. Repeated review attempts cannot credit twice; stale revisions fail.

Customers see Awaiting Verification separately from the shared UNPAID/PARTIALLY_PAID/PAID status. A rejected payment can be resubmitted using a new reference, preserving rejection history and the original method snapshot even if the live method is changed or removed. References are normalized (uppercase, spaces/hyphens removed) and globally unique across the new manual-payment records, including rejected records. Legacy ledger references remain in their original table.

Durable `MANUAL_PAYMENT_SUBMITTED`, `MANUAL_PAYMENT_CONFIRMED` and `MANUAL_PAYMENT_REJECTED` order events are notification hook points. No email, SMS, automatic refund or gateway transfer is implemented.

## Migration and rollout

Migrations: `20261031150000_payment_foundation` and `20261101000000_manual_checkout_redesign` under `apps/api/prisma/migrations/`. The foundation adds earlier coupon/gateway tables that were present in the Prisma schema but missing from migration history, while preserving databases previously initialized with db push.

From `apps/api`, with the intended database configured:

```powershell
node node_modules/prisma/build/index.js migrate deploy
node node_modules/prisma/build/index.js generate
```

Deploy the API and both frontends together after migration. Configure/review methods and plans before reopening checkout. The migration:

- Adds tables, fields, indexes and immutable snapshot/history guards without deleting old orders, payments, references, configurations or totals.
- Maps A to Partial Advance, B/C to Full Payment, COD to COD, and manual/bank orders to Full Payment. Historical orders with no new payment submission retain their existing detail/verification flow.
- Carries legacy A/B/C plan availability and C discount configuration forward; COD deliberately starts OFF.
- Imports manual accounts and instructions. Previously enabled complete mobile accounts remain enabled. Bank accounts missing new required branch/routing information are disabled until completed.
- Preserves historical `discountTotal`. Old C/coupon combinations cannot always be attributed accurately from the legacy data, so the backfill attributes to coupon when a coupon ID exists and to prepaid for C without a coupon. Historical totals are unchanged; reconcile ambiguous attribution before relying on separate legacy discount analytics.

Old bKash Online/SSLCommerz code and configuration remain for historical records/callbacks. New checkout never lists or redirects to them, the storefront proxy no longer exposes initiate/switch endpoints, and legacy initiation/switch services reject orders carrying the new plan field. Existing historical manual-order reference submission and accounting remain supported.

## Verification and remaining manual checks

Targeted API suite: 116 tests passed across shared pricing, atomic order creation, manual review/rejection/resubmission, duplicate references, input validation, access scoping, shipping boundaries, promotions, legacy manual payments and legacy payment regression tests. API production build and both Next production builds passed. Prisma Client generation passed. Encoding and whitespace checks passed.

`node scripts/verify-checkout-redesign.mjs` starts isolated fixture servers and an isolated headless browser. It checks Plans save, Methods form, all three plans, bank/mobile category selection, absence of online gateways, duplicate-reference feedback with retained inputs, creation awaiting verification without credit, rejection, customer resubmission and approval. It checks horizontal overflow and writes desktop/390px screenshots under ignored `.payment-redesign/`. This is a frontend fixture test, not a real database/payment test.

During the subsequent local run, the Windows PostgreSQL 18 service on port 5432 was found and connected successfully. A pg_dump backup was saved under ignored `.payment-redesign/local-run/`. Both new migrations applied successfully after adding the missing payment foundation. The API payment-methods endpoint, storefront and admin login each returned HTTP 200. No real transfer or full database-backed payment lifecycle test was performed. Before production rollout, verify:

1. Legacy A/B/C/COD orders, pending manual claims and reports still display and reconcile; confirm imported account details and enabled states.
2. Create full, partial and COD orders using real catalog/inventory data. Exercise coupons, free shipping, both stacking permissions, caps, free-delivery advance variants and COD limits.
3. Verify logo upload with configured local/S3 storage, rich-text sanitization, method sorting/toggling/deletion and snapshot preservation after account edits.
4. Submit the same normalized reference across two concurrent checkouts; only one order/submission may commit. Concurrent reviews must credit once.
5. Reject/resubmit/confirm a bank and a mobile submission; verify reviewer identity/time, revision changes and exact ledger totals.
6. Deliver a partial/COD shipment and record its collection; verify final PAID status, decreasing delivery balance and report reconciliation.

The legacy browser script `scripts/verify-manual-payments.mjs` targets the former checkout UI; use the new redesign script for new checkout verification.
