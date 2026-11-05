# Order management and customer images

- Customer order thumbnails now use the same media URL resolver as catalog products. Raw `/uploads/...` URLs point to the API/media origin, rather than the storefront origin. Existing external images, legacy localhost rewriting, reserved dimensions and missing-image fallback remain supported.
- All Orders rows offer **Update status** and **Manage payment**. Both open a focused modal without leaving the list. It loads the current order/version and admin role, and reuses existing order-status, cancellation, payment verification, COD and refund endpoints. Status transitions retain existing lifecycle restrictions. Payment status follows verified ledger actions, rather than an unrestricted status override.
- Payment submission approval/rejection and accounting are centralized in All Orders. Order Details retains the payment summary and links to `/orders?manage=<id>` for actions. Existing SUPER_ADMIN financial permissions remain enforced by the backend and UI. Rejection requires a reason.
- The list distinguishes awaiting verification and rejected submissions using the latest submission status. The API list response adds only that minimal status summary; no database migration or new mutation endpoint is required.
- Mutations use synchronous submission locking, optimistic order revisions and stable retry idempotency keys. Successful changes refresh both list data and sales reports. Conflicts refresh the displayed order version before another action.
- Details show shorter UUID-shaped order headings with the full official reference available on hover. Timeline and technical/source sections are collapsed initially. Sales reports are also collapsed on All Orders so the operational list remains prominent.

## Validation

Admin, storefront and API production builds pass. Targeted ESLint passes. Fifty API unit tests pass across order details, order financial rules, manual payment review and scoped shopper order access.

Targeted API Oxlint completes with two existing warnings outside the changed list selection: class-instance spreading and a template-expression type warning in `orders.service.ts`.

The isolated browser suite in `scripts/verify-checkout-redesign.mjs` verifies loaded customer image dimensions using intercepted image fixtures; absence of approval controls on Details; review/reject/approve from All Orders; customer resubmission; direct status updates and list refresh; and desktop/mobile layouts. It also retains the existing purchasing-flow regressions. No live order, transfer or production database was changed by these checks.

Deploy both frontends and the API together to expose the latest-submission badges and updated controls. No new migration is needed.
