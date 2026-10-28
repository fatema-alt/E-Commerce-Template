import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const code = ts.transpileModule(
  await readFile(new URL("../src/lib/analytics.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2023,
      module: ts.ModuleKind.ESNext,
    },
  },
).outputText;
const { trafficSource, trackEvent } = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);
assert.equal(trafficSource("", "https://store.test", ""), "direct");
assert.equal(
  trafficSource("https://store.test/shop", "https://store.test", ""),
  "direct",
);
assert.equal(
  trafficSource("https://www.google.co.uk/search", "https://store.test", ""),
  "organic",
);
assert.equal(
  trafficSource("https://m.facebook.com/", "https://store.test", ""),
  "social",
);
assert.equal(
  trafficSource(
    "https://example.test/",
    "https://store.test",
    "?utm_medium=email",
  ),
  "email",
);
assert.equal(
  trafficSource("https://example.test/", "https://store.test", ""),
  "referral",
);
// Initial events must wait for the first response to establish the session cookie.
const originalFetch = globalThis.fetch;
const originalNavigator = Object.getOwnPropertyDescriptor(
  globalThis,
  "navigator",
);
let release;
const calls = [];
globalThis.window = {};
globalThis.document = { referrer: "" };
globalThis.location = { origin: "https://store.test", search: "" };
Object.defineProperty(globalThis, "navigator", {
  value: { doNotTrack: "0" },
  configurable: true,
});
globalThis.fetch = async (url, options) => {
  calls.push(JSON.parse(options.body));
  if (calls.length === 1)
    await new Promise((resolve) => {
      release = resolve;
    });
  return {};
};
trackEvent("PAGE_VIEW");
trackEvent("PRODUCT_VIEW");
await delay(10);
assert.equal(calls.length, 1);
release();
await delay(10);
assert.equal(calls.length, 2);
navigator.doNotTrack = "1";
trackEvent("CHECKOUT");
await delay(10);
assert.equal(calls.length, 2);
delete globalThis.window;
delete globalThis.document;
delete globalThis.location;
if (originalNavigator)
  Object.defineProperty(globalThis, "navigator", originalNavigator);
globalThis.fetch = originalFetch;

const events = [];
const secret = randomUUID();
const upstream = createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  if (req.url === "/api/v1/shop/analytics")
    events.push({
      body: JSON.parse(body),
      secret: req.headers["x-commerce-tracking"],
    });
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end('{"ok":true}');
});
await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
const portProbe = createServer();
await new Promise((resolve) => portProbe.listen(0, "127.0.0.1", resolve));
const port = portProbe.address().port;
await new Promise((resolve) => portProbe.close(resolve));
const origin = "http://localhost:" + port;
const server = spawn(
  process.execPath,
  [resolve("node_modules/next/dist/bin/next"), "start", "--port", String(port)],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      STOREFRONT_ORIGIN: origin,
      STOREFRONT_API_BASE_URL:
        "http://127.0.0.1:" + upstream.address().port + "/api/v1",
      STOREFRONT_CHECKOUT_SECRET: secret,
    },
    windowsHide: true,
    stdio: "ignore",
  },
);
try {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(origin + "/api/analytics");
      if (r.status === 405) break;
    } catch {}
    await delay(100);
  }
  async function event(originHeader, body, cookie = "") {
    return fetch(origin + "/api/analytics", {
      method: "POST",
      headers: {
        Origin: originHeader,
        "Content-Type": "application/json",
        "X-Storefront-Request": "1",
        Cookie: cookie,
      },
      body: JSON.stringify(body),
    });
  }
  const payload = { id: randomUUID(), kind: "PAGE_VIEW", source: "organic" };
  assert.equal((await event("https://wrong.test", payload)).status, 403);
  assert.equal(
    (await event(origin, { ...payload, kind: "PURCHASE" })).status,
    400,
  );
  assert.equal((await event(origin, null)).status, 400);
  const first = await event(origin, payload);
  assert.equal(first.status, 200);
  const cookie = first.headers.getSetCookie()[0];
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=lax/i);
  const sessionCookie = cookie.split(";")[0];
  assert.equal(
    (
      await event(
        origin,
        {
          ...payload,
          id: randomUUID(),
          kind: "PRODUCT_VIEW",
          source: "direct",
        },
        sessionCookie,
      )
    ).status,
    200,
  );
  assert.equal(events.length, 2);
  assert.equal(events[0].body.sessionId, events[1].body.sessionId);
  assert.equal(events[0].secret, secret);
  assert.deepEqual(Object.keys(events[0].body).sort(), [
    "id",
    "kind",
    "sessionId",
    "source",
  ]);
  const privateFields = {
    email: 'private@example.invalid', phone: 'PRIVATE_PHONE',
    ip: '198.51.100.10', address: 'PRIVATE_ADDRESS',
    referrer: 'https://example.invalid/?email=private@example.invalid',
  };
  assert.equal((await event(origin, { ...payload, id: randomUUID(), ...privateFields })).status, 200);
  assert.deepEqual(Object.keys(events.at(-1).body).sort(), ['id', 'kind', 'sessionId', 'source']);
  for (const value of Object.values(privateFields)) assert.ok(!JSON.stringify(events.at(-1).body).includes(value));
  assert.equal((await first.text()).includes(secret), false);
  console.log(
    "PASS: traffic classification, serialized initial events, Do Not Track, same-origin validation, allowed event types, opaque HttpOnly sessions, server-only secret, bounded analytics payload; email/phone/IP/address/referrer fields are not forwarded.",
  );
} finally {
  server.kill();
  await new Promise((resolve) => upstream.close(resolve));
}
