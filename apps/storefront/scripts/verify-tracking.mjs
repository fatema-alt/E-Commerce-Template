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
  pushToDataLayer,
  trackPageView,
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

// Clean env
delete process.env.NEXT_PUBLIC_GTM_ID;
delete process.env.NEXT_PUBLIC_GTM_SERVER_URL;

// Case D: Neither set -> cleanly disabled
const emptyRes = resolveTrackingConfig(null);
assert.equal(emptyRes.enabled, false);
assert.equal(emptyRes.gtmId, null);
assert.equal(emptyRes.source, "disabled");
console.log("✓ Fallback resolution hierarchy passed");

// 6. dataLayer push & Event ID deduplication
globalThis.window = {};
pushToDataLayer({ event: "test_event", foo: "bar" });
assert.equal(Array.isArray(globalThis.window.dataLayer), true);
assert.equal(globalThis.window.dataLayer.length, 1);
assert.equal(globalThis.window.dataLayer[0].event, "test_event");

const id1 = generateEventId();
const id2 = generateEventId();
assert.equal(id1.startsWith("evt_"), true);
assert.notEqual(id1, id2, "Event IDs must be unique");

// 7. PageView tracking push
globalThis.document = { title: "DS Mart Home" };
globalThis.window.location = { href: "https://dsmart.digislashagency.com/" };
const pageViewEventId = trackPageView({ page_path: "/" });
assert.equal(typeof pageViewEventId, "string");
assert.equal(pageViewEventId.startsWith("evt_"), true);

// Check that dataLayer has ecommerce null reset + page_view event
const events = globalThis.window.dataLayer;
assert.equal(events.some((e) => e.ecommerce === null), true);
const pageView = events.find((e) => e.event === "page_view");
assert.ok(pageView, "page_view event must be in dataLayer");
assert.equal(pageView.page_path, "/");
assert.equal(pageView.page_title, "DS Mart Home");
assert.equal(pageView.first_party_collection, true);
assert.equal(typeof pageView.event_time, "number");
console.log("✓ dataLayer push, event_id deduplication, and page_view tests passed");

console.log("\nAll tracking verification tests passed successfully!");
