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

## 3. GTM Web Container Import Instructions

1. Open [Google Tag Manager](https://tagmanager.google.com/) and navigate to your Web Container.
2. Go to **Admin** > **Import Container**.
3. Select the file: `docs/tracking-gtm-web-container.json`.
4. Choose **Existing workspace** (or create a new workspace named `DS Mart Tracking`).
5. Choose **Merge** > **Rename conflicting tags, triggers, and variables**.
6. In **Variables**:
   - Update `Const - GA4 Measurement ID` with your actual GA4 ID (e.g. `G-XXXXXXXXXX`).
   - Update `Const - Meta Pixel ID` with your actual Meta Dataset ID (e.g. `123456789012345`).
7. Review Tags:
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
8. Click **Submit** to publish the container.

---

## 4. GTM Server Container & Stape Setup

1. In [Stape.io](https://stape.io) or Google Cloud Run, provision your server tagging container.
2. Map your custom domain: `analytics.digislashagency.com` with an SSL certificate.
3. In GTM Server Container, import `docs/tracking-gtm-server-container.json`.
4. In the `Meta Conversions API (CAPI)` tag:
   - Enter your **Meta CAPI Access Token** (generated from Meta Events Manager > Datasets > Settings > Generate Access Token).
   - Verify `Event ID` is mapped to `{{Event ID}}` for browser-server deduplication.

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

## 7. Verification & Diagnostic Testing

1. **GTM Preview Mode**:
   - Open GTM Web Container, click **Preview**, enter `https://dsmart.digislashagency.com`.
   - Verify:
     - First page load: Google Tag fires `Container Loaded` (exactly 1 pageview).
     - Navigating between pages: custom `page_view` fires (exactly 1 pageview per navigation).
     - Viewing a product: `view_item` fires once (selecting different variants does not refire).
     - Clicking "Add to Cart" or "Buy Now": `add_to_cart` fires with product items.
     - Cart quantity increase: `add_to_cart` fires with the incremented quantity.
     - Checkout drawer / page: `begin_checkout` fires.
     - Placing a COD order: Redirects to `/orders/[id]` (confirmation page); `purchase` fires once. Refreshing or navigating back never duplicates the purchase event.
2. **Meta Test Events**:
   - In Meta Events Manager > Test Events, enter your site URL.
   - Place a test COD order.
   - Confirm events show **"Deduplicated"** between Browser (Pixel) and Server (CAPI) with identical `event_id` (`purchase_<orderNumber>`).
3. **GA4 DebugView**:
   - In GA4 > Admin > DebugView, confirm real-time timeline displays `page_view`, `view_item`, `add_to_cart`, `begin_checkout`, and `purchase` with `currency: "BDT"`.
