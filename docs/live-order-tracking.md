# Live order tracking

Customers can open `/track`, enter their full order number and checkout phone number, and see a restricted delivery timeline. Bangla digits, local and +880 phone formats are accepted. A signed 24-hour tracking token authorizes subsequent reads; phone numbers stay out of URLs and browser storage. Internal notes, private reasons, addresses and payment references are excluded. Existing `/orders` pages also refresh every 15 seconds while visible and online. A failed refresh preserves the last received result.

## Setup

1. Apply the migration with `pnpm --filter api exec prisma migrate deploy`, and regenerate the Prisma client with `pnpm --filter api exec prisma generate` when building.
2. Configure a stable `COURIER_CREDENTIALS_KEY` of at least 32 characters (or the existing `STOREFRONT_CHECKOUT_SECRET`). Keep this key across deployments. Credentials are encrypted with AES-256-GCM. Changing the key requires entering credentials again.
3. As SUPER_ADMIN, open **Settings → Courier & Live Tracking**. Save and enable each merchant connection: Steadfast API key/secret key; Pathao client ID/client secret/merchant username/password; RedX access token. Blank saved fields preserve their values. Steadfast uses the live API; Pathao and RedX offer Sandbox/Live selection.
4. Test the saved connection using a real courier tracking number. Record the shipment in the existing order workflow with provider `Steadfast`, `Pathao` or `RedX`, its tracking number and optional consignment/booking ID. Booking references must be courier consignment IDs for automated lookups, not an unrelated merchant invoice.

The API worker polls up to 40 active shipments every minute, four at a time. Reads through `/track` also request a refresh when its 60-second cache expires. A database claim prevents repeated polling across API replicas. `COURIER_TRACKING_POLLING=false` disables background polling, while on-demand refresh still works. A courier failure retains the last status and marks the refresh delayed. Unknown courier names retain the manual workflow.

Courier status is displayed separately from the store's order status. Automatic tracking never changes inventory, order fulfillment, payment receipts or COD accounting. The existing admin workflow remains responsible for those operations. This is shipment status tracking, not a GPS map or automatic parcel booking.

## Provider contracts and verification

Adapters use Steadfast status-by-tracking-code/consignment endpoints, Pathao OAuth and order-info, and RedX parcel-info. Merchant-specific credentials and live responses must be checked using **Test tracking** before enabling production. No real merchant credentials were supplied during implementation, so tests use mocked responses. Public merchant documentation can be access restricted; account-specific API contracts must be confirmed in each merchant panel.

Reference documentation: [Steadfast authored API document](https://www.scribd.com/document/984642512/SteadFast-Courier-Limited-API-Documentation), [Pathao Merchant API document](https://hackmd.io/@saikat/HyX7Wa2eR), [RedX authored API document](https://www.scribd.com/document/1031765577/Redx-Merchant-API-Document-Reseller-v5-5).

## Validation

Run `pnpm --filter api test -- --maxWorkers=1 src/tracking/tracking.spec.ts` for credential encryption, access-token expiry, phone validation, private-field filtering, synchronization claims, failure recovery and the three HTTP adapters. API, admin and storefront TypeScript checks cover integration types. Integration with real couriers requires merchant API credentials and the migration above.
