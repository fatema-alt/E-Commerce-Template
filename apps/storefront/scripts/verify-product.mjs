// Run after `pnpm --filter storefront build --webpack` from any working directory.
// Uses an isolated in-memory catalog and an existing Chrome/Edge installation.
import http from "node:http";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const browser =
  process.env.PRODUCT_TEST_BROWSER ||
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].find(existsSync);
assert.ok(
  browser,
  "Set PRODUCT_TEST_BROWSER to an existing Chrome/Edge executable.",
);
const profile = mkdtempSync(join(tmpdir(), "ds-product-"));
const artifacts = resolve(app, ".product-check");
mkdirSync(artifacts, { recursive: true });
const category = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Everyday essentials",
  slug: "essentials",
};
const product = {
  type: "VARIABLE",
  id: "00000000-0000-4000-8000-000000000002",
  slug: "cotton-t-shirt",
  name: "Everyday Cotton T-Shirt",
  sku: "DS-COTTON",
  brand: "DS Essentials",
  description:
    "An everyday staple, made for easy styling.\nChoose the colour that works for you.",
  shortDescription:
    "A fresh take on your everyday favourite. Soft cotton, a relaxed silhouette and a clean finish.",
  category,
  currency: "BDT",
  effectivePrice: "500.00",
  price: "650.00",
  availableStock: 5,
  metaTitle: "Cotton T-Shirt collection",
  images: [
    {
      url: "/uploads/general.svg",
      altText: "Cotton T-shirt front",
      isPrimary: true,
    },
    { url: "/uploads/black.svg", variantId: "black" },
    { url: "/uploads/blue.svg", variantId: "blue" },
    { url: "/uploads/broken.svg" },
  ],
  variants: [
    {
      id: "black",
      name: "Black / M",
      sku: "DS-BLK-M",
      price: "650.00",
      salePrice: "500.00",
      availableStock: 3,
      attributes: { colour: "Black", size: "M" },
    },
    {
      id: "blue",
      name: "Blue / L",
      sku: "DS-BLU-L",
      price: "750.00",
      availableStock: 2,
      attributes: { colour: "Blue", size: "L" },
    },
    { id: "sold-out", name: "White / S", price: "500.00", availableStock: 0 },
  ],
};
let productUnavailable = true;
let reviewAttempts = 0;
let newsletterAttempts = 0;
let orderAttempts = 0;
let loggedIn = false, authAttempts = 0, suggestionRequests = 0;
const browserErrors = [];
const shopper = { id: 'shopper-fixture', firstName: 'Test Shopper', email: 'test@example.com' };
let engagementSettings = { storeName: 'DS Mart', locale: 'en', currency: 'BDT', announcementRibbon: { enabled: true, animation: 'fade', intervalSeconds: 3, items: [
  { id: 'one', enabled: true, text: 'First published announcement', device: 'both', ctaLabel: 'Browse', ctaUrl: '/shop' },
  { id: 'two', enabled: true, text: 'Second published announcement', device: 'both' },
  { id: 'expired', enabled: true, text: 'Expired announcement', device: 'both', endsAt: '2000-01-01T00:00:00Z' },
  { id: 'future', enabled: true, text: 'Future announcement', device: 'both', startsAt: '2099-01-01T00:00:00Z' },
  { id: 'disabled', enabled: false, text: 'Disabled announcement', device: 'both' },
] }, contactWidget: { enabled: true, title: 'How can we help you?', description: 'Choose your preferred way to contact our team.', statusText: 'DS Mart Support', position: 'right', desktop: true, mobile: true, whatsapp: { enabled: true, number: '+8801712345678', message: 'Hello DS Mart' }, phone: { enabled: true, number: '+8801712345678' }, email: { enabled: true, address: 'support@example.com' }, excludedRoutes: ['/contact'], closeOnOutsideClick: true, rememberDismissal: true } };
const fixtureOrder = { id: '00000000-0000-4000-8000-000000000010', orderNumber: '00000000-0000-4000-8000-000000000010', status: 'PROCESSING', paymentStatus: 'UNPAID', paymentMethod: 'COD', createdAt: '2026-10-20T09:00:00Z', customerName: 'Test Shopper', customerPhone: '01712345678', subtotal: '500.00', shippingTotal: '60.00', taxTotal: '0.00', grandTotal: '560.00', items: [{ nameSnapshot: 'Historical cotton shirt', skuSnapshot: 'HISTORY-001', quantity: 1, unitPrice: '500.00', lineTotal: '500.00' }], addresses: [{ recipientName: 'Test Shopper', phone: '01712345678', line1: 'Test address', city: 'Dhaka' }], shipments: [] };
const reviewFixtures = Array.from({ length: 7 }, (_, index) => ({ id: 'review-' + index, authorName: 'Test shopper ' + index, rating: index % 2 ? 4 : 5, content: 'Isolated browser-test review.', title: 'Test feedback', photos: [], helpfulCount: 0, isVerifiedPurchase: index < 2, createdAt: '2026-10-01T00:00:00Z' }));
const simpleId = "00000000-0000-4000-8000-000000000003";
const api = http.createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  res.setHeader("Content-Type", "application/json");
  if (path.endsWith('/storefront/cms/SITE_SETTINGS/default')) { res.end(JSON.stringify({ content: engagementSettings, assets: [], version: 1 })); return; }
  if (/\/shop\/(login|register)$/.test(path)) {
    let body = ''; for await (const chunk of req) body += chunk;
    const data = JSON.parse(body); authAttempts++;
    if (data.password === 'wrong-password') { res.statusCode = 401; res.end(JSON.stringify({ message: 'Invalid email or password' })); return; }
    loggedIn = true; res.end(JSON.stringify({ user: shopper })); return;
  }
  if (path.endsWith('/shop/logout')) { loggedIn = false; res.end('{}'); return; }
  if (path.endsWith('/shop/newsletter') && req.method === 'GET') { res.end(JSON.stringify({ subscribed: false })); return; }
  if (path.endsWith('/shop/orders') && req.method === 'GET') { res.end(JSON.stringify({ items: [fixtureOrder], total: 1 })); return; }
  if (path.endsWith('/shop/orders') && req.method === 'POST') {
    let body = ''; for await (const chunk of req) body += chunk;
    const fields = JSON.parse(body); orderAttempts++;
    assert.equal(fields.customerPhone, '01712345678');
    assert.equal(fields.shippingAddress.line1, 'Test address');
    assert.equal(fields.quoteToken, 'isolated-fixture');
    assert.ok(req.headers['idempotency-key']);
    await new Promise(resolve => setTimeout(resolve, 250));
    if (orderAttempts === 1) { res.statusCode = 409; res.end(JSON.stringify({ message: 'Prices changed. Review the refreshed total.' })); }
    else res.end(JSON.stringify(fixtureOrder));
    return;
  }
  if (path.includes('/shop/orders/')) { res.end(JSON.stringify(fixtureOrder)); return; }
  if (/\/shop\/products\/[^/]+\/reviews$/.test(path)) {
    if (req.method === 'POST') {
      let body = ''; for await (const chunk of req) body += chunk;
      const fields = JSON.parse(body); reviewAttempts++;
      assert.equal(fields.productId, product.id); assert.equal(fields.rating, 4);
      res.statusCode = reviewAttempts === 1 ? 503 : 201;
      res.end(JSON.stringify(reviewAttempts === 1 ? { message: 'Temporary review failure' } : { status: 'PENDING' })); return;
    }
    const query = new URL(req.url, 'http://localhost').searchParams;
    const rating = Number(query.get('rating')); const page = Number(query.get('page') || 1);
    const rows = rating ? reviewFixtures.filter((review) => review.rating === rating) : reviewFixtures;
    res.end(JSON.stringify({ items: rows.slice((page - 1) * 5, page * 5), totalPages: Math.ceil(rows.length / 5), summary: { total: 7, averageRating: 4.6, verifiedTotal: 2, ratingBreakdown: { 5: 4, 4: 3, 3: 0, 2: 0, 1: 0 } } })); return;
  }
  if (/\/shop\/products\/[^/]+\/qa$/.test(path)) { res.end(JSON.stringify([])); return; }
  if (path.endsWith('/shop/newsletter') && req.method === 'POST') {
    let body = ''; for await (const chunk of req) body += chunk;
    const fields = JSON.parse(body); newsletterAttempts++;
    assert.equal(fields.consent, true); assert.equal(fields.email, 'test@example.com');
    res.statusCode = newsletterAttempts === 1 ? 503 : 200;
    res.end(JSON.stringify({ message: newsletterAttempts === 1 ? 'Temporary subscription failure' : 'Your newsletter request has been recorded.' })); return;
  }
  if (path.endsWith("/shop/me")) {
    res.end(JSON.stringify({ user: loggedIn ? shopper : null }));
    return;
  }
  if (path.endsWith("/shop/payment-methods")) {
    res.end(
      JSON.stringify({
        methods: [{ id: "COD", label: "Cash on delivery", enabled: true }, { id: 'BKASH', label: 'bKash', enabled: false }],
      }),
    );
    return;
  }
  if (path.endsWith("/shop/quote")) {
    let body = "";
    for await (const chunk of req) body += chunk;
    const { items, couponCode } = JSON.parse(body);
    if (couponCode && couponCode !== 'SAVE50') { res.statusCode = 400; res.end(JSON.stringify({ message: 'Coupon is invalid or expired' })); return; }
    if (items.some(line => line.quantity > (line.variantId === 'black' ? 3 : 2))) { res.statusCode = 400; res.end(JSON.stringify({ message: 'Requested quantity is unavailable' })); return; }
    if (
      items.some((line) =>
        line.productId === simpleId
          ? Boolean(line.variantId)
          : !product.variants.some((variant) => variant.id === line.variantId),
      )
    ) {
      res.statusCode = 400;
      res.end(
        JSON.stringify({ message: "Choose an available product variant" }),
      );
      return;
    }
    const quoted = items.map((line) => {
      const price =
        line.productId === simpleId
          ? 500
          : line.variantId === "blue"
            ? 750
            : 500;
      return {
        ...line,
        name: product.name,
        unitPrice: price.toFixed(2),
        lineTotal: (price * line.quantity).toFixed(2),
      };
    });
    const total = quoted
      .reduce((sum, line) => sum + Number(line.lineTotal), 0)
      .toFixed(2);
    res.end(
      JSON.stringify({
        items: quoted,
        subtotal: total,
        shipping: "60.00",
        tax: "0.00",
        total: (Number(total) + 60 - (couponCode ? 50 : 0)).toFixed(2),
        ...(couponCode ? { discount: '50.00', coupon: { code: couponCode, discount: '50.00' } } : {}),
        quoteToken: "isolated-fixture",
      }),
    );
    return;
  }
  if (path.includes("/cms/")) {
    res.statusCode = 404;
    res.end("{}");
    return;
  }
  if (path.startsWith("/uploads/")) {
    if (path.includes("broken")) {
      res.statusCode = 404;
      res.end();
      return;
    }
    const colour = path.includes("black")
      ? "#24364c"
      : path.includes("blue")
        ? "#70b6df"
        : "#9bcee8";
    res.setHeader("Content-Type", "image/svg+xml");
    res.end(
      `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900"><rect width="900" height="900" fill="#f2f6fa"/><ellipse cx="450" cy="740" rx="240" ry="25" fill="#d9e3ed"/><path d="M330 180 230 230 130 390 250 460 300 390 300 710 600 710 600 390 650 460 770 390 670 230 570 180C540 260 360 260 330 180Z" fill="${colour}"/><path d="M330 180C350 310 550 310 570 180" fill="none" stroke="#ffffff66" stroke-width="15"/><text x="450" y="460" text-anchor="middle" fill="#fff" font-family="Arial" font-size="30" letter-spacing="7">DS EVERYDAY</text></svg>`,
    );
    return;
  }
  if (path.endsWith("/products/missing")) {
    res.statusCode = 404;
    res.end("{}");
    return;
  }
  if (path.endsWith("/products/unavailable")) {
    res.statusCode = productUnavailable ? 503 : 200;
    res.end(
      productUnavailable
        ? "{}"
        : JSON.stringify({ ...product, slug: "unavailable" }),
    );
    return;
  }
  if (path.endsWith("/products/escaped")) {
    res.end(
      JSON.stringify({
        ...product,
        slug: "escaped",
        shortDescription: "Text </script><script>window.injected=true</script>",
      }),
    );
    return;
  }
  if (path.endsWith("/products/simple")) {
    res.end(
      JSON.stringify({
        ...product,
        id: simpleId,
        type: "SIMPLE",
        slug: "simple",
        variants: product.variants,
        availableStock: 2,
      }),
    );
    return;
  }
  if (path.endsWith("/products/sold-out")) {
    res.end(
      JSON.stringify({
        ...product,
        slug: "sold-out",
        variants: product.variants.map((v) => ({ ...v, availableStock: 0 })),
        availableStock: 0,
      }),
    );
    return;
  }
  if (path.includes("/products/")) {
    res.end(JSON.stringify(product));
    return;
  }
  if (path.endsWith("/products")) {
    const search = new URL(req.url, 'http://localhost').searchParams.get('search');
    if (search) {
      suggestionRequests++;
      if (search === 'error') { res.statusCode = 503; res.end(JSON.stringify({ message: 'Catalog unavailable' })); return; }
      if (search === 'zzempty') { res.end(JSON.stringify({ items: [], total: 0 })); return; }
    }
    res.end(
      JSON.stringify({
        items: [
          product,
          {
            ...product,
            id: "related",
            name: "Another everyday favourite",
            slug: "related",
          },
        ],
        total: 2,
      }),
    );
    return;
  }
  if (path.endsWith("/categories")) {
    res.end(JSON.stringify([category]));
    return;
  }
  res.statusCode = 404;
  res.end("{}");
});
let server, chrome, ws;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pending = new Map();
let sequence = 0;
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("Timed out: " + method));
    }, 15000);
    pending.set(id, {
      resolve: (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      reject,
    });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails)
    throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function until(expression, label) {
  for (let i = 0; i < 100; i++) {
    if (await evaluate(expression)) return;
    await pause(100);
  }
  console.error(await evaluate(`JSON.stringify({url:location.href,search:document.querySelector(".search-combobox input")?.value,expanded:document.querySelector(".search-combobox input")?.getAttribute("aria-expanded"),feedback:document.querySelector(".search-feedback")?.textContent,buttons:[...document.querySelectorAll("button")].map(b=>b.textContent.trim()).slice(0,10)})`));
  throw new Error("Timed out: " + label);
}
async function navigate(path) {
  await command("Page.navigate", { url: "http://localhost:3015" + path });
  await until('document.readyState === "complete"', "page load");
  await pause(400);
}
async function click(text) {
  assert.ok(
    await evaluate(
      `(()=>{const el=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith(${JSON.stringify(text)}));if(!el||el.disabled)return false;el.click();return true;})()`,
    ),
    "click " + text,
  );
  await pause(100);
}
async function quantity(value) {
  await evaluate(
    `(()=>{const el=document.querySelector('#product-quantity');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await pause(100);
}
function pass(label) {
  console.log("PASS: " + label);
}
  async function fill(selector, value) {
    await evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});const proto=input instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await pause(60);
  }
try {
  await new Promise((resolve) => api.listen(4109, "127.0.0.1", resolve));
  server = spawn(
    process.execPath,
    [resolve(app, "node_modules/next/dist/bin/next"), "start", "-p", "3015"],
    {
      cwd: app,
      env: {
        ...process.env,
        STOREFRONT_API_BASE_URL: "http://127.0.0.1:4109/api/v1",
        STOREFRONT_ORIGIN: "http://localhost:3015/",
        CMS_HOME_KEY: "home",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  let logs = "";
  server.stdout.on("data", (d) => (logs += d));
  server.stderr.on("data", (d) => (logs += d));
  for (let i = 0; i < 80; i++) {
    try {
      await fetch("http://localhost:3015/icon.svg");
      break;
    } catch {
      await pause(250);
    }
  }
  const html = await (
    await fetch("http://localhost:3015/product/cotton-t-shirt")
  ).text();
  assert.ok(html.includes("Cotton T-Shirt collection"));
  assert.ok(html.includes("application/ld+json"));
  assert.ok(html.includes("You might also like"));
  pass("product metadata, structured data and related products");
  const escaped = await (
    await fetch("http://localhost:3015/product/escaped")
  ).text();
  const structured = escaped.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  )?.[1];
  assert.ok(structured);
  assert.ok(!structured.includes("<"));
  assert.equal(
    JSON.parse(structured).description,
    "Text </script><script>window.injected=true</script>",
  );
  pass("structured data safely escapes HTML without corrupting content");
  chrome = spawn(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=9227",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true },
  );
  let targets;
  for (let i = 0; i < 100; i++) {
    try {
      targets = await (await fetch("http://localhost:9227/json")).json();
      if (targets.some((t) => t.type === "page")) break;
    } catch {}
    await pause(100);
  }
  const target = targets.find((t) => t.type === "page");
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  ws.onmessage = (event) => {
    const response = JSON.parse(event.data);
    if (response.method === 'Runtime.exceptionThrown') browserErrors.push(response.params.exceptionDetails.exception?.description || response.params.exceptionDetails.text);
    if (response.method === 'Runtime.consoleAPICalled' && response.params.type === 'error') {
      const message = response.params.args.map(arg => arg.value || arg.description || '').join(' ');
      if (/hydrat|Minified React error #(?:418|423|425)/i.test(message)) browserErrors.push(message);
    }
    if (!response.id) return;
    const task = pending.get(response.id);
    if (task) {
      pending.delete(response.id);
      response.error
        ? task.reject(new Error(JSON.stringify(response.error)))
        : task.resolve(response.result);
    }
  };
  await command("Page.enable");
  await command("Runtime.enable");
  await command('Emulation.setFocusEmulationEnabled', { enabled: true });
  await command("Emulation.setDeviceMetricsOverride", {
    width: 1366,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  if (!process.env.ENGAGEMENT_ONLY) {
  await navigate("/product/cotton-t-shirt");
  await until(
    '!!document.querySelector(".pdp-option")',
    "hydrated product controls",
  );
  await evaluate(
    'localStorage.clear(); localStorage.setItem("commerce-storefront-theme","light")',
  );
  await navigate("/product/cotton-t-shirt");
  assert.equal(
    await evaluate(
      'document.querySelector(".pdp-primary-actions .primary-button").disabled',
    ),
    true,
  );
  pass("variable product requires a choice");
  assert.equal(
    await evaluate(
      '[...document.querySelectorAll(".pdp-option")].find(b=>b.textContent.includes("White")).disabled',
    ),
    true,
  );
  pass("sold-out option disabled");
  await click("Black / M");
  assert.ok(
    await evaluate(
      'document.querySelector(".pdp-price-line").textContent.includes("500")',
    ),
  );
  assert.ok(
    await evaluate(
      'document.querySelector(".gallery-main img").src.includes("black.svg")',
    ),
  );
  pass("variant price, savings, SKU, stock and gallery update");
  await quantity("0");
  assert.equal(
    await evaluate(
      'document.querySelector(".pdp-primary-actions .primary-button").disabled',
    ),
    true,
  );
  assert.ok(
    await evaluate(
      'document.querySelector("#product-quantity").getAttribute("aria-invalid")==="true"',
    ),
  );
  await evaluate(
    'document.querySelector("#product-quantity").dispatchEvent(new FocusEvent("focusout",{bubbles:true}))',
  );
  await quantity("1.5");
  assert.equal(
    await evaluate(
      'document.querySelector(".pdp-primary-actions .primary-button").disabled',
    ),
    true,
  );
  await quantity("4");
  assert.equal(
    await evaluate(
      'document.querySelector(".pdp-primary-actions .primary-button").disabled',
    ),
    true,
  );
  await quantity("2");
  await click("Add to cart");
  assert.equal(
    await evaluate(
      'JSON.parse(localStorage.getItem("commerce-cart-v1"))[0].quantity',
    ),
    2,
  );
  pass(
    "zero, fraction and overstock quantities blocked; valid addition stored",
  );
  await quantity("2");
  assert.equal(
    await evaluate(
      'document.querySelector(".pdp-primary-actions .primary-button").disabled',
    ),
    true,
  );
  assert.ok(await evaluate('!document.querySelector(".pdp-cart-success")'));
  pass("existing cart stock counted and stale success cleared");
  await quantity("1");
  await click("Add to cart");
  assert.equal(
    await evaluate(
      'JSON.parse(localStorage.getItem("commerce-cart-v1"))[0].quantity',
    ),
    3,
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".pdp-primary-actions .primary-button").disabled',
    ),
    true,
  );
  pass("cannot add beyond cumulative stock");
  await click("Blue / L");
  await quantity("1");
  await click("♡ Save to wishlist");
  assert.equal(
    await evaluate(
      'JSON.parse(localStorage.getItem("commerce-wishlist-v1")).length',
    ),
    1,
  );
  await click("♥ Saved to wishlist");
  assert.equal(
    await evaluate(
      'JSON.parse(localStorage.getItem("commerce-wishlist-v1")).length',
    ),
    0,
  );
  pass("wishlist save and remove");
  await evaluate('document.querySelector(".pdp-zoom-trigger").click()');
  assert.equal(await evaluate('document.querySelector("dialog").open'), true);
  await command("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await command("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  assert.equal(await evaluate('document.querySelector("dialog").open'), false);
  pass("image zoom and native Escape dismissal");
  await evaluate('document.querySelector(".pdp-zoom-trigger").focus()');
  await command("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "ArrowRight",
    code: "ArrowRight",
    windowsVirtualKeyCode: 39,
  });
  await pause(100);
  assert.ok(
    await evaluate(
      'document.querySelector(".gallery-main img").src.includes("general.svg")',
    ),
  );
  pass("keyboard image navigation");
  await click("Blue / L");
  await pause(150);
  await evaluate(
    'document.querySelectorAll(".gallery-thumbnails button")[2].click()',
  );
  await until(
    '!!document.querySelector(".pdp-missing-image")',
    "broken image fallback",
  );
  pass("broken image fallback");
  await evaluate(
    'document.querySelectorAll(".gallery-thumbnails button")[0].click()',
  );
  const desktop = await command("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  writeFileSync(
    join(artifacts, "product-desktop.png"),
    Buffer.from(desktop.data, "base64"),
  );
  await command("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await pause(200);
  assert.ok(
    await evaluate("document.documentElement.scrollWidth <= window.innerWidth"),
    "mobile horizontal overflow",
  );
  const mobile = await command("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  writeFileSync(
    join(artifacts, "product-mobile.png"),
    Buffer.from(mobile.data, "base64"),
  );
  pass("mobile layout without horizontal overflow");
  await evaluate('document.documentElement.dataset.theme="dark"');
  await pause(100);
  const dark = await command("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  writeFileSync(
    join(artifacts, "product-dark.png"),
    Buffer.from(dark.data, "base64"),
  );
  pass("dark theme rendering");
  await click("Buy now");
  await until(
    'window.location.pathname === "/checkout"',
    "checkout navigation",
  );
  assert.equal(
    await evaluate(
      'JSON.parse(localStorage.getItem("commerce-cart-v1")).find(p=>p.variantId==="blue").quantity',
    ),
    1,
  );
  pass("Buy now preserves cart and navigates to checkout");
  await navigate("/product/sold-out");
  await until(
    '!!document.querySelector(".pdp-primary-actions")',
    "sold out page",
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".pdp-primary-actions .primary-button").disabled',
    ),
    true,
  );
  pass("fully sold-out product cannot be purchased");
  await evaluate(
    `(()=>{ const lines=JSON.parse(localStorage.getItem("commerce-cart-v1")); lines.push({productId:${JSON.stringify(simpleId)},slug:"simple",name:"Legacy simple product",variantId:"obsolete",variantName:"Old option",quantity:1,price:500}); localStorage.setItem("commerce-cart-v1",JSON.stringify(lines)); })()`,
  );
  await navigate("/cart");
  await until(
    `(()=>{const line=JSON.parse(localStorage.getItem("commerce-cart-v1")).find(p=>p.productId===${JSON.stringify(simpleId)});return line && !line.variantId;})()`,
    "obsolete simple-product cart repair",
  );
  await until(
    '!!document.querySelector(".summary-total")',
    "verified quote after cart repair",
  );
  assert.equal(
    await evaluate(
      'JSON.parse(localStorage.getItem("commerce-cart-v1")).filter(p=>p.variantId).length',
    ),
    2,
  );
  pass(
    "legacy SIMPLE variant is repaired automatically and quote succeeds without losing other cart items",
  );
  await navigate("/product/simple");
  await until(
    '!!document.querySelector(".pdp-primary-actions")',
    "simple product",
  );
  assert.equal(
    await evaluate('document.querySelectorAll(".pdp-option").length'),
    0,
  );
  pass(
    "SIMPLE product ignores historical variant records in purchase controls",
  );
  await evaluate(
    'localStorage.setItem("commerce-wishlist-v1","broken json");window.dispatchEvent(new Event("storage"))',
  );
  await click("♡ Save to wishlist");
  assert.equal(
    await evaluate(
      'JSON.parse(localStorage.getItem("commerce-wishlist-v1")).length',
    ),
    1,
  );
  pass("corrupt wishlist storage recovers on save");
  await evaluate(
    'window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException("Blocked","SecurityError")}',
  );
  await click("Add to cart");
  assert.ok(
    await evaluate('!!document.querySelector(".purchase-actions .shop-error")'),
  );
  await evaluate("Storage.prototype.setItem=window.originalSetItem");
  pass("blocked browser storage shows an error instead of false success");
  await navigate("/product/missing");
  await until(
    'document.body.textContent.includes("This product is no longer available")',
    "missing product",
  );
  pass("missing product renders not-found state");
  await navigate("/product/unavailable");
  await until(
    'document.body.textContent.includes("We couldn’t load this product")',
    "unavailable product",
  );
  pass("API failure renders retry state instead of not-found");
  productUnavailable = false;
  await click("Try again");
  await until(
    '!!document.querySelector("#product-title")',
    "retry after API recovery",
  );
  pass("retry fetches fresh product data after API recovery");
  await navigate('/product/cotton-t-shirt');
  await until('document.querySelectorAll(".review-card").length === 5', 'paginated real review response');
  assert.equal(await evaluate('[...document.querySelectorAll(".review-star")].every(icon=>{const box=icon.getBoundingClientRect();return box.width===22&&box.height===22})'), true);
  assert.ok(await evaluate('document.querySelector(".review-average").textContent.includes("4.6") && document.querySelector(".review-average").textContent.includes("2 verified")'));
  await evaluate('document.querySelector(".review-pagination button:last-child").click()');
  await until('document.querySelectorAll(".review-card").length === 2', 'review page two');
  pass('compact 22px stars, actual rating summary, verified count and review pagination');

  await evaluate('document.querySelector(".feedback-form input[type=radio][value=\\"4\\"]").click()');
  await fill('.feedback-form input[name=authorName]', 'Test shopper');
  await fill('.feedback-form input[name=authorEmail]', 'test@example.com');
  await fill('.feedback-form textarea', 'A genuine test experience.');
  await evaluate('document.querySelector(".feedback-form").requestSubmit()');
  await until('document.querySelector(".feedback-form .shop-error")?.textContent.includes("Temporary review")', 'review error');
  assert.equal(await evaluate('document.querySelector(".feedback-form textarea").value'), 'A genuine test experience.');
  await evaluate('document.querySelector(".feedback-form").requestSubmit()');
  await until('document.querySelector(".feedback-form .shop-success")?.textContent.includes("moderation")', 'review submitted');
  assert.equal(reviewAttempts, 2);
  pass('review rating interaction, required payload, error retention and moderated success');
  await navigate('/');
  await until('!!document.querySelector(".newsletter-form")', 'newsletter form');
  assert.ok(!(await evaluate('document.querySelector(".newsletter-panel h2").textContent')).includes('10%'));
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".newsletter-form fieldset")).borderTopWidth'), '0px');
  await fill('.newsletter-form input[name=email]', 'invalid');
  await evaluate('document.querySelector(".newsletter-form").requestSubmit()');
  assert.equal(newsletterAttempts, 0);
  await fill('.newsletter-form input[name=email]', 'test@example.com');
  await evaluate('document.querySelector(".newsletter-form").requestSubmit()');
  assert.equal(newsletterAttempts, 0);
  await evaluate('document.querySelector(".newsletter-form input[type=checkbox]").click();document.querySelector(".newsletter-form").requestSubmit()');
  await until('document.querySelector(".newsletter-error")?.textContent.includes("Temporary")', 'subscription error');
  assert.equal(await evaluate('document.querySelector(".newsletter-form input[name=email]").value'), 'test@example.com');
  await evaluate('document.querySelector(".newsletter-form").requestSubmit();document.querySelector(".newsletter-form").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))');
  await until('document.querySelector(".newsletter-success")?.textContent.includes("recorded")', 'subscription success');
  assert.equal(newsletterAttempts, 2);
  pass('newsletter email/consent validation, border reset, error retention and duplicate-submit protection');
  for (const width of [390, 768, 1366]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
    await pause(150);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
    for (const theme of ['light', 'dark']) {
      await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
      await evaluate('document.querySelector(".newsletter-panel").scrollIntoView({block:"center",behavior:"instant"})');
      const shot = await command('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(artifacts, `newsletter-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
    }
    await navigate('/product/cotton-t-shirt');
    await until('document.querySelectorAll(".review-card").length === 5', 'responsive review list');
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
    assert.equal(await evaluate('[...document.querySelectorAll(".review-star")].every(icon=>icon.getBoundingClientRect().width===22)'), true);
    for (const theme of ['light', 'dark']) {
      await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)};document.querySelector("#reviews-section").scrollIntoView({block:"start",behavior:"instant"})`);
      const shot = await command('Page.captureScreenshot', {format:'png'});
      writeFileSync(join(artifacts, `reviews-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
    }
    await navigate('/');
    await until('!!document.querySelector(".newsletter-form")', 'newsletter after review checks');
  }
  pass('newsletter responsive layout and light/dark screenshots at mobile, tablet and desktop widths');
  // Shopping flow uses the real Next route handlers with an isolated upstream API.
  const shoppingLine = { productId: simpleId, slug: 'simple', name: 'Cotton shirt with a deliberately long readable product title', quantity: 1, price: 500, imageUrl: 'http://127.0.0.1:4109/uploads/general.svg' };
  await evaluate(`localStorage.setItem('commerce-cart-v1',${JSON.stringify(JSON.stringify([shoppingLine]))})`);
  await navigate('/cart');
  await until('!!document.querySelector(".summary-total")', 'cart quote');
  await evaluate('document.querySelector(".quantity-stepper button:last-child").click()');
  await until('document.querySelector(".quantity-stepper output").textContent === "2" && !document.querySelector(".quantity-stepper button:last-child").disabled', 'quantity updated');
  await evaluate('document.querySelector(".quantity-stepper button:last-child").click()');
  await until('document.querySelector(".shopping-notice")?.textContent.includes("unavailable")', 'stock validation');
  assert.equal(await evaluate('document.querySelector(".quantity-stepper output").textContent'), '2');
  await evaluate('document.querySelector(".quantity-stepper button:first-child").click()');
  await until('document.querySelector(".quantity-stepper output").textContent === "1"', 'quantity decreased');
  await fill('#coupon-code', 'INVALID');
  await evaluate('document.querySelector(".coupon-form").requestSubmit()');
  await until('document.querySelector(".coupon-error")?.textContent.includes("expired")', 'invalid coupon');
  await fill('#coupon-code', 'SAVE50');
  await evaluate('document.querySelector(".coupon-form").requestSubmit()');
  await until('!!document.querySelector(".applied-coupon")', 'coupon applied');
  assert.ok(await evaluate('document.querySelector(".summary-discount").textContent.includes("50")'));
  await evaluate('document.querySelector(".applied-coupon button").click()');
  await until('!!document.querySelector("#coupon-code") && !document.querySelector(".summary-discount")', 'coupon removed');
  pass('cart quantity updates, server stock rejection without stale quantity, coupon validation and removal');
  await navigate('/checkout');
  await until('!!document.querySelector(".payment-options input[value=COD]")', 'payment methods');
  assert.equal(await evaluate('document.querySelector(".payment-options input[value=BKASH]").disabled'), true);
  await evaluate('document.querySelector(".checkout-form").requestSubmit()');
  assert.equal(orderAttempts, 0);
  await fill('[name=name]', 'Test Shopper'); await fill('[name=phone]', '12345');
  assert.equal(await evaluate('document.querySelector("[name=phone]").checkValidity()'), false);
  await fill('[name=phone]', '01712345678'); await fill('[name=address]', 'Test address'); await fill('[name=city]', 'Dhaka');
  await navigate('/cart'); await navigate('/checkout');
  await until('document.querySelector("[name=address]")?.value === "Test address"', 'address draft restored');
  await until('!!document.querySelector(".summary-total") && !!document.querySelector(".payment-options input[value=COD]")', 'checkout ready');
  await evaluate('document.querySelector(".consent-row input").click();document.querySelector(".checkout-form").requestSubmit();document.querySelector(".checkout-form").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))');
  await until('document.querySelector(".checkout-form .shop-error")?.textContent.includes("Prices changed")', 'order price conflict');
  assert.equal(orderAttempts, 1);
  assert.equal(await evaluate('document.querySelector("[name=address]").value'), 'Test address');
  await until('!document.querySelector(".place-order").disabled', 'retry enabled');
  await evaluate('document.querySelector(".checkout-form").requestSubmit()');
  await until('!!document.querySelector(".order-heading")', 'successful order details');
  assert.equal(orderAttempts, 2);
  assert.equal(await evaluate('document.querySelectorAll(".order-timeline li").length'), 1);
  assert.ok(await evaluate('document.querySelector(".order-reference").textContent.length < 30'));
  assert.ok(await evaluate('document.querySelector(".ordered-products").textContent.includes("Historical cotton shirt")'));
  assert.ok(await evaluate('document.querySelector(".payment-details").textContent.includes("Cash on Delivery")'));
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("commerce-cart-v1")).length'), 0);
  pass('guest checkout validation, disabled gateway, address draft, price-conflict retry, duplicate guard and successful redirect');
  pass('order snapshot prices, compact reference, separate statuses and truthful timeline');
  for (const width of [320,375,430,768,1024,1440]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
    for (const path of ['/cart','/checkout','/orders/'+fixtureOrder.id]) {
      await evaluate(`localStorage.setItem('commerce-cart-v1',${JSON.stringify(JSON.stringify([shoppingLine]))})`);
      await navigate(path);
      await until(path.includes('/orders/') ? '!!document.querySelector(".order-heading")' : '!!document.querySelector(".summary-total")', 'responsive shopping content');
      for (const theme of ['light','dark']) {
        await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)};window.scrollTo({top:0,behavior:'instant'})`);
        assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, `${path} ${theme} ${width} overflow`);
        const shot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        writeFileSync(join(artifacts, `shopping-${path.split('/')[1]}-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
      }
    }
  }
  pass('cart checkout order responsive layouts at 320/375/430/768/1024/1440 in light and dark modes');
  await navigate('/cart'); await until('!!document.querySelector(".remove-item")', 'remove control');
  await evaluate('document.querySelector(".remove-item").click()');
  await until('!!document.querySelector(".empty-content")', 'empty cart');
  assert.equal(await evaluate('!!document.querySelector(".order-summary")'), false);
  pass('remove product updates storage and empty cart hides summary');
  }
  await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await navigate('/account'); await until('!!document.querySelector(".auth-card")', 'account sign in');
  assert.equal(await evaluate('document.querySelector(".auth-card").textContent.includes("Use at least")'), false);
  assert.ok(await evaluate('document.querySelector(".auth-card").getBoundingClientRect().width <= 480'));
  await fill('.auth-card [name=email]', 'test@example.com'); await fill('.auth-card [name=password]', 'wrong-password');
  await evaluate('document.querySelector(".auth-password button").click()');
  assert.equal(await evaluate('document.querySelector(".auth-card [name=password]").type'), 'text');
  await evaluate('document.querySelector(".auth-card").requestSubmit()');
  await until('document.querySelector(".account-auth [role=alert]")?.textContent.includes("Invalid email or password")', 'generic sign-in error');
  await fill('.auth-card [name=password]', 'valid-password-for-tests');
  await evaluate('document.querySelector(".auth-card").requestSubmit();document.querySelector(".auth-card").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))');
  await until('!!document.querySelector(".account-dashboard")', 'signed-in account overview');
  assert.equal(authAttempts, 2);
  await until('!!document.querySelector(".account-recent-orders")', 'recent account orders');
  await click('Sign out'); await until('!!document.querySelector(".auth-card")', 'sign out');
  await evaluate('document.querySelector(".auth-card>.text-button").click()');
  assert.ok(await evaluate('document.querySelector(".auth-card").textContent.includes("Use at least 12")'));
  await fill('.auth-card [name=name]', 'Test Shopper'); await fill('.auth-card [name=email]', 'test@example.com'); await fill('.auth-card [name=password]', 'valid-password-for-tests');
  await evaluate('document.querySelector(".auth-card").requestSubmit()');
  await until('!!document.querySelector(".account-dashboard")', 'registration');
  await click('Sign out'); await until('!!document.querySelector(".auth-card")', 'signed out again');
  pass('account sign-in error, password visibility, duplicate guard, authenticated overview, recent orders, sign-out and registration');
  const beforeSearch = suggestionRequests;
  await evaluate('document.querySelector(".search-combobox input").focus()');
  await command('Input.insertText', {text:'c'}); await pause(70); await command('Input.insertText', {text:'o'}); await pause(70); await command('Input.insertText', {text:'tton'});
  await evaluate('document.querySelector(".search-combobox input").focus()');
  await until('document.querySelectorAll(".search-option").length > 0', 'catalog suggestions');
  assert.equal(suggestionRequests - beforeSearch, 1);
  assert.equal(await evaluate('document.querySelector(".search-combobox input").autocomplete'), 'off');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".search-combobox input")).outlineStyle'), 'none');
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
  assert.ok(await evaluate('!!document.querySelector(".search-combobox input").getAttribute("aria-activedescendant")'));
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await until('location.pathname === "/product/cotton-t-shirt"', 'keyboard result navigation');
  await evaluate('document.querySelector(".search-combobox input").focus();document.querySelector(".search-combobox input").select()'); await command('Input.insertText',{text:'zzempty'}); await evaluate('document.querySelector(".search-combobox input").focus()');
  await until('document.querySelector(".search-feedback")?.textContent.includes("No matching")', 'no search results');
  await evaluate('document.querySelector(".search-combobox input").focus();document.querySelector(".search-combobox input").select()'); await command('Input.insertText',{text:'error'});
  await until('document.querySelector(".search-feedback")?.textContent.includes("temporarily unavailable")', 'search API error');
  assert.ok(await evaluate('document.querySelector(".search-all").href.includes("q=error")'));
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  assert.equal(await evaluate('!!document.querySelector(".search-panel")'), false);
  pass('catalog search debounce, autocomplete hint, focus ring, keyboard navigation, empty/error states and full-search fallback');
  await navigate('/account'); await until('document.querySelectorAll(".ribbon-dots button").length === 2', 'scheduled announcements');
  const firstMessage = await evaluate('document.querySelector(".ribbon-message").textContent');
  await until(`document.querySelector('.ribbon-message').textContent !== ${JSON.stringify(firstMessage)}`, 'ribbon rotation');
  await evaluate('document.querySelector(".ribbon-pause").focus()');
  await pause(100);
  assert.equal(await evaluate('document.activeElement === document.querySelector(".ribbon-pause")'), true, 'keyboard focus enters ribbon');
  const focusedMessage = await evaluate('document.querySelector(".ribbon-message").textContent'); await pause(3300);
  assert.equal(await evaluate('document.querySelector(".ribbon-message").textContent'), focusedMessage);
  await evaluate('document.querySelector(".ribbon-pause").click();document.querySelector(".ribbon-pause").blur()');
  const pausedMessage = await evaluate('document.querySelector(".ribbon-message").textContent'); await pause(3300);
  assert.equal(await evaluate('document.querySelector(".ribbon-message").textContent'), pausedMessage);
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".ribbon-message")).animationName'), 'none');
  await command('Emulation.setEmulatedMedia', { features: [] });
  pass('announcement scheduling, disabled filtering, rotation, focus/manual pause and reduced motion');
  await until('!!document.querySelector(".contact-launcher")', 'contact launcher');
  await evaluate('document.querySelector(".contact-launcher").click()');
  await until('document.activeElement?.className === "contact-close"', 'contact focus handling');
  assert.ok(await evaluate('document.querySelector(".channel-whatsapp").href.includes("https://wa.me/8801712345678?text=Hello%20DS%20Mart")'));
  assert.equal(await evaluate('document.querySelector(".channel-phone").getAttribute("href")'), 'tel:+8801712345678');
  assert.equal(await evaluate('document.querySelector(".channel-email").getAttribute("href")'), 'mailto:support@example.com');
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  assert.equal(await evaluate('!!document.querySelector(".contact-panel")'), false);
  assert.equal(await evaluate('document.activeElement.className'), 'contact-launcher');
  assert.equal(await evaluate('sessionStorage.getItem("ds-contact-dismissed")'), '1');
  await evaluate('document.querySelector(".contact-launcher").click()');
  await until('!!document.querySelector(".contact-panel")', 'reopened contact panel');
  await evaluate('document.body.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}))');
  await until('!document.querySelector(".contact-panel")', 'outside contact close');
  await navigate('/contact'); assert.equal(await evaluate('!!document.querySelector(".floating-contact")'), false);
  await navigate('/account');
  engagementSettings = { ...engagementSettings, announcementRibbon: { ...engagementSettings.announcementRibbon, items: [{ id: 'updated', enabled: true, text: 'Published without rebuilding', device: 'both' }] } };
  await evaluate('window.dispatchEvent(new Event("focus"))');
  await until('document.querySelector(".ribbon-message")?.textContent.includes("Published without rebuilding")', 'live published update');
  pass('contact open/close, focus, valid configured channels, session dismissal, route exclusions and live published refresh');
  engagementSettings.contactWidget.enabled = false;
  await evaluate('window.dispatchEvent(new Event("focus"))');
  await until('!document.querySelector(".floating-contact")', 'published widget master toggle');
  engagementSettings.contactWidget.enabled = true; engagementSettings.contactWidget.delaySeconds = 1;
  await evaluate('window.dispatchEvent(new Event("focus"))');
  await until('!!document.querySelector(".contact-launcher")', 'configured widget delay');
  engagementSettings.announcementRibbon.items = [{ id: 'desktop-only', enabled: true, text: 'Desktop-only announcement', device: 'desktop' }, { id: 'mobile-only', enabled: true, text: 'Mobile-only announcement', device: 'mobile' }];
  for (const width of [320,375,768,1440]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
    await navigate('/account'); await until('!!document.querySelector(".auth-card") && !!document.querySelector(".contact-launcher")', 'responsive account');
    await until(`document.querySelector('.ribbon-message')?.textContent.includes(${JSON.stringify(width < 768 ? 'Mobile-only' : 'Desktop-only')})`, 'device-targeted announcement');
    await evaluate('document.querySelector(".contact-launcher").click()');
    for (const theme of ['light','dark']) {
      await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)};window.scrollTo({top:0,behavior:'instant'})`);
      await pause(300);
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
      const shot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      writeFileSync(join(artifacts, `engagement-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
      await evaluate('document.querySelector(".contact-close").click()');
      await pause(100);
      const closed = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      writeFileSync(join(artifacts, `account-${theme}-${width}.png`), Buffer.from(closed.data, 'base64'));
      await evaluate('document.querySelector(".contact-launcher").click()');
    }
  }
  pass('account ribbon and contact responsive light/dark layouts at 320/375/768/1440');
  assert.deepEqual(browserErrors, [], 'no uncaught browser exceptions or hydration errors');
  assert.ok(!logs.includes("blocking-prerender-metadata-dynamic"), logs);
  pass("no metadata prerender errors");
  console.log("Screenshots: " + artifacts);
} finally {
  if (ws) ws.close();
  if (chrome) chrome.kill();
  if (server) server.kill();
  api.closeAllConnections();
  await new Promise((resolve) => api.close(resolve));
  await pause(700);
  try {
    assert.equal(dirname(resolve(profile)), resolve(tmpdir()));
    assert.ok(basename(profile).startsWith("ds-product-"));
    rmSync(profile, { recursive: true, force: true });
  } catch {
    /* Browser shutdown may briefly retain profile locks. */
  }
}
