/**
 * Google Tag Manager & DataLayer Helper for DS Mart.
 *
 * Rules:
 * - Must NEVER break shopping or user experience (safe wrappers, non-blocking).
 * - Pushes conform strictly to GA4 ecommerce standard with currency "BDT".
 * - Generates unique event_id shared between browser Pixel and server CAPI for deduplication.
 * - Customer data is SHA-256 hashed and normalized; only pushed when consent is 'granted'.
 * - Purchase fires exactly once per order (guarded by localStorage and deterministic event_id).
 * - Respects debug mode for console verification.
 */

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

/**
 * Feature flag: Online payment purchase tracking.
 * Kept disabled until payment verification fixes are completed.
 * When false, online payment orders do NOT fire purchase on creation or gateway redirect.
 */
export const ENABLE_ONLINE_PAYMENT_PURCHASE_EVENT = false;

/**
 * Purchase Value Mode Configuration:
 * - 'ITEMS_SUBTOTAL' (Option A, GA4 recommended): value = items subtotal after discounts (excluding tax and shipping).
 * - 'GRAND_TOTAL' (Option B): value = grandTotal including shipping and tax.
 *
 * In both modes, shipping and tax are sent in their own respective parameters.
 * The chosen mode applies consistently across GA4, Meta Pixel, and Server CAPI.
 */
export type PurchaseValueMode = "ITEMS_SUBTOTAL" | "GRAND_TOTAL";
export const PURCHASE_VALUE_MODE: PurchaseValueMode = "ITEMS_SUBTOTAL";

export function calculatePurchaseValue(
  order: { grandTotal: number; subtotal: number; discountTotal?: number },
  mode: PurchaseValueMode = PURCHASE_VALUE_MODE,
): number {
  if (mode === "ITEMS_SUBTOTAL") {
    const discount = order.discountTotal || 0;
    return Math.max(0, order.subtotal - discount);
  }
  return order.grandTotal;
}

export interface TrackingEcommerceItem {
  item_id: string;
  item_name: string;
  price: number;
  quantity?: number;
  item_brand?: string;
  item_category?: string;
  item_variant?: string;
  currency?: string;
}

export interface HashedUserData {
  em?: string;
  ph?: string;
  fn?: string;
  ln?: string;
  ct?: string;
  country?: string;
}

export interface TrackingOrderData {
  orderId: string;
  orderNumber?: string;
  value: number; // Backend order total amount
  tax?: number;
  shipping?: number;
  coupon?: string;
  items: TrackingEcommerceItem[];
}

/**
 * Resolves a single, stable item_id matching the Meta Catalog Content ID.
 * Priority: SKU (if present), falling back to product ID or database ID.
 */
export function getTrackingItemId(item: {
  sku?: string | null;
  productId?: string | null;
  id?: string | null;
}): string {
  const sku = item.sku?.trim();
  if (sku) return sku;
  return (item.productId?.trim() || item.id?.trim() || "").trim();
}

/**
 * Generate a random cryptographically secure event_id for client events.
 * Format: evt_<timestamp>_<random>
 */
export function generateEventId(prefix = "evt"): string {
  try {
    const rand = crypto.randomUUID().replace(/-/g, "");
    return `${prefix}_${Date.now()}_${rand}`;
  } catch {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
  }
}

/**
 * Generate a deterministic event_id for purchase events based on order number.
 * Shared by both browser Pixel and server CAPI for exact deduplication.
 */
export function generatePurchaseEventId(orderIdentifier: string): string {
  const sanitized = orderIdentifier.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  return `purchase_${sanitized}`;
}

/**
 * Safe dataLayer push helper.
 * Always safe to call in any context (browser or SSR, initialized or not).
 * Catches and suppresses any error to ensure shopping is never blocked.
 */
export function pushToDataLayer(
  eventData: Record<string, unknown>,
  options?: { debug?: boolean },
): void {
  if (typeof window === "undefined") return;

  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(eventData);

    if (options?.debug) {
      // eslint-disable-next-line no-console
      console.log("[DS Mart GTM dataLayer]", eventData);
    }
  } catch (err) {
    if (options?.debug) {
      // eslint-disable-next-line no-console
      console.warn("[DS Mart GTM dataLayer Error]", err);
    }
  }
}

/**
 * Standard GA4 / GTM PageView event.
 */
export function trackPageView(params: {
  page_path: string;
  page_title?: string;
  page_location?: string;
  event_id?: string;
  debug?: boolean;
}): string {
  const event_id = params.event_id || generateEventId();
  const page_location =
    params.page_location ||
    (typeof window !== "undefined" ? window.location.href : "");
  const page_title =
    params.page_title ||
    (typeof document !== "undefined" ? document.title : "");

  // 1. Clear previous ecommerce state (GA4 recommended practice)
  pushToDataLayer({ ecommerce: null }, { debug: params.debug });

  // 2. Push standard page_view event
  pushToDataLayer(
    {
      event: "page_view",
      page_path: params.page_path,
      page_title,
      page_location,
      event_id,
      event_time: Math.round(Date.now() / 1000),
      first_party_collection: true,
    },
    { debug: params.debug },
  );

  return event_id;
}

/**
 * Normalize email according to Meta & Google CAPI specification:
 * Trim leading/trailing whitespace and convert to lowercase.
 */
export function normalizeEmail(email?: string | null): string {
  if (!email) return "";
  const trimmed = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : "";
}

/**
 * Normalize phone number to E.164 international format (+880 for Bangladesh):
 * Strips all non-digit characters and ensures +880 country code.
 */
export function normalizePhone(phone?: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";

  // 13 digits starting with 880 (e.g. 8801712345678)
  if (digits.startsWith("880") && digits.length === 13) {
    return `+${digits}`;
  }
  // 11 digits starting with 01 (standard Bangladeshi mobile e.g. 01712345678)
  if (digits.startsWith("01") && digits.length === 11) {
    return `+88${digits}`;
  }
  // 10 digits starting with 1 (e.g. 1712345678)
  if (digits.startsWith("1") && digits.length === 10) {
    return `+880${digits}`;
  }
  // Already international format with leading +
  if (phone.trim().startsWith("+") && digits.length >= 8) {
    return `+${digits}`;
  }
  return digits.length >= 8 ? `+${digits}` : "";
}

/**
 * Standard cryptographic SHA-256 using crypto.subtle (async, secure contexts).
 * Returns lowercase hex string, with safe no-op fallback on error or insecure context.
 */
export async function hashSha256(text: string): Promise<string> {
  if (!text) return "";
  if (
    typeof crypto !== "undefined" &&
    crypto.subtle &&
    typeof crypto.subtle.digest === "function"
  ) {
    try {
      const data = new TextEncoder().encode(text);
      const buffer = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      return "";
    }
  }
  return ""; // Safe no-op fallback
}

/**
 * Hashes customer data according to Meta CAPI & Google Advanced Matching requirements.
 * RULE: Pushed only when consent is explicitly "granted". With "denied", returns undefined.
 */
export async function hashUserData(
  data: {
    email?: string | null;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    city?: string | null;
  },
  consentDefault?: string,
): Promise<HashedUserData | undefined> {
  if (consentDefault !== "granted") {
    // Strictly omit customer data when consent is denied or not granted
    return undefined;
  }

  const em = normalizeEmail(data.email);
  const ph = normalizePhone(data.phone);
  const fn = data.firstName?.trim().toLowerCase() || "";
  const ln = data.lastName?.trim().toLowerCase() || "";
  const ct = data.city?.trim().toLowerCase() || "";

  const [hashedEm, hashedPh, hashedFn, hashedLn, hashedCt, hashedCountry] =
    await Promise.all([
      hashSha256(em),
      hashSha256(ph),
      hashSha256(fn),
      hashSha256(ln),
      hashSha256(ct),
      hashSha256("bd"),
    ]);

  const result: HashedUserData = {};
  if (hashedEm) result.em = hashedEm;
  if (hashedPh) result.ph = hashedPh;
  if (hashedFn) result.fn = hashedFn;
  if (hashedLn) result.ln = hashedLn;
  if (hashedCt) result.ct = hashedCt;
  if (hashedCountry) result.country = hashedCountry;

  return Object.keys(result).length > 1 ? result : undefined;
}

/**
 * Standard GA4 view_item event.
 */
export function trackViewItem(params: {
  item: TrackingEcommerceItem;
  event_id?: string;
  debug?: boolean;
}): string {
  const event_id = params.event_id || generateEventId();
  const value = params.item.price * (params.item.quantity || 1);

  pushToDataLayer({ ecommerce: null }, { debug: params.debug });
  pushToDataLayer(
    {
      event: "view_item",
      event_id,
      event_time: Math.round(Date.now() / 1000),
      ecommerce: {
        currency: "BDT",
        value,
        items: [params.item],
      },
    },
    { debug: params.debug },
  );

  return event_id;
}

/**
 * Standard GA4 add_to_cart event.
 */
export function trackAddToCart(params: {
  items: TrackingEcommerceItem[];
  value?: number;
  event_id?: string;
  debug?: boolean;
}): string {
  const event_id = params.event_id || generateEventId();
  const totalValue =
    params.value ??
    params.items.reduce((sum, it) => sum + it.price * (it.quantity || 1), 0);

  pushToDataLayer({ ecommerce: null }, { debug: params.debug });
  pushToDataLayer(
    {
      event: "add_to_cart",
      event_id,
      event_time: Math.round(Date.now() / 1000),
      ecommerce: {
        currency: "BDT",
        value: totalValue,
        items: params.items,
      },
    },
    { debug: params.debug },
  );

  return event_id;
}

/**
 * Standard GA4 begin_checkout event.
 */
export function trackBeginCheckout(params: {
  items: TrackingEcommerceItem[];
  value: number;
  coupon?: string;
  userData?: HashedUserData;
  event_id?: string;
  debug?: boolean;
}): string {
  const event_id = params.event_id || generateEventId();

  pushToDataLayer({ ecommerce: null }, { debug: params.debug });
  pushToDataLayer(
    {
      event: "begin_checkout",
      event_id,
      event_time: Math.round(Date.now() / 1000),
      ...(params.userData ? { user_data: params.userData } : {}),
      ecommerce: {
        currency: "BDT",
        value: params.value,
        coupon: params.coupon || undefined,
        items: params.items,
      },
    },
    { debug: params.debug },
  );

  return event_id;
}

/**
 * Standard GA4 purchase event with deterministic event_id.
 * Value represents backend grand total (items + shipping + tax - discounts).
 */
export function trackPurchase(params: {
  order: TrackingOrderData;
  userData?: HashedUserData;
  debug?: boolean;
}): string {
  const orderIdentifier = params.order.orderNumber || params.order.orderId;
  const event_id = generatePurchaseEventId(orderIdentifier);

  pushToDataLayer({ ecommerce: null }, { debug: params.debug });
  pushToDataLayer(
    {
      event: "purchase",
      event_id,
      event_time: Math.round(Date.now() / 1000),
      ...(params.userData ? { user_data: params.userData } : {}),
      ecommerce: {
        transaction_id: orderIdentifier,
        value: params.order.value,
        currency: "BDT",
        tax: params.order.tax || 0,
        shipping: params.order.shipping || 0,
        coupon: params.order.coupon || undefined,
        items: params.order.items,
      },
    },
    { debug: params.debug },
  );

  return event_id;
}

/**
 * localStorage Deduplication Guard for purchase tracking.
 * Pruned to keep last 90 days and max 50 orders.
 */
export const TRACKED_ORDERS_STORAGE_KEY = "ds_tracked_orders";
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_TRACKED_ORDERS = 50;

interface TrackedOrderEntry {
  id: string;
  t: number;
}

function readTrackedOrders(): TrackedOrderEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TRACKED_ORDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Support legacy string arrays or modern object arrays
    return parsed.map((item) =>
      typeof item === "string" ? { id: item, t: Date.now() } : item,
    );
  } catch {
    return [];
  }
}

export function isOrderPurchaseTracked(orderId: string): boolean {
  if (typeof window === "undefined" || !orderId) return false;
  try {
    const list = readTrackedOrders();
    return list.some((entry) => entry.id === orderId);
  } catch {
    return false;
  }
}

export function markOrderPurchaseTracked(orderId: string): void {
  if (typeof window === "undefined" || !orderId) return;
  try {
    const now = Date.now();
    const list = readTrackedOrders();
    if (list.some((entry) => entry.id === orderId)) return;

    // Prune entries older than 90 days
    const fresh = list.filter((entry) => now - entry.t < NINETY_DAYS_MS);
    fresh.push({ id: orderId, t: now });

    // Cap at MAX_TRACKED_ORDERS
    const trimmed = fresh.slice(-MAX_TRACKED_ORDERS);
    localStorage.setItem(
      TRACKED_ORDERS_STORAGE_KEY,
      JSON.stringify(trimmed),
    );
  } catch {
    // Non-blocking: Storage failure must never block order completion
  }
}
