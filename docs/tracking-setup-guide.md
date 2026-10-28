# DS Mart Full-Stack Tracking Setup & Operations Guide

This guide details the complete implementation and deployment instructions for Google Tag Manager (GTM), Google Analytics 4 (GA4), Meta Pixel, and Server-Side Conversions API (CAPI) on DS Mart (`https://dsmart.digislashagency.com`).

---

## 1. Architecture Overview

```
Storefront (Next.js 16 App Router)
  ├── Server-rendered layout injects GTM Async Loader & Consent Mode v2 default
  ├── dataLayer pushes: page_view, view_item, add_to_cart, begin_checkout, purchase
  ├── SHA-256 hashed customer data (email lowercase/trim, phone E.164 +880)
  │
  ├── Browser Pixel: Meta Pixel Base & Event Tags (client-side)
  │
  └── GTM Web Container (GTM-XXXXXXX)
        └── GA4 Tag (sends events with event_id + user_data)
              │
              ▼
        Server Container / Stape.io (https://analytics.digislashagency.com)
              ├── GA4 Client
              ├── GA4 Server Tag
              └── Meta Conversions API (CAPI) Tag
                    └── Deduplicated via shared event_id (e.g. purchase_<orderNumber>)
```

---

## 2. Admin Panel Configuration

Navigate to **Storefront CMS** > **Tracking & Pixels** (`/cms/tracking`):

1. **Enable Tracking**: Turn the master toggle ON.
2. **GTM Web Container ID**: Enter your GTM Container ID (e.g., `GTM-M65SGRXX`).
3. **Server Container / Tagging URL**: Enter your custom Stape.io or Cloud Run tagging URL (e.g., `https://analytics.digislashagency.com`). Leave empty for direct Google CDN loader.
4. **Consent Mode v2 Default**:
   - `denied` (Strict privacy: Google tags run in cookieless ping mode until banner consent).
   - `granted` (Standard Bangladeshi e-commerce default).
5. **GA4 Measurement ID & Meta Pixel ID**: Enter for team reference and diagnostics.
6. **Save Draft & Publish**: Click "Save Draft". An administrator with `SUPER_ADMIN` privileges clicks "Publish latest saved version".
   - Confirm the live prompt: *"This changes tracking on the live store"*.

> [!CAUTION]
> **Zero Secrets Policy**: Meta CAPI access tokens, GA4 API secrets, and server container credentials must **NEVER** be stored in the admin panel, database, or repository. Configure them exclusively in your Stape / Server Container settings.

---

## 3. GTM Web Container Import Instructions (Draft Starting Point)

> [!WARNING]
> **Container File Status**: `docs/tracking-gtm-web-container.json` is a starting draft template.
> **DO NOT USE OVERWRITE**: Always import into a **new, dedicated test workspace** (e.g., `DS Mart Tracking Test`) using **Merge** > **Rename conflicting tags, triggers, and variables**. Never select "Overwrite" on an existing or production workspace.

1. Open [Google Tag Manager](https://tagmanager.google.com/) and navigate to your Web Container.
2. Create a new workspace: Click **Default Workspace** > **+** > Name it `DS Mart Tracking Setup`.
3. Go to **Admin** > **Import Container**.
4. Select the file: `docs/tracking-gtm-web-container.json`.
5. Choose **Existing workspace** > select `DS Mart Tracking Setup`.
6. Select **Merge** > **Rename conflicting tags, triggers, and variables**.
7. In **Variables**:
   - Update `Const - GA4 Measurement ID` with your actual GA4 ID (e.g. `G-XXXXXXXXXX`).
   - Update `Const - Meta Pixel ID` with your actual Meta Dataset ID (e.g. `123456789012345`).
8. Review Tags:
   - `Google Tag - GA4 Config & Server Tagging URL` (fires on All Pages)
   - `GA4 Event - page_view` (fires on `Event - page_view (Client Navigation)`)
   - `GA4 Event - view_item` (fires on `Event - view_item`)
   - `GA4 Event - add_to_cart` (fires on `Event - add_to_cart`)
   - `GA4 Event - begin_checkout` (fires on `Event - begin_checkout`)
   - `GA4 Event - purchase` (fires on `Event - purchase`)
   - `Meta Pixel - Base Code & PageView` (fires on All Pages + Client Navigation)
   - `Meta Pixel - ViewContent`
   - `Meta Pixel - AddToCart`
   - `Meta Pixel - InitiateCheckout`
   - `Meta Pixel - Purchase`
9. Test thoroughly using GTM Preview (see Section 7) before publishing.

---

## 4. GTM Server Container & Stape Setup (Draft Starting Point)

> [!WARNING]
> **Container File Status**: `docs/tracking-gtm-server-container.json` is a starting draft template.
> GTM Server Containers require template gallery imports that cannot be fully bundled in offline JSON exports. Follow the manual configuration steps below.

### Mandatory Manual Configurations in Server Container:
1. **Community Gallery Templates**:
   - In GTM Server Container, navigate to **Templates** > **Tag Templates** > **Search Gallery**.
   - Search for **"Meta Conversions API"** (by `facebookincubator` or `stape-io`) and click **Add to workspace**.
   - If hosting with Stape.io, also install the **"Stape Client"** or **"Data Client"** template from the gallery.
2. **Provisioning Server Environment**:
   - In [Stape.io](https://stape.io) or Google Cloud Run, provision your server container.
   - Point your custom subdomain (e.g., `analytics.digislashagency.com`) with a verified SSL certificate.
3. **Container Import**:
   - Go to **Admin** > **Import Container** > choose `docs/tracking-gtm-server-container.json`.
   - Select a new workspace with **Merge** > **Rename conflicting**.
4. **Secret Configuration (Server Container Only)**:
   - In the Meta Conversions API tag:
     - Enter your **Meta CAPI Access Token** (generated from Meta Events Manager > Datasets > Settings > Generate Access Token).
     - Enter your **Meta Pixel/Dataset ID**.
     - Verify `Event ID` is mapped to `{{Event ID}}` for browser-server deduplication.
     - For testing, enter the `test_event_code` from Meta Test Events tab (remove before live production launch).
   - In the GA4 Client / Tag:
     - Configure your GA4 Measurement ID and GA4 API Secret (if using measurement protocol).

---

## 5. Owner Checklist & Mandatory Configurations

### A. Google Analytics 4 (GA4) Enhanced Measurement Setting
> [!IMPORTANT]
> To prevent duplicate pageviews on single-page navigation:
> 1. Go to **GA4** > **Admin** > **Data Streams** > click your Web Stream.
> 2. Click the gear icon under **Enhanced measurement**.
> 3. Click **Show advanced settings** under *Page views*.
> 4. **UNCHECK / DISABLE "Page changes based on browser history events"**.
> 5. Click **Save**.

### B. Meta Catalog Content ID Mapping
> [!IMPORTANT]
> DS Mart resolves item identifiers using:
> `item_id = variant.sku || product.sku || product.id`
> 1. In **Meta Commerce Manager** > **Catalogs** > **Data Sources**, check your product feed settings.
> 2. Ensure the **`id`** field in your catalog matches the product **SKU** (with fallback to Product ID).
> 3. This guarantees a 100% catalog match rate for `ViewContent`, `AddToCart`, and `Purchase` events.

### C. Meta Pixel Tag Consent Checks
In the imported GTM Web Container, all Meta tags have *Additional Consent Checks* configured to require `ad_storage` consent. If consent default is `denied`, Meta tags will not fire until consent is granted.

---

## 6. Purchase Value Mode Configuration

Located in `apps/storefront/src/lib/gtm.ts`:
```ts
export const PURCHASE_VALUE_MODE: PurchaseValueMode = "ITEMS_SUBTOTAL";
```
- **`ITEMS_SUBTOTAL` (Option A, GA4 Recommended)**:
  `value` = sum of items after discounts (excluding shipping and tax). Shipping and tax are transmitted in their own parameters (`shipping`, `tax`).
- **`GRAND_TOTAL` (Option B)**:
  `value` = grand total returned by backend (items + shipping + tax - discounts).

The chosen setting applies uniformly across GA4, Meta Pixel, and Server CAPI.

---

## 7. Step-by-Step Owner Pre-Flight Test Order Checklist

Before directing live advertising traffic to the store, execute this verification checklist to validate the end-to-end tracking pipeline across GTM Preview, GA4 DebugView, and Meta Test Events.

### Phase 1: Set Up Monitoring Consoles
- [ ] **1. GTM Web Preview**: Open GTM Web Container, click **Preview**, enter `https://dsmart.digislashagency.com`, and click **Connect**.
- [ ] **2. GTM Server Preview**: In your GTM Server Container, click **Preview** (or open Stape live logs).
- [ ] **3. Meta Test Events**: In Meta Events Manager > Data Sources > select your Dataset > **Test Events** tab.
  - Copy the `test_event_code` (e.g., `TEST12345`).
  - Set it in your GTM Server Meta CAPI tag's `test_event_code` parameter.
- [ ] **4. GA4 DebugView**: In Google Analytics > **Admin** > **DebugView** (under Data display).

### Phase 2: User Journey & Event Verification
- [ ] **5. First Page Load (`page_view`)**:
  - The storefront lands on the homepage.
  - In GTM Preview: Verify `Initialization` / `Consent` sets default consent, and `Google Tag` loads.
  - Verify exactly **ONE** `page_view` is recorded on first load (no duplicate from Enhanced Measurement).
  - Check browser console: Debug mode logs `[Analytics GTM] push: { event: "page_view", ... }`.
- [ ] **6. Product Details Page (`view_item`)**:
  - Click any product to open the product page.
  - In GTM Preview: Verify custom `page_view` fires on navigation.
  - Verify `view_item` event fires once with:
    - `currency`: `"BDT"`
    - `value`: product price
    - `items[0].item_id`: product SKU (or product ID)
    - `items[0].item_name`: product title
  - Switch product variants (e.g. size/color): Verify `view_item` does NOT fire duplicate events.
- [ ] **7. Add to Cart (`add_to_cart`)**:
  - Test all 4 entry points:
    1. PDP "Add to Cart" button -> `add_to_cart` fires with selected item.
    2. PDP "Buy Now" button -> `add_to_cart` fires and opens checkout drawer.
    3. Product Card "Quick Add" (+) on catalog grid -> `add_to_cart` fires.
    4. In Cart drawer, increment item quantity (+) -> `add_to_cart` fires for the added unit.
- [ ] **8. Begin Checkout (`begin_checkout`)**:
  - Proceed to the checkout screen.
  - Verify `begin_checkout` fires with full cart items array, `currency: "BDT"`, and subtotal `value`.
  - Verify customer data in `begin_checkout` contains SHA-256 hashed data if consent is `granted`, or omitted if consent is `denied`.
- [ ] **9. Complete Cash on Delivery (COD) Order (`purchase`)**:
  - Select payment method **Cash on Delivery (COD)** and click "Place Order".
  - Verify browser redirects to the confirmation page (`/orders/[id]`).
  - Verify `purchase` event fires **ONCE** on `/orders/[id]` with:
    - `transaction_id`: Backend Order Number (e.g. `ORD-XXXX-XXXX`)
    - `event_id`: Deterministic ID (`purchase_ORD-XXXX-XXXX`)
    - `value`: Configured order value (net items or grand total per `PURCHASE_VALUE_MODE`)
    - `currency`: `"BDT"`
    - `shipping`: Backend shipping charge (e.g. `80` or `150`)
    - `tax`: `0`
    - `coupon`: Applied coupon code (if any)
    - `items`: Snapshot items list

### Phase 3: Deduplication & Platform Validations
- [ ] **10. Meta Event Deduplication**:
  - In Meta Events Manager > **Test Events** tab:
  - Find the `Purchase` event.
  - Verify it shows **Both (Browser & Server)** with status **"Deduplicated"**.
  - Verify the `event_id` matches exactly between Browser Pixel and Server CAPI.
- [ ] **11. GA4 DebugView Verification**:
  - Check real-time timeline in GA4 DebugView.
  - Confirm `page_view`, `view_item`, `add_to_cart`, `begin_checkout`, and `purchase` appear in exact sequence.
  - Click `purchase` to inspect parameters: `currency: "BDT"`, `transaction_id`, `value`, `items`.

### Phase 4: Edge Cases & Guards
- [ ] **12. Reload & Back Navigation Deduplication**:
  - On the `/orders/[id]` confirmation page, click **Refresh (F5)**.
  - Verify NO duplicate `purchase` event is pushed to dataLayer.
  - Click **Back** in browser and then **Forward** back to `/orders/[id]`.
  - Verify NO duplicate `purchase` event is pushed (guarded by consumed fresh token and `localStorage["ds_tracked_orders"]`).
- [ ] **13. Order History Guard**:
  - Navigate to **Account** > **Orders** and click an old historical order.
  - Verify `purchase` NEVER fires for past orders.
- [ ] **14. Consent Default Check**:
  - In Admin `/cms/tracking`, set consent default to `denied`, save draft, and publish.
  - In incognito window, place an order.
  - Verify dataLayer event does NOT contain `user_data` (customer personal data omitted).
- [ ] **15. Master Kill Switch**:
  - In Admin `/cms/tracking`, toggle "Enable tracking" OFF, save draft, and publish.
  - In storefront, inspect DOM: verify no GTM `<script>` or `<noscript>` iframe is injected, and dataLayer receives no events.
