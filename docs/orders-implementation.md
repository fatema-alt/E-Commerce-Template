# Orders module

## Audit and implementation

The original module created guest/customer snapshots, reserved stock, listed orders,
and handled basic status changes. It lacked item-level return records and approval,
shipment updates, financial accounting, reports/export, mutation replay protection,
client version checks, and functional management forms. Orders requests also omitted
the CSRF header required by the existing admin guard.

The implementation preserves order creation and list/detail response structures.
It adds transactional operations, inspection-based returns, manual evidence-based
accounting, server-side reporting, and connected admin forms. Storefront checkout
and live integrations are outside this change.

## API

All routes use `/api/v1`. Existing HttpOnly admin sessions authenticate requests.
Every write requires `X-Commerce-Admin: 1` and an `Idempotency-Key` of 16–128
alphanumeric characters or `._:-`. Every update additionally requires the last
read integer `version` in its JSON body. Creation does not require a version.
Keep the same key and body when retrying a failed/uncertain request. A committed
update replays its saved response without repeating inventory or financial effects.
Reusing a key for different content/actor/operation returns 409. A stale version
returns 409; refresh before starting a new operation. Invalid inputs return 400.

| Method | Path | Minimum role | Body / purpose |
|---|---|---|---|
| GET | `/orders` | STAFF | Server pagination, search, filters and sorting |
| GET | `/orders/reports` | STAFF | Same filters, `period=daily` or `monthly` |
| GET | `/orders/export` | ADMIN | Filtered CSV; audited; maximum 10,000 rows |
| GET | `/orders/:id` | STAFF | Snapshots, reservations, shipments, returns, ledger, notes, timeline, refundable balance |
| POST | `/orders` | ADMIN | Existing validated `CreateOrderDto`; catalog-priced lines and shipping-address snapshot |
| PATCH | `/orders/:id/status` | ADMIN | `version`, `status`, optional `reason` |
| POST | `/orders/:id/cancel` | ADMIN | `version`; releases reservations; records any refund obligation without issuing a refund |
| POST | `/orders/:id/notes` | ADMIN | `version`, `body` (1–2,000 characters) |
| POST | `/orders/:id/shipments/manual` | ADMIN | `version`, `provider`, `trackingNumber`; optional `providerBookingId`, `parcelWeightKg`, `shippingCost`, `parcelDetails` |
| PATCH | `/orders/:id/shipments/:shipmentId` | ADMIN | `version`, `status`, `note` (5–500 characters) |
| POST | `/orders/:id/returns/request` | ADMIN | `version`, `reason`, `items: [{orderItemId, quantity}]` |
| POST | `/orders/:id/returns/:returnId/decision` | ADMIN | `version`, `approved` boolean, `note` |
| POST | `/orders/:id/returns/:returnId/receive` | ADMIN | `version`, `note`, `items: [{orderItemId, receivedQuantity, sellableQuantity}]` |
| POST | `/orders/:id/payments` | SUPER_ADMIN | `version`, `kind`, decimal-string `amount`, `provider`, unique `reference`, independent verification `evidence`; COD operations also require `shipmentId`; settlement optionally accepts decimal-string `fee` |

STAFF cannot mutate or export customer information. ADMIN handles operations.
All financial entries require SUPER_ADMIN. The existing global guard also checks
CSRF header/origin; checkout is not made public through these admin endpoints.

List/report/export filters: `q` (order number, name, phone, email; maximum 120
characters), `status`, `paymentStatus`, `paymentMethod`, inclusive `from` / `to`
in `YYYY-MM-DD`, and `sort=newest|oldest|total_desc|total_asc`. List additionally
accepts `page` (default 1) and `limit` (default 20, maximum 100). Date filters and
report buckets use Asia/Dhaka. CSV includes all matching rows, independent of
the visible page, and neutralizes spreadsheet formulas in customer-controlled cells.

Example status request:

```json
{"version": 0, "status": "CONFIRMED", "reason": "Customer confirmed by phone"}
```

## State and stock rules

- PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED.
- Dispatch requires a manual shipment record. It consumes active stock reservations
  and creates SALE movements atomically. Booking alone does not consume stock.
- Shipment transitions: MANUAL_BOOKED → IN_TRANSIT / CANCELLED;
  IN_TRANSIT → DELIVERED / FAILED; FAILED → IN_TRANSIT. Delivery updates the order.
  Retrying failed delivery does not consume stock a second time.
- Cancellation is allowed only before dispatch. It releases reservations and
  cancels manual shipment records. Payments remain in the ledger until a separately
  verified refund is recorded. Cancellation does not transfer funds.
- Delivered orders can request a return within `ORDER_RETURN_WINDOW_DAYS` (14 by
  default). Requested and previously received quantities cannot exceed ordered
  quantities. Rejected returns restore DELIVERED. Approved returns require receipt
  and inspection before stock or refund eligibility changes.
- Partial receipt leaves the order DELIVERED; full receipt sets RETURNED. One
  inspection closes that return record; any still-unreceived remainder needs a new
  request within the eligibility window. Unsellable received goods are refundable
  under this module's policy but are not restocked. Untracked stock creates no
  artificial inventory record. Receiving and refunding are separate operations.
- Serializable transactions, order-version compare-and-update, transaction retries,
  and idempotency records protect concurrent writes. Quantity/balance database
  checks provide additional protection. Order commercial/customer/address/item
  snapshots and final payment/audit records have database immutability guards.

## Accounting policy

Amounts are BDT decimal strings with at most two decimal places. No floating-point
arithmetic is used for ledger calculations. `paidTotal` is historical customer
receipts; `refundedTotal` is historical completed refunds. Neither is reset on
cancellation or return.

Payment `kind` values:

- `MANUAL_VERIFIED`: record an independently checked completed bank/mobile/manual
  transfer. Available for non-COD orders, including an ONLINE order whose payment
  was settled externally. Metadata explicitly records `ADMIN_MANUAL_EVIDENCE`;
  a transaction reference alone is insufficient and never means gateway verified.
- `COD_COLLECTION`: record customer money collected on a delivered COD shipment.
- `COD_SETTLEMENT`: record courier net remittance and withheld fees against that
  shipment's collected balance. Stored as a CAPTURE accounting entry; excluded
  from customer receipt totals to prevent double counting.
- `REFUND_RECORDED`: record evidence of an already completed, authorized external
  refund. This endpoint **does not initiate a refund or call a payment provider**.

Provider names are normalized to lowercase; provider/reference pairs are unique.
The module rejects overpayments, duplicate references and excessive settlements.
Refund eligibility is the lesser of paid funds and the cumulative value of
physically received return items, minus prior refunds. A cancelled order makes
its remaining collected balance refundable. Shipping is not refunded on returns;
cancelled orders can refund all collected funds. Cumulative rounding prevents
multiple partial returns from exceeding the original item value.

Reports use an order cohort selected by placed-date filters, not a cash-flow period.
Gross sales sum order totals. Net sales exclude cancelled orders and refunds on
non-cancelled orders, so cancelled-order refunds are not deducted twice. Paid/refund
totals come from SUCCEEDED ledger entries. Unpaid excludes cancelled orders.
Courier-held COD is collected minus net settled minus fees. Return rate counts
orders with positive physically received returns. Summaries use the same cohort
and ledger basis. Aggregation runs in PostgreSQL under a repeatable snapshot.

## Migrations and operation

1. `20261018090000_orders_operations`: adds return tables, RETURN_APPROVED and
   shipment parcel/COD fields. No existing data or columns are removed. New return
   quantities have database checks. Order/inventory/COD balance checks are installed
   NOT VALID to avoid a blocking historical scan while enforcing subsequent writes.
2. `20261018100000_order_snapshot_guards`: adds snapshot/final-ledger/audit guards.
   No financial or inventory balances are backfilled or modified.

Run `corepack pnpm --filter api exec prisma migrate deploy` in the target
environment after reviewing migration history and backups. Do not use db push or
reset. After a historical-data audit, validate NOT VALID constraints separately.
Legacy RETURN_REQUESTED/RETURNED orders whose returns existed only in timeline
events are not automatically converted into item-level records; reconcile those
historical records before any further stock/refund action. Existing stock or money
is never inferred or replayed from historical events.

Required configuration is documented in `apps/api/.env.example`. No gateway or
courier secrets are needed for manual operations. Configure admin
`NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1` for local use, with the matching
admin origin allowed by the API. Existing order creation retains the explicit
zero shipping/tax/discount policy until a pricing engine is configured; recorded
courier costs do not retroactively change immutable order totals.

Verification commands:

```powershell
corepack pnpm --filter api exec prisma validate
corepack pnpm --filter api build
corepack pnpm --filter api test:orders
corepack pnpm --filter api test:orders:http
corepack pnpm --filter api test --maxWorkers=1
corepack pnpm --filter admin build
```

`test:orders` creates/migrates only a separately named
`commerce_orders_validation_*` PostgreSQL database and inserts unique test fixtures.
It never resets or deletes development data. The HTTP test uses the compiled API,
real isolated admin sessions, global guard and DTO validation. Override
`ORDERS_TEST_DATABASE_URL` to choose another isolated database. Test users/sessions
are isolated; HTTP sessions are revoked after successful checks and expire quickly.

Deferred: live courier booking/webhooks; SSLCommerz, direct bKash, Nagad, Rocket;
automated payment verification and provider-executed refunds; storefront checkout
UI. Production deployment still requires environment-specific security/operational
review and a browser acceptance pass.
