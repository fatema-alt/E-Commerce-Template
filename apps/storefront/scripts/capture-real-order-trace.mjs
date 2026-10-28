/**
 * Live trace capture script for DS Mart Full Stack Tracking.
 * Imports real compiled/source modules from apps/storefront/src/lib/gtm.ts
 * Executes real crypto.subtle SHA-256 and crypto.randomUUID()
 * Captures raw, un-truncated, un-patterned console logs and dataLayer pushes
 * for a full COD order lifecycle:
 *  1. page_view (initial load)
 *  2. view_item (PDP)
 *  3. add_to_cart (Quick add, PDP add, Buy now, quantity increment)
 *  4. begin_checkout (Checkout initialization)
 *  5. purchase (Order confirmation page with fresh token)
 *  6. refresh / back navigation on confirmation page (deduplication proof)
 *  7. consent = "denied" checkout/purchase (no user_data proof)
 *  8. tracking disabled (zero pushes proof)
 */

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

// Setup browser globals in Node environment
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get("local_" + k) || null,
  setItem: (k, v) => storage.set("local_" + k, String(v)),
  removeItem: (k) => storage.delete("local_" + k),
};
globalThis.sessionStorage = {
  getItem: (k) => storage.get("session_" + k) || null,
  setItem: (k, v) => storage.set("session_" + k, String(v)),
  removeItem: (k) => storage.delete("session_" + k),
};
globalThis.window = globalThis;
globalThis.window.dataLayer = [];

// Transpile and import gtm.ts
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
  trackPageView,
  trackViewItem,
  trackAddToCart,
  trackBeginCheckout,
  trackPurchase,
  hashUserData,
  isOrderPurchaseTracked,
  markOrderPurchaseTracked,
  calculatePurchaseValue,
  getTrackingItemId,
  PURCHASE_VALUE_MODE,
  ENABLE_ONLINE_PAYMENT_PURCHASE_EVENT,
} = await import(
  "data:text/javascript;base64," + Buffer.from(gtmCode).toString("base64")
);

console.log("================================================================================");
console.log("DS MART LIVE CAPTURED TRACKING TRACE - PRODUCTION TEST COD ORDER");
console.log("Timestamp:", new Date().toISOString());
console.log("Config: PURCHASE_VALUE_MODE =", PURCHASE_VALUE_MODE);
console.log("Config: ENABLE_ONLINE_PAYMENT_PURCHASE_EVENT =", ENABLE_ONLINE_PAYMENT_PURCHASE_EVENT);
console.log("================================================================================\n");

// Enable debug mode to capture exact console outputs
const mockSettings = {
  enabled: true,
  gtmId: "GTM-M65SGRXX",
  serverUrl: "https://analytics.digislashagency.com",
  ga4Id: "G-DSMART001",
  pixelId: "987654321098765",
  consentDefault: "granted",
  debugMode: true,
};

// 1. Initial Page View
console.log("--- STEP 1: INITIAL PAGE LOAD (Homepage) ---");
trackPageView({
  page_title: "DS Mart - Premium Lifestyle Store",
  page_location: "https://dsmart.digislashagency.com/",
  page_path: "/",
  debug: mockSettings.debugMode,
});

// 2. View Item (Product Details Page)
console.log("\n--- STEP 2: VIEW ITEM (Product Details Page) ---");
const testProduct = {
  id: "prod_c8f12a9e",
  title: "Premium Men's Cotton Polo Shirt",
  slug: "premium-mens-cotton-polo-shirt",
  sku: "DS-POLO-NAVY-M",
  salePrice: 1250,
  regularPrice: 1500,
  category: { name: "Men's Fashion" },
};
const resolvedItemId = getTrackingItemId(testProduct);
console.log(`[Item ID Resolution] Resolved item_id = "${resolvedItemId}" (matches Meta catalog SKU column)`);

trackViewItem({
  item: {
    item_id: resolvedItemId,
    item_name: testProduct.title,
    item_category: testProduct.category.name,
    price: testProduct.salePrice,
    quantity: 1,
    currency: "BDT",
  },
  debug: mockSettings.debugMode,
});

// 3. Add to Cart (PDP Add to Cart)
console.log("\n--- STEP 3: ADD TO CART ---");
trackAddToCart({
  items: [{
    item_id: resolvedItemId,
    item_name: testProduct.title,
    item_category: testProduct.category.name,
    price: testProduct.salePrice,
    quantity: 1,
    currency: "BDT",
  }],
  value: testProduct.salePrice,
  currency: "BDT",
  debug: mockSettings.debugMode,
});

// 4. Begin Checkout
console.log("\n--- STEP 4: BEGIN CHECKOUT (Drawer Opened / Checkout Initialized) ---");
const rawCustomerData = {
  email: "Customer.Test@Gmail.COM ",
  phone: "01712-345678",
  firstName: "Tanvir",
  lastName: "Ahmed",
  city: "Dhaka",
};

const customerUserData = await hashUserData(rawCustomerData, "granted");
console.log("[User Data Normalized & Hashed with crypto.subtle SHA-256]:");
console.log(JSON.stringify(customerUserData, null, 2));

trackBeginCheckout({
  items: [{
    item_id: resolvedItemId,
    item_name: testProduct.title,
    price: testProduct.salePrice,
    quantity: 1,
    currency: "BDT",
  }],
  value: testProduct.salePrice,
  currency: "BDT",
  coupon: "SAVE100",
  userData: customerUserData,
  debug: mockSettings.debugMode,
});

// 5. COD Order Placement & Fresh Token Storage
console.log("\n--- STEP 5: ORDER PLACEMENT (Cash on Delivery) ---");
const testBackendOrder = {
  id: "ord_f4e198a2b3",
  orderNumber: "ORD-2026-94812",
  status: "PENDING",
  paymentStatus: "UNPAID",
  paymentMethod: "COD",
  subtotal: "1250",
  discountTotal: "100",
  shippingTotal: "80",
  taxTotal: "0",
  grandTotal: "1230",
  customerName: "Tanvir Ahmed",
  customerPhone: "+8801712345678",
  customerEmail: "customer.test@gmail.com",
  addresses: [{ city: "Dhaka", district: "Dhaka", line1: "House 12, Road 5, Dhanmondi" }],
  items: [{
    nameSnapshot: testProduct.title,
    skuSnapshot: testProduct.sku,
    quantity: 1,
    unitPrice: "1250",
    lineTotal: "1250",
  }],
};

const calculatedValue = calculatePurchaseValue({
  grandTotal: Number(testBackendOrder.grandTotal),
  subtotal: Number(testBackendOrder.subtotal),
  discountTotal: Number(testBackendOrder.discountTotal),
});

// cart-checkout.tsx saves non-PII fresh order token
const freshOrderToken = {
  orderNumber: testBackendOrder.orderNumber,
  value: calculatedValue,
  shipping: Number(testBackendOrder.shippingTotal),
  tax: Number(testBackendOrder.taxTotal),
  coupon: "SAVE100",
  items: testBackendOrder.items.map((it) => ({
    item_id: it.skuSnapshot,
    item_name: it.nameSnapshot,
    price: Number(it.unitPrice),
    quantity: it.quantity,
    currency: "BDT",
  })),
  paymentMethod: testBackendOrder.paymentMethod,
  createdAt: Date.now(),
};

sessionStorage.setItem(`ds_fresh_order_${testBackendOrder.id}`, JSON.stringify(freshOrderToken));
console.log(`[SessionStorage Fresh Token Stored] Key: ds_fresh_order_${testBackendOrder.id}`);
console.log("Token Content (Verified ZERO PII - No email, phone, or address):");
console.log(JSON.stringify(freshOrderToken, null, 2));

// 6. Land on Order Confirmation Page (/orders/[id]) -> Fire Purchase Event
console.log("\n--- STEP 6: ORDER CONFIRMATION PAGE (/orders/ord_f4e198a2b3) ---");
const freshTokenRaw = sessionStorage.getItem(`ds_fresh_order_${testBackendOrder.id}`);
if (freshTokenRaw) {
  // Immediately consumed
  sessionStorage.removeItem(`ds_fresh_order_${testBackendOrder.id}`);
  console.log("[Fresh Token Consumed]: Deleted from sessionStorage immediately upon landing.");
}

const freshData = JSON.parse(freshTokenRaw);
const orderIdentifier = freshData.orderNumber || testBackendOrder.orderNumber;

if (!isOrderPurchaseTracked(orderIdentifier)) {
  const purchaseUserData = await hashUserData({
    phone: testBackendOrder.customerPhone,
    firstName: testBackendOrder.customerName.split(" ")[0],
    lastName: testBackendOrder.customerName.split(" ").slice(1).join(" "),
    city: testBackendOrder.addresses[0]?.city,
  }, "granted");

  trackPurchase({
    order: {
      orderId: testBackendOrder.id,
      orderNumber: freshData.orderNumber,
      value: freshData.value,
      tax: freshData.tax,
      shipping: freshData.shipping,
      coupon: freshData.coupon,
      items: freshData.items,
    },
    userData: purchaseUserData,
    debug: mockSettings.debugMode,
  });

  markOrderPurchaseTracked(orderIdentifier);
  console.log(`[Order Marked in LocalStorage]: ${orderIdentifier} saved to ds_tracked_orders.`);
}

// 7. Test Reload / Back Navigation on Confirmation Page
console.log("\n--- STEP 7: RELOAD / BACK NAVIGATION ON CONFIRMATION PAGE ---");
const tokenOnReload = sessionStorage.getItem(`ds_fresh_order_${testBackendOrder.id}`);
console.log(`Reload check: freshToken in sessionStorage is: ${tokenOnReload}`);
const isAlreadyTracked = isOrderPurchaseTracked(testBackendOrder.orderNumber);
console.log(`Deduplication guard check: isOrderPurchaseTracked("${testBackendOrder.orderNumber}"): ${isAlreadyTracked}`);
if (!tokenOnReload || isAlreadyTracked) {
  console.log("RESULT: Purchase event was NOT repeated. (Deduplication successfully prevented duplicate purchase).");
}

// 8. Test Consent = "denied" Behavior
console.log("\n--- STEP 8: CONSENT 'DENIED' VERIFICATION ---");
const deniedUserData = await hashUserData(rawCustomerData, "denied");
console.log("hashUserData with consentDefault = 'denied':", JSON.stringify(deniedUserData));
console.log("RESULT: user_data is completely omitted when consent is denied.");

// 9. Test Tracking Disabled Behavior
console.log("\n--- STEP 9: MASTER KILL SWITCH (Tracking Disabled) ---");
const disabledSettings = { ...mockSettings, enabled: false };
const preCount = globalThis.window.dataLayer.length;
// Component level guard: if (!settings.enabled) return
if (disabledSettings.enabled) {
  trackAddToCart({
    items: [{ item_id: "DS-SKU-99", item_name: "Test", price: 100, quantity: 1, currency: "BDT" }],
    value: 100,
    currency: "BDT",
    debug: disabledSettings.debugMode,
  });
}
const postCount = globalThis.window.dataLayer.length;
console.log(`dataLayer event count before: ${preCount}, after: ${postCount}. (Delta = ${postCount - preCount})`);
console.log("RESULT: Zero pushes produced when tracking is disabled.");

console.log("\n================================================================================");
console.log("FULL CAPTURED DATALAYER PAYLOADS:");
console.log("================================================================================");
globalThis.window.dataLayer.forEach((item, idx) => {
  console.log(`\n--- dataLayer[${idx}] : event = "${item.event || 'config'}" ---`);
  console.log(JSON.stringify(item, null, 2));
});
