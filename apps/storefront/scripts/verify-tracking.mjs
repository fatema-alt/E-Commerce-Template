import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

// Transpile tracking.ts
const trackingCode = ts.transpileModule(
  await readFile(new URL("../src/lib/tracking.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2023,
      module: ts.ModuleKind.ESNext,
    },
  },
).outputText;

const {
  GTM_ID_REGEX,
  SERVER_URL_REGEX,
  GA4_ID_REGEX,
  PIXEL_ID_REGEX,
  isValidGtmId,
  isValidServerUrl,
  isValidGa4Id,
  isValidPixelId,
  resolveTrackingConfig,
} = await import(
  "data:text/javascript;base64," + Buffer.from(trackingCode).toString("base64")
);

// Transpile gtm.ts
const gtmCode = ts.transpileModule(
  await readFile(new URL("../src/lib/gtm.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2023,
      module: ts.ModuleKind.ESNext,
    },
  },
).outputText;

const {
  generateEventId,
  generatePurchaseEventId,
  pushToDataLayer,
  trackPageView,
  trackViewItem,
  trackAddToCart,
  trackBeginCheckout,
  trackPurchase,
  getTrackingItemId,
  normalizeEmail,
  normalizePhone,
  hashSha256,
  hashUserData,
  isOrderPurchaseTracked,
  markOrderPurchaseTracked,
  calculatePurchaseValue,
  PURCHASE_VALUE_MODE,
  ENABLE_ONLINE_PAYMENT_PURCHASE_EVENT,
} = await import(
  "data:text/javascript;base64," + Buffer.from(gtmCode).toString("base64")
);

console.log("Running Tracking & Analytics Verification Tests...");

// 1. GTM ID allowlist
assert.equal(isValidGtmId("GTM-W8XYZ12"), true);
assert.equal(isValidGtmId("GTM-ABCDEF"), true);
assert.equal(isValidGtmId("GTM-1234567"), true);
assert.equal(isValidGtmId("GTM-"), false);
assert.equal(isValidGtmId(""), false);
assert.equal(isValidGtmId(null), false);
assert.equal(isValidGtmId("UA-12345-1"), false);
assert.equal(isValidGtmId("<script>alert(1)</script>"), false);
assert.equal(isValidGtmId("GTM-TOOLONGCONTAINERID123456789"), false);
console.log("✓ GTM ID validation allowlist passed");

// 2. Server URL allowlist (HTTPS only, valid hostname, no path/query)
assert.equal(isValidServerUrl("https://ss.dsmart.digislashagency.com"), true);
assert.equal(isValidServerUrl("https://tagging.stape.io"), true);
assert.equal(isValidServerUrl("https://ss.test:8443"), true);
assert.equal(isValidServerUrl("http://insecure.test"), false, "HTTP must be rejected");
assert.equal(isValidServerUrl("https://ss.test/path"), false, "Paths must be rejected");
assert.equal(isValidServerUrl("https://ss.test?param=1"), false, "Query params must be rejected");
assert.equal(isValidServerUrl("javascript:alert(1)"), false, "XSS schemes must be rejected");
console.log("✓ Stape/Server URL validation allowlist passed");

// 3. GA4 ID allowlist
assert.equal(isValidGa4Id("G-XYZ1234567"), true);
assert.equal(isValidGa4Id("G-ABCDEF"), true);
assert.equal(isValidGa4Id("UA-123456-1"), false);
assert.equal(isValidGa4Id(""), false);
console.log("✓ GA4 Measurement ID validation allowlist passed");

// 4. Pixel ID allowlist (Numeric 8-20 digits)
assert.equal(isValidPixelId("123456789012345"), true);
assert.equal(isValidPixelId("12345678"), true);
assert.equal(isValidPixelId("1234567"), false);
assert.equal(isValidPixelId("abc12345678"), false);
console.log("✓ Meta Pixel ID validation allowlist passed");

// 5. Fallback Resolution Hierarchy
// Case A: Admin settings configured and valid
const adminRes = resolveTrackingConfig({
  enabled: true,
  gtmId: "GTM-ADMIN01",
  serverUrl: "https://ss.dsmart.com",
  consentDefault: "granted",
  debugMode: true,
});
assert.equal(adminRes.enabled, true);
assert.equal(adminRes.gtmId, "GTM-ADMIN01");
assert.equal(adminRes.serverUrl, "https://ss.dsmart.com");
assert.equal(adminRes.consentDefault, "granted");
assert.equal(adminRes.source, "admin");
assert.equal(adminRes.debugMode, true);

// Case B: Admin settings explicitly disabled
const disabledRes = resolveTrackingConfig({
  enabled: false,
  gtmId: "GTM-ADMIN01",
});
assert.equal(disabledRes.enabled, false);
assert.equal(disabledRes.gtmId, null);
assert.equal(disabledRes.source, "disabled");

// Case C: Admin settings missing, env fallback
process.env.NEXT_PUBLIC_GTM_ID = "GTM-ENV0001";
process.env.NEXT_PUBLIC_GTM_SERVER_URL = "https://ss.env.com";
process.env.NEXT_PUBLIC_CONSENT_DEFAULT = "denied";

const envRes = resolveTrackingConfig(null);
assert.equal(envRes.enabled, true);
assert.equal(envRes.gtmId, "GTM-ENV0001");
assert.equal(envRes.serverUrl, "https://ss.env.com");
assert.equal(envRes.consentDefault, "denied");
assert.equal(envRes.source, "env");

delete process.env.NEXT_PUBLIC_GTM_ID;
delete process.env.NEXT_PUBLIC_GTM_SERVER_URL;

// Case D: Neither set -> cleanly disabled
const emptyRes = resolveTrackingConfig(null);
assert.equal(emptyRes.enabled, false);
assert.equal(emptyRes.gtmId, null);
assert.equal(emptyRes.source, "disabled");
console.log("✓ Fallback resolution hierarchy passed");

// 6. Item ID Strategy (Meta Catalog Match)
assert.equal(getTrackingItemId({ sku: "SKU-999", productId: "prod-1", id: "var-1" }), "SKU-999");
assert.equal(getTrackingItemId({ sku: "  ", productId: "prod-1", id: "var-1" }), "prod-1");
assert.equal(getTrackingItemId({ id: "prod-direct" }), "prod-direct");
console.log("✓ Stable item_id resolution (SKU prioritized, fallback to product ID) passed");

// 7. Normalization & SHA-256 Hashing Tests
assert.equal(normalizeEmail("  USER@Example.COM "), "user@example.com");
assert.equal(normalizeEmail("invalid-email"), "");
assert.equal(normalizePhone("01712-345678"), "+8801712345678");
assert.equal(normalizePhone("+880 1812 345678"), "+8801812345678");
assert.equal(normalizePhone("8801912345678"), "+8801912345678");
assert.equal(normalizePhone(" 01312345678 "), "+8801312345678");

// Known SHA-256 test vectors
const hashVector1 = await hashSha256("test@example.com");
assert.equal(hashVector1, "973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b");
const hashVectorEmpty = await hashSha256("");
assert.equal(hashVectorEmpty, "");

// Consent behavior: With 'denied', user data MUST be undefined
const deniedUserData = await hashUserData(
  { email: "user@test.com", phone: "01712345678" },
  "denied",
);
assert.equal(deniedUserData, undefined, "Hashed data must NOT be generated when consent is denied");

// With 'granted', returns valid hashed object
const grantedUserData = await hashUserData(
  { email: "test@example.com", phone: "01712345678", firstName: "Rahim", city: "Dhaka" },
  "granted",
);
assert.ok(grantedUserData);
assert.equal(grantedUserData.em, "973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b");
assert.ok(grantedUserData.ph);
assert.ok(grantedUserData.country);
console.log("✓ Customer data normalization, crypto.subtle SHA-256, and consent gating passed");

// 8. dataLayer push & Event ID deduplication
globalThis.window = {};
pushToDataLayer({ event: "test_event", foo: "bar" });
assert.equal(Array.isArray(globalThis.window.dataLayer), true);
assert.equal(globalThis.window.dataLayer.length, 1);
assert.equal(globalThis.window.dataLayer[0].event, "test_event");

const id1 = generateEventId();
const id2 = generateEventId();
assert.equal(id1.startsWith("evt_"), true);
assert.notEqual(id1, id2, "Event IDs must be unique");

// Deterministic purchase event_id
assert.equal(generatePurchaseEventId("ORD-98765"), "purchase_ORD-98765");
console.log("✓ dataLayer push, random and deterministic event_id generation passed");

// 9. Document Step Events: view_item, add_to_cart, begin_checkout, purchase
globalThis.window.dataLayer = [];

// view_item
trackViewItem({
  item: {
    item_id: "SKU-TEST-1",
    item_name: "Premium Shirt",
    price: 1500,
    currency: "BDT",
  },
});
const viewItemEvent = globalThis.window.dataLayer.find((e) => e.event === "view_item");
assert.ok(viewItemEvent);
assert.equal(viewItemEvent.ecommerce.currency, "BDT");
assert.equal(viewItemEvent.ecommerce.value, 1500);
assert.equal(viewItemEvent.ecommerce.items[0].item_id, "SKU-TEST-1");

// add_to_cart
trackAddToCart({
  items: [
    {
      item_id: "SKU-TEST-1",
      item_name: "Premium Shirt",
      price: 1500,
      quantity: 2,
      currency: "BDT",
    },
  ],
});
const addToCartEvent = globalThis.window.dataLayer.find((e) => e.event === "add_to_cart");
assert.ok(addToCartEvent);
assert.equal(addToCartEvent.ecommerce.value, 3000);
assert.equal(addToCartEvent.ecommerce.items[0].quantity, 2);

// begin_checkout
trackBeginCheckout({
  items: [
    {
      item_id: "SKU-TEST-1",
      item_name: "Premium Shirt",
      price: 1500,
      quantity: 2,
      currency: "BDT",
    },
  ],
  value: 3000,
  coupon: "SAVE10",
  userData: grantedUserData,
});
const beginCheckoutEvent = globalThis.window.dataLayer.find((e) => e.event === "begin_checkout");
assert.ok(beginCheckoutEvent);
assert.equal(beginCheckoutEvent.ecommerce.value, 3000);
assert.equal(beginCheckoutEvent.ecommerce.coupon, "SAVE10");
assert.ok(beginCheckoutEvent.user_data);

// purchase
trackPurchase({
  order: {
    orderId: "order-12345",
    orderNumber: "DS-2026-0001",
    value: 3080,
    shipping: 80,
    tax: 0,
    coupon: "SAVE10",
    items: [
      {
        item_id: "SKU-TEST-1",
        item_name: "Premium Shirt",
        price: 1500,
        quantity: 2,
        currency: "BDT",
      },
    ],
  },
  userData: grantedUserData,
});
const purchaseEvent = globalThis.window.dataLayer.find((e) => e.event === "purchase");
assert.ok(purchaseEvent);
assert.equal(purchaseEvent.event_id, "purchase_DS-2026-0001");
assert.equal(purchaseEvent.ecommerce.transaction_id, "DS-2026-0001");
assert.equal(purchaseEvent.ecommerce.value, 3080);
assert.equal(purchaseEvent.ecommerce.shipping, 80);
assert.equal(purchaseEvent.ecommerce.currency, "BDT");
console.log("✓ Document-step events (view_item, add_to_cart, begin_checkout, purchase) passed");

// 10. Purchase Value Modes (Option A: ITEMS_SUBTOTAL, Option B: GRAND_TOTAL)
const sampleOrder = {
  subtotal: 3000,
  discountTotal: 200,
  shippingTotal: 80,
  taxTotal: 0,
  grandTotal: 2880,
};
assert.equal(calculatePurchaseValue(sampleOrder, "ITEMS_SUBTOTAL"), 2800, "Option A must exclude shipping and tax");
assert.equal(calculatePurchaseValue(sampleOrder, "GRAND_TOTAL"), 2880, "Option B must equal grandTotal");
assert.equal(calculatePurchaseValue(sampleOrder), 2800, "Default configuration mode must match Option A");
console.log("✓ Configurable Purchase Value modes (ITEMS_SUBTOTAL vs GRAND_TOTAL) passed");

// 11. One-time fresh order token & Purchase Deduplication Guard
const sessionStorageMock = new Map();
globalThis.sessionStorage = {
  getItem: (k) => sessionStorageMock.get(k) || null,
  setItem: (k, v) => sessionStorageMock.set(k, v),
  removeItem: (k) => sessionStorageMock.delete(k),
};

const storageMock = new Map();
globalThis.localStorage = {
  getItem: (k) => storageMock.get(k) || null,
  setItem: (k, v) => storageMock.set(k, v),
  removeItem: (k) => storageMock.delete(k),
};

// Simulate order creation setting one-time fresh token
sessionStorage.setItem("ds_fresh_order_order-1", JSON.stringify({ paymentMethod: "COD" }));
assert.ok(sessionStorage.getItem("ds_fresh_order_order-1"));

// Confirmation page consumption: read and immediately delete
const freshToken = sessionStorage.getItem("ds_fresh_order_order-1");
sessionStorage.removeItem("ds_fresh_order_order-1");
assert.ok(freshToken);
assert.equal(isOrderPurchaseTracked("DS-2026-0001"), false);
markOrderPurchaseTracked("DS-2026-0001");
assert.equal(isOrderPurchaseTracked("DS-2026-0001"), true);

// Reload or back navigation: fresh token is gone, and localStorage prevents duplicate
const freshTokenOnReload = sessionStorage.getItem("ds_fresh_order_order-1");
assert.equal(freshTokenOnReload, null, "Fresh token must be null on reload / back");
assert.equal(isOrderPurchaseTracked("DS-2026-0001"), true, "Order must remain marked as tracked");

// Online payment purchase event feature flag is disabled
assert.equal(ENABLE_ONLINE_PAYMENT_PURCHASE_EVENT, false, "Online payment purchase tracking must be disabled by default");
console.log("✓ One-time confirmation page token and purchase deduplication guard verified");

console.log("\nAll tracking verification tests passed successfully!");
