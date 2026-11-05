# Purchasing flow redesign

## Architecture and implementation

The audit found a shared cart/checkout component, browser cart storage, scoped shopper APIs, signed quotes, transactional inventory reservations, scoped order idempotency, manual payment review, and configured bKash/SSLCommerz gateway adapters. These remain authoritative; no replacement payment service, database model, or migration was needed. Existing quote and checkout APIs accept an optional delivery-area choice.

- `CartDrawer` is mounted in the store layout. Existing cart links open the native modal in place, including CMS/footer links. It supports focus containment/restoration, Escape, outside click, close button, reduced motion, and full-height mobile presentation. The old `/cart` route remains a compatibility entry that opens the drawer, without a redirect or a standalone cart UI.
- `CartCheckout` retains quote retrieval, variant repair, cart mutations, signed-price submission, stock-error recovery, and analytics. The drawer renders server-quoted unit prices, line prices, and product subtotal only. Delivery, tax, discounts, coupons, and grand total belong to checkout/payment.
- `/checkout` collects contact and delivery details through `CheckoutCustomerFields`, validates required name, Bangladesh phone, delivery area, address, city and district, and stores only checkout details/coupon in session storage. Continuing creates no order. Storage failure blocks continuation with an actionable message.
- Fresh checkout leaves delivery area unselected and displays a pending delivery charge, with a product-only interim subtotal. Typing city/district does not select a zone. The customer explicitly chooses Inside Dhaka or Outside Dhaka; that choice is bound into the signed quote and revalidated in transactional pricing. Legacy API clients can still use address-based rate inference. Free-delivery thresholds remain authoritative.
- `/checkout/payment` restores and checks the draft, refreshes server pricing, and displays only configured plans and payment methods. `PaymentMethodSelector` provides category buttons and selectable cards, with configured logo assets and a typographic fallback on unavailable images. `PaymentInstructions` renders configured account details and sanitized instructions. No payment plan is preselected. Full-payment discounts and pay-now/delivery breakdowns appear only after an explicit plan selection. Sender/reference values are never included in the checkout draft.
- Full payment, partial advance and COD remain conditional on backend availability. Enabled bKash/SSLCommerz gateways retain their existing secure redirect/callback flow. Manual bank/mobile submissions await verification; entering a reference never credits payment.
- A synchronous submission lock prevents rapid repeated submissions. A SHA-256 payload digest and idempotency key survive interrupted sessions without storing the payment reference or full order payload in session storage. Changed payloads receive a different key. Successful creation clears the cart and checkout draft.
- `/order-success/[orderId]` reuses the scoped order loader and purchase analytics. `OrderSuccess` displays saved financial/address data and distinguishes verification pending, rejected, unpaid and paid states. Invalid/inaccessible orders show the existing access-aware error. Tracking and payment recovery remain on `/orders/[id]`. Successful gateway returns use the new confirmation route; failed initiation retains the existing recovery screen.
- Pending manual confirmations show the submitted transfer/advance separately from verified paid funds, alongside the submitted reference. Partial advances show the stored delivery balance as payable after advance verification, rather than labeling the entire unverified order value as the delivery balance. Approved partial orders show the credited amount and remaining delivery balance. No payment status or ledger entry is changed by this display.

## Files and routes

New components: `cart-drawer.tsx`, `checkout-customer-fields.tsx`, `payment-method-selector.tsx`, `payment-instructions.tsx`, `order-success.tsx`.

Modified components: `cart-checkout.tsx`, `shopping-actions.tsx`, `account-orders.tsx`; shared store layout, purchasing styles, robots rules and the legacy cart route. Added cart metadata layout. Updated the existing order route to forward successful gateway returns.

Added routes: `/checkout/payment`, `/order-success/[orderId]`. No API routes were added or removed. `/cart` is retained solely for compatible drawer entry; normal cart clicks stay on the current page.

## Verification

- Storefront production build and TypeScript checks pass.
- Targeted ESLint for affected components/routes passes without warnings.
- 70 API unit tests pass across pricing, delivery rules, checkout payment review and signed shopper checkout/access.
- The updated `scripts/verify-checkout-redesign.mjs` runs isolated frontend fixtures, never a live database or transfer. It covers cart totals/quantities/removal/empty state, dismissal/focus, checkout/payment separation, payment plans/categories, duplicate references, successful pending creation, review/rejection/resubmission/approval, invalid IDs, missing drafts and gateway-return routing. The suite also checks unselected delivery/payment states, zone switching, and equal contact-input heights/alignment. Screenshots and overflow checks cover desktop/mobile and light/dark presentation under ignored `.payment-redesign/`.
- Encoding checks pass. Production builds require access to the project's existing Google Fonts downloads.

## Remaining deployment checks

No implementation blocker remains. Real merchant credentials, live transfers, production database order creation and deployed courier behavior were not exercised. Verify those in the existing staging payment workflow before rollout. Existing API/payment configuration and previously documented payment migrations remain deployment prerequisites; this change introduces no new migrations.
