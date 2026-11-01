# Admin order details redesign

The admin order detail page now follows the supplied reference's information structure with a responsive card layout, light/dark themes, summary balances, status badges and quick actions.

## Information retained

- Header: order number, placement date/time, relative age, units, order/payment statuses and payment method.
- Items: product name/SKU, current thumbnail/category/store link when the product still exists, quantity, unit/line prices, separate discounts, delivery, tax and grand total. Commercial order snapshots remain unchanged.
- Payment: plan, method, advance status, sender/reference, expected amount, due now/on delivery, reviewer/time, rejected submissions and payment history. Verified submission ledger rows are not duplicated in the overview table.
- Customer: contact links, email and actual order/delivered/cancelled/returned counts for the stored phone number.
- Shipping/courier: address snapshots, recipient, district/city/division/postcode, delivery charge, tracking, weight, notes, costs and COD accounting.
- Timeline/notes: chronological audit events with expandable payloads, customer note and editable internal notes.
- Context: source, landing page/referrer/UTMs/click IDs, OTP status, server tracking events, device/browser/IP/cookies/client IDs, idempotency key, user agent, update time and raw snapshots.

Context values are shown only when recorded in the order's existing campaign/event metadata. Missing values say Not recorded; no traffic, device, OTP or payment facts are invented. The redesign does not add new tracking collection or OTP delivery. OTP is explicitly shown as not enabled.

## Actions and safeguards

Call/WhatsApp open the appropriate contact links. Copy courier details copies order/recipient/address/COD information. Print uses a dedicated print layout. Courier details opens the existing manual-shipment workflow; it does not invoke a courier API. Direct product replacement is not available; the existing return workflow remains available for item changes.

Status updates continue to follow server-validated transitions. Payment status uses existing verification/accounting actions rather than arbitrary dropdown changes. Revision and idempotency handling are retained. After a successful mutation the full detail response is refreshed, including enriched customer history and product data. The page now reads the actual `{ user: { role } }` authentication response correctly.

No database migration is required. API detail queries add selected product display information, selected idempotency metadata and read-only phone-history counts. Historical names, prices, addresses and amounts remain stored snapshots.

## Validation

- API and admin production builds/type checks pass.
- 111 targeted API tests pass, including six new order summary tests covering actual phone history, COD/manual/legacy advance balances, collection and not-found behavior.
- Browser fixtures exercise all reference sections, light/dark themes, 1366px/390px overflow checks, nested admin auth responses, payment review/rejection/resubmission, internal note persistence and the courier quick action.
- Existing local database: admin authentication, order list and enriched order detail each return successful responses. No real orders were edited for this read check.
- Screenshot artifacts are ignored under `.payment-redesign/`.

The locally running API and admin have been restarted with the changes. Open `/orders` and select an existing order to review the page with real local data.
