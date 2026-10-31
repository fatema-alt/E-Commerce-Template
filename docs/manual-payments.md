# Manual bKash, Nagad and bank transfer

Implemented on `feat/manual-payments` from main `8b80cdf`. No Prisma schema or migration changes, API subscriptions, simulated payments, or production settings/data changes are required by this feature.

## Owner setup

1. Sign in as **SUPER_ADMIN**, then open **Settings → Payments** (`/settings/payments`).
2. Under **Manual bKash & Nagad**, enter your actual recipient account name and mobile number. Select **Personal — Send Money** or **Merchant — Payment**, matching your real account. Add any instructions customers need, enable the channel and save. Incomplete or invalid enabled accounts are rejected by the server.
3. Configure the existing **Bank Transfer** card with your real bank name, account name, account number, branch/routing details and optional instructions. Enable and save it.
4. Leave **bKash Tokenized Checkout** and **SSLCommerz** disabled until you have working API credentials. These are separate from the new manual channels. No existing live settings are changed automatically. COD remains an independent option.

Only enabled channels with complete recipient information appear at checkout. The existing online Options A/B/C require an active API gateway; they are not applied to manual transfers. Manual transfers cover the full outstanding order total after the server calculates products, coupons and shipping. There is no online-payment discount for a manual transfer.

## Customer flow

1. Select **bKash (manual)**, **Nagad (manual)** or **Bank Transfer**, fill in delivery details and place the order.
2. The order page shows recipient details, transfer type and the exact outstanding amount. Customers should verify the recipient in their payment app before sending. Account instructions are saved with the order so later settings changes do not redirect an existing order to another account.
3. Transfer using the selected service, then submit the sender mobile/account identifier and completed transaction ID/bank reference on that order page. Never request a PIN, OTP or password.
4. The customer sees **awaiting verification**. A claim alone does **not** increase `paidTotal` or mark the order paid. A failed submission keeps the form input so it can be retried. Reloading the order retrieves the submitted claim from the server.

An order with unavailable saved instructions tells the customer to contact the team before transferring. Paid, cancelled and returned orders do not show a payment form. Pending claims block another reference submission. A rejected claim shows the customer the rejection reason and allows a different reference to be submitted; the same reference cannot be reused to evade rejection.

## Admin verification

Open **Orders → the order → Payment and COD accounting**. Pending customer claims show provider, sender, reference and amount.

- Independently check the actual receipt in your mobile/bank account. Enter verification evidence and choose **Confirm verified transfer**. Confirming requires SUPER_ADMIN, an idempotency key and the current order revision. It updates the existing pending ledger transaction to succeeded and credits the verified amount once; it does not create a second transfer.
- If receipt cannot be verified, enter a customer-safe reason and choose **Reject payment claim**. Rejection leaves balances unchanged. The reason is visible to the customer; do not put private account information in it.
- Existing manually verified accounting entries remain available for payments handled outside the customer submission form. Refund accounting records a refund already executed outside the application; it does not send funds.

## Data and safeguards

- Uses existing `PaymentGatewayConfig` records (`MANUAL_BKASH`, `MANUAL_NAGAD`, `BANK_TRANSFER`), `Order.paymentOption`, payment transactions and order events. Mobile manual orders use the existing `MANUAL` payment method.
- Recipient snapshots use `MANUAL_PAYMENT_INSTRUCTIONS` order events. Claims use `PAYMENT/PENDING` ledger entries tagged `CUSTOMER_CLAIM_PENDING`; sender identifiers are stored in their metadata for authorized admin review. Shopper responses expose only account instructions, references, amounts, statuses, dates and rejection reasons, not internal verification evidence or session identifiers.
- Shopper submission is scoped to the owning browser session or signed-in customer, validates input, is throttled and passes through the existing same-origin storefront proxy. Transaction references are canonicalized and unique per provider across orders. Serializable transactions and order revision increments protect concurrent review/submission.
- Payment settings and financial approval/rejection require SUPER_ADMIN. Existing audit events and revision/idempotency checks are reused for admin accounting.
- No automatic provider verification or real transfer is executed. The team must reconcile receipts and cancel unpaid orders/reservations through the existing order workflow; this change does not add automatic expiry, refunds or bank reconciliation.
- Old orders created before recipient snapshots were introduced require staff assistance if no instructions are available. Updating account settings does not change snapshots on existing orders.

## Verification

API tests: `cd apps/api; node node_modules/vitest/vitest.mjs run src/shop/manual-payments.spec.ts src/shop/shop.service.spec.ts src/payments/payments.spec.ts src/orders/order.rules.spec.ts src/shop/shipping-boundary.spec.ts`.

Build API with `node node_modules/@nestjs/cli/bin/nest.js build`; build each Next app from its directory with `node node_modules/next/dist/bin/next build --webpack`.

After both Next builds, run `node scripts/verify-manual-payments.mjs` from the repository root. It starts isolated local fixtures and production servers, uses an isolated Chrome/Edge profile and checks recipient settings save, checkout channels, manual order creation, failed submission retaining input, pending state without credit, rejection feedback, approval and the paid state. It also checks horizontal overflow and captures screenshots at 1366px and 390px. It uses no database or real payment service; screenshots are ignored under `.manual-payment-check/`.

Validation on 2026-10-31: **72/72 targeted API tests passed**; API production type check/build, admin type check/build and storefront type check/build passed. The final browser suite passed all flows and both widths; screenshots were visually inspected, including a corrected checkout option layout. Encoding and whitespace checks passed. API unit tests use mocked persistence and browser tests use in-memory API fixtures; a PostgreSQL-backed payment run and an actual money transfer were not performed. No live recipient has been configured or enabled by this work. The broad API test-inclusive TypeScript configuration has an existing cross-app `rootDir` issue in the hero-slide test imports; the production API build excludes those tests and passes.
