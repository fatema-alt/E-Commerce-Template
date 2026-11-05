// Run after API, admin and storefront production builds. All data is in-memory;
// this test never connects to a database or a real payment service.
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const browser = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(existsSync);
assert(browser, "Chrome or Edge is required");
const profile = mkdtempSync(join(tmpdir(), "ds-checkout-redesign-"));
const artifacts = join(root, ".payment-redesign");
mkdirSync(artifacts, { recursive: true });
const productId = "00000000-0000-4000-8000-000000000002";
const orderId = "00000000-0000-4000-8000-000000000001";
const settings = {
  fullEnabled: true,
  discountType: "percentage",
  discountValue: 5,
  maxDiscountCap: null,
  partialEnabled: true,
  advanceType: "delivery_charge_only",
  advanceValue: 0,
  codEnabled: true,
  codMin: null,
  codMax: null,
  allowStacking: false,
  maxTotalDiscountPercent: null,
};
const methods = [
  {
    id: productId,
    type: "mobile_banking",
    name: "Fixture bKash",
    logo: null,
    details: { accountNumber: "01700000000", accountType: "Merchant" },
    instruction: "<p>Choose Payment in your app.</p>",
    isEnabled: true,
    sortOrder: 0,
  },
  {
    id: orderId,
    type: "bank",
    name: "Fixture Bank",
    logo: null,
    details: {
      bankName: "Test Bank",
      accountName: "Fixture",
      accountNumber: "12345678",
      branch: "Dhaka",
      routingNumber: "123456789",
    },
    instruction: "<p>Transfer to the bank account.</p>",
    isEnabled: true,
    sortOrder: 1,
  },
];
const order = {
  id: orderId,
  orderNumber: "CHECKOUT-TEST",
  version: 1,
  status: "PENDING",
  paymentStatus: "UNPAID",
  paymentMethod: "MANUAL",
  paymentOption: "FULL_PAYMENT",
  paymentPlan: "FULL_PAYMENT",
  grandTotal: "535.00",
  subtotal: "500.00",
  shippingTotal: "60.00",
  taxTotal: "0.00",
  discountTotal: "25.00",
  couponDiscount: "0.00",
  prepaidDiscount: "25.00",
  paidTotal: "0.00",
  refundedTotal: "0.00",
  refundableBalance: "0.00",
  amountDueOnDelivery: "0.00",
  customerName: "Fixture customer",
  customerPhone: "01711111111",
  createdAt: "2026-11-01T00:00:00Z",
  items: [
    {
      id: productId,
      nameSnapshot: "Fixture item",
      skuSnapshot: "TEST",
      product: {
        slug: "fixture",
        images: [{ url: "/uploads/order-fixture.png" }],
      },
      quantity: 1,
      unitPrice: "500.00",
      lineTotal: "500.00",
    },
  ],
  customerEmail: "customer@example.invalid",
  customerNote: "Please call before delivery.",
  updatedAt: "2026-11-01T00:15:00Z",
  source: "STOREFRONT",
  customerHistory: { total: 4, delivered: 2, cancelled: 1, returned: 0 },
  idempotencyKeys: [
    {
      id: "fixture-key",
      key: "fixture-checkout-idempotency-key",
      operation: "ORDER_CREATE",
      createdAt: "2026-11-01T00:00:00Z",
    },
  ],
  campaign: {
    source: "facebook",
    utm_source: "facebook",
    utm_medium: "paid_social",
    utm_campaign: "november",
    landingPage: "/product/fixture",
    device: {
      type: "Desktop",
      os: "Windows",
      browser: "Chrome",
      userAgent: "Fixture desktop browser",
    },
  },
  addresses: [
    {
      id: "fixture-address",
      type: "SHIPPING",
      recipientName: "Fixture customer",
      phone: "01711111111",
      line1: "House 24, Road 7",
      city: "Dhaka",
      district: "Dhaka",
      division: "Dhaka",
      postalCode: "1207",
    },
  ],
  shipments: [],
  returns: [],
  events: [
    {
      id: "fixture-created",
      action: "ORDER_CREATED",
      actorType: "CUSTOMER",
      createdAt: "2026-11-01T00:00:00Z",
    },
    {
      id: "fixture-submitted",
      action: "MANUAL_PAYMENT_SUBMITTED",
      actorType: "CUSTOMER",
      createdAt: "2026-11-01T00:02:00Z",
      after: { status: "awaiting_verification" },
    },
  ],
  notes: [],
  payments: [],
  manualPayments: [],
};
let created = 0,
  saved = 0,
  approved = 0,
  rejected = 0,
  attempts = 0,
  statusUpdates = 0;
function plans(shipping = 60) {
  return [
    {
      plan: "FULL_PAYMENT",
      available: true,
      total: (475 + shipping).toFixed(2),
      payableNow: (475 + shipping).toFixed(2),
      amountDueOnDelivery: "0.00",
      prepaidDiscount: "25.00",
      couponDiscount: "0.00",
    },
    {
      plan: "PARTIAL_ADVANCE",
      available: true,
      total: (500 + shipping).toFixed(2),
      payableNow: shipping.toFixed(2),
      amountDueOnDelivery: "500.00",
      prepaidDiscount: "0.00",
      couponDiscount: "0.00",
    },
    {
      plan: "COD",
      available: settings.codEnabled,
      total: (500 + shipping).toFixed(2),
      payableNow: "0.00",
      amountDueOnDelivery: (500 + shipping).toFixed(2),
      prepaidDiscount: "0.00",
      couponDiscount: "0.00",
    },
  ];
}
async function response(path, method, body) {
  const p = path.replace("/api/v1", "");
  if (p === "/auth/me")
    return { user: { role: "SUPER_ADMIN", id: "fixture-admin" } };
  if (p === "/admin/checkout-payments") return { settings, methods };
  if (p === "/admin/checkout-payments/settings" && method === "PUT") {
    Object.assign(settings, body);
    saved++;
    return settings;
  }
  if (p === "/admin/checkout-payments/methods" && method === "POST") {
    methods.push({ id: "new-method", ...body });
    return methods.at(-1);
  }
  if (p.startsWith("/admin/checkout-payments/review/")) {
    assert.equal(body.version, order.version);
    const claim = order.manualPayments[0];
    if (body.action === "reject") {
      assert(body.reason.length >= 3);
      claim.status = "rejected";
      claim.rejectReason = body.reason;
      rejected++;
    } else {
      claim.status = "confirmed";
      order.paymentStatus = "PAID";
      order.status = "CONFIRMED";
      order.paidTotal = "535.00";
      approved++;
    }
    order.version++;
    return { ok: true };
  }
  if (p === `/orders/${orderId}/notes`) {
    order.notes.push({
      id: "fixture-note-" + order.notes.length,
      body: body.body,
      createdAt: "2026-11-01T01:00:00Z",
    });
    order.version++;
    return order;
  }
  if (p === "/orders") return { items: [order], total: 1 };
  if (p === "/orders/reports")
    return {
      totalOrders: 1,
      grossSales: order.grandTotal,
      netSales: order.grandTotal,
      paidTotal: order.paidTotal,
      unpaidTotal: "0",
      codOutstanding: "0",
      refundTotal: "0",
      cancellationRate: 0,
      returnRate: 0,
      basis: "Fixture",
      summaries: [],
    };
  if (p === `/orders/${orderId}/status` && method === "PATCH") {
    assert.equal(body.version, order.version);
    assert.equal(body.status, "PROCESSING");
    statusUpdates++;
    order.status = body.status;
    order.version++;
    return order;
  }
  if (p === "/shop/payment-methods") return { settings, methods };
  if (p === "/shop/me") return { user: null };
  if (p === "/shop/quote") {
    const shipping = body.deliveryArea === "outside_dhaka" ? 90 : 60;
    const plan =
      plans(shipping).find((plan) => plan.plan === body.paymentOption) ||
      plans(shipping).find((plan) => plan.plan === "COD");
    return {
      ...plan,
      paymentOption: plan.plan,
      plans: plans(shipping),
      items: body.items.map((line) => ({
        ...line,
        name: "Fixture item",
        unitPrice: "500.00",
        lineTotal: String(500 * line.quantity),
      })),
      subtotal: String(
        body.items.reduce((sum, line) => sum + 500 * line.quantity, 0),
      ),
      shipping: shipping.toFixed(2),
      tax: "0.00",
      discount: plan.prepaidDiscount,
      onlinePaymentDiscount: plan.prepaidDiscount,
      shippingRates: { insideDhaka: 60, outsideDhaka: 90, freeAbove: null },
      quoteToken: "fixture-only",
    };
  }
  if (p === "/shop/orders" && method === "POST") {
    attempts++;
    if (attempts === 1)
      return {
        status: 409,
        message: "This transaction reference has already been submitted.",
      };
    assert.equal(body.paymentOption, "FULL_PAYMENT");
    assert.equal(body.deliveryArea, "inside_dhaka");
    assert.equal(body.senderInfo, "01711111111");
    assert.equal(body.reference, "TX123");
    order.manualPayments = [
      {
        id: "00000000-0000-4000-8000-000000000003",
        plan: "FULL_PAYMENT",
        methodSnapshot: methods[0],
        amountDueNow: "535.00",
        amountDueOnDelivery: "0.00",
        senderInfo: body.senderInfo,
        reference: body.reference,
        status: "awaiting_verification",
      },
    ];
    created++;
    return order;
  }
  if (p === `/shop/orders/${orderId}/manual-payment`) {
    const previous = order.manualPayments[0];
    assert.equal(previous.status, "rejected");
    assert.equal(body.reference, "TX456");
    order.manualPayments.unshift({
      ...previous,
      id: "00000000-0000-4000-8000-000000000004",
      status: "awaiting_verification",
      reference: body.reference,
      rejectReason: null,
    });
    order.version++;
    return order;
  }
  if (p === `/shop/orders/${orderId}` || p === `/orders/${orderId}`)
    return order;
  if (p.startsWith("/shop/orders/"))
    return { status: 404, message: "Order unavailable" };
  if (p.includes("/cms/")) return { status: 404, message: "No fixture CMS" };
  return { items: [], total: 0 };
}
let api, chrome, ws, interceptionError;
const children = [];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const requests = new Map();
let sequence = 0;
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      requests.delete(id);
      reject(new Error("CDP timeout: " + method));
    }, 15000);
    requests.set(id, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      reject,
    });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  });
  if (result.exceptionDetails)
    throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function until(expression, label) {
  for (let i = 0; i < 100; i++) {
    if (interceptionError) throw interceptionError;
    if (await evaluate(expression)) return;
    await pause(100);
  }
  throw new Error(
    "Timed out: " + label + "\n" + (await evaluate("document.body.innerText")),
  );
}
async function navigate(port, path) {
  await command("Page.navigate", { url: `http://localhost:${port}${path}` });
  await until('document.readyState === "complete"', "page load");
}
async function fill(selector, value) {
  await evaluate(
    `(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing input '+${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await pause(100);
}
async function click(text) {
  await evaluate(
    `(()=>{const el=[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===${JSON.stringify(text)});if(!el||el.disabled)throw Error('Missing enabled button '+${JSON.stringify(text)});el.click();})()`,
  );
  await pause(100);
}
async function shot(name, width) {
  await command("Emulation.setDeviceMetricsOverride", {
    width,
    height: 950,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await pause(150);
  assert(
    await evaluate("document.documentElement.scrollWidth <= innerWidth"),
    name +
      " has horizontal overflow at " +
      width +
      JSON.stringify(
        await evaluate(
          "[...document.querySelectorAll('*')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).slice(-15).map(el=>({tag:el.tagName,class:el.className,text:el.textContent.slice(0,80)}))",
        ),
      ),
  );
  const result = await command("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  writeFileSync(
    join(artifacts, `${name}-${width}.png`),
    Buffer.from(result.data, "base64"),
  );
}
try {
  api = http.createServer(async (req, res) => {
    try {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const result = await response(
        new URL(req.url, "http://localhost").pathname,
        req.method,
        raw ? JSON.parse(raw) : {},
      );
      res.setHeader("Content-Type", "application/json");
      res.statusCode = Number.isInteger(result.status) ? result.status : 200;
      res.end(JSON.stringify(result));
    } catch (error) {
      interceptionError = error;
      res.statusCode = 500;
      res.end("{}");
    }
  });
  await new Promise((resolve) => api.listen(18043, "127.0.0.1", resolve));
  for (const [app, port] of [
    ["storefront", 3038],
    ["admin", 3039],
  ]) {
    const cwd = join(root, "apps", app);
    const child = spawn(
      process.execPath,
      [
        join(cwd, "node_modules/next/dist/bin/next"),
        "start",
        "-p",
        String(port),
      ],
      {
        cwd,
        windowsHide: true,
        stdio: "ignore",
        env: {
          ...process.env,
          STOREFRONT_API_BASE_URL: "http://127.0.0.1:18043/api/v1",
          STOREFRONT_ORIGIN: "http://localhost:3038",
        },
      },
    );
    children.push(child);
    for (let i = 0; i < 100; i++) {
      try {
        await fetch(`http://localhost:${port}`);
        break;
      } catch {}
      await pause(100);
    }
  }
  chrome = spawn(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=9238",
      "--user-data-dir=" + profile,
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  let targets;
  for (let i = 0; i < 100; i++) {
    try {
      targets = await (await fetch("http://localhost:9238/json")).json();
      if (targets.some((target) => target.type === "page")) break;
    } catch {}
    await pause(100);
  }
  ws = new WebSocket(
    targets.find((target) => target.type === "page").webSocketDebuggerUrl,
  );
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  ws.onmessage = (message) => {
    const event = JSON.parse(message.data);
    if (event.method === "Page.javascriptDialogOpening")
      void command("Page.handleJavaScriptDialog", { accept: true });
    if (event.method === "Fetch.requestPaused")
      void (async () => {
        const request = event.params.request;
        if (new URL(request.url).pathname === "/uploads/order-fixture.png") {
          await command("Fetch.fulfillRequest", {
            requestId: event.params.requestId,
            responseCode: 200,
            responseHeaders: [{ name: "Content-Type", value: "image/png" }],
            body: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ZsAAAAASUVORK5CYII=",
          });
          return;
        }
        const body =
          request.method === "OPTIONS"
            ? {}
            : await response(
                new URL(request.url).pathname,
                request.method,
                request.postData ? JSON.parse(request.postData) : {},
              );
        await command("Fetch.fulfillRequest", {
          requestId: event.params.requestId,
          responseCode:
            request.method === "OPTIONS"
              ? 204
              : Number.isInteger(body.status)
                ? body.status
                : 200,
          responseHeaders: [
            { name: "Content-Type", value: "application/json" },
            {
              name: "Access-Control-Allow-Origin",
              value: "http://localhost:3039",
            },
            { name: "Access-Control-Allow-Credentials", value: "true" },
            {
              name: "Access-Control-Allow-Headers",
              value: "content-type,x-commerce-admin,idempotency-key",
            },
            {
              name: "Access-Control-Allow-Methods",
              value: "GET,PUT,POST,PATCH,DELETE,OPTIONS",
            },
          ],
          body:
            request.method === "OPTIONS"
              ? ""
              : Buffer.from(JSON.stringify(body)).toString("base64"),
        });
      })().catch((error) => {
        interceptionError = error;
      });
    const task = requests.get(event.id);
    if (task) {
      requests.delete(event.id);
      event.error
        ? task.reject(new Error(JSON.stringify(event.error)))
        : task.resolve(event.result);
    }
  };
  await command("Page.enable");
  await command("Runtime.enable");
  await command("Fetch.enable", {
    patterns: [
      { urlPattern: "*://*/api/v1/*" },
      { urlPattern: "*://*/uploads/order-fixture.png" },
    ],
  });
  await command("Emulation.setDeviceMetricsOverride", {
    width: 1366,
    height: 950,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await navigate(3039, "/settings/payments");
  await until(
    'document.body.innerText.includes("Save plans")',
    "plans settings",
  );
  await click("Save plans");
  await until(
    'document.body.innerText.includes("Saved successfully")',
    "plans saved",
  );
  assert.equal(saved, 1);
  async function chooseSetting(labelText, value) {
    await evaluate(
      `(()=>{const label=[...document.querySelectorAll('label')].find(el=>el.textContent.trim().startsWith(${JSON.stringify(labelText)}));const select=label?.querySelector('select');if(!select)throw Error('Missing setting');select.value=${JSON.stringify(value)};select.dispatchEvent(new Event('change',{bubbles:true}));})()`,
    );
  }
  await chooseSetting("Advance type", "fixed_amount");
  assert(await evaluate('document.body.innerText.includes("Advance value")'));
  await chooseSetting("Advance type", "percentage_of_order");
  assert(await evaluate('document.body.innerText.includes("Advance value")'));
  await chooseSetting("Advance type", "delivery_charge_only");
  assert.equal(
    await evaluate('document.body.innerText.includes("Advance value")'),
    false,
  );
  await chooseSetting("Discount type", "fixed");
  assert.equal(
    await evaluate(
      'document.body.innerText.includes("Maximum discount amount")',
    ),
    false,
  );
  await chooseSetting("Discount type", "percentage");
  assert(
    await evaluate(
      'document.body.innerText.includes("Maximum discount amount")',
    ),
  );

  for (const width of [1366, 390]) await shot("plans", width);
  await click("Methods");
  await until(
    'document.body.innerText.includes("Fixture bKash")',
    "method list",
  );
  await click("Add payment method");
  assert(
    await evaluate('document.body.innerText.includes("PNG/JPG/WebP, max 1MB")'),
  );
  assert.equal(
    await evaluate('document.body.innerText.includes("No methods yet")'),
    false,
  );
  await chooseSetting("Category", "bank");
  for (const label of [
    "Name *",
    "Bank name *",
    "Account name *",
    "Account number *",
    "Branch *",
    "Routing number *",
  ])
    assert(
      await evaluate(
        `document.body.innerText.includes(${JSON.stringify(label)})`,
      ),
    );
  await until(
    '!!document.querySelector(".payment-instruction-editor .product-rich-content")',
    "instruction editor",
  );
  assert.equal(
    await evaluate(
      'Math.round(document.querySelector(".payment-instruction-editor .product-rich-content").getBoundingClientRect().height)',
    ),
    200,
  );

  for (const width of [1366, 390]) await shot("method-form", width);
  await navigate(3038, "/");
  await evaluate(
    `localStorage.setItem('commerce-cart-v1', ${JSON.stringify(JSON.stringify([{ productId, slug: "fixture", name: "Fixture item", quantity: 1, price: 500 }]))})`,
  );
  await navigate(3038, "/");
  await until('!!document.querySelector("#header-cart-link")', "cart icon");
  await evaluate('document.querySelector("#header-cart-link").click()');
  await until(
    '!!document.querySelector(".cart-drawer[open] .confirmation-total")',
    "cart drawer prices",
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".cart-drawer").innerText.includes("Delivery")',
    ),
    false,
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".cart-drawer").innerText.includes("Tax")',
    ),
    false,
  );
  await evaluate(
    'document.querySelector(".cart-drawer button[aria-label^=Increase]").click()',
  );
  await until(
    'document.querySelector(".cart-drawer .quantity-stepper output")?.textContent === "2"',
    "quantity increment",
  );
  await until(
    'document.querySelector(".cart-drawer .confirmation-total")?.innerText.includes("1,000")',
    "product only total",
  );
  await evaluate(
    'document.querySelector(".cart-drawer button[aria-label^=Decrease]").click()',
  );
  await until(
    'document.querySelector(".cart-drawer .quantity-stepper output")?.textContent === "1"',
    "quantity decrement",
  );
  for (const width of [1366, 390, 320]) await shot("cart-drawer", width);
  await evaluate('document.documentElement.dataset.theme="light"');
  await shot("cart-drawer-light", 390);
  await evaluate('document.documentElement.dataset.theme="dark"');
  await evaluate(
    'document.querySelector(".cart-drawer button[aria-label^=Close]").click()',
  );
  await until('!document.querySelector(".cart-drawer[open]")', "close cart");
  await evaluate(
    'document.querySelector("#header-cart-link").focus(); document.querySelector("#header-cart-link").click()',
  );
  await until('!!document.querySelector(".cart-drawer[open]")', "reopen cart");
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
  await until(
    '!document.querySelector(".cart-drawer[open]")',
    "Escape closes drawer",
  );
  assert.equal(await evaluate("document.activeElement.id"), "header-cart-link");
  await evaluate('document.querySelector("#header-cart-link").click()');
  await until(
    '!document.querySelector(".cart-drawer .remove-item")?.disabled',
    "remove ready",
  );
  await evaluate('document.querySelector(".cart-drawer .remove-item").click()');
  await until(
    'document.querySelector(".cart-drawer").innerText.includes("Your cart is empty")',
    "empty cart",
  );
  await evaluate(
    `localStorage.setItem('commerce-cart-v1', ${JSON.stringify(JSON.stringify([{ productId, slug: "fixture", name: "Fixture item", quantity: 1, price: 500 }]))}); window.dispatchEvent(new Event('commerce-cart-change'))`,
  );
  await evaluate(
    'document.querySelector(".cart-drawer button[aria-label^=Close]").click()',
  );
  await navigate(3038, "/checkout");
  await until('!!document.querySelector("[name=name]")', "checkout form");
  assert.equal(
    await evaluate('!!document.querySelector("input[value=FULL_PAYMENT]")'),
    false,
  );
  await until(
    '!!document.querySelector(".summary-details")',
    "neutral checkout quote",
  );
  assert.equal(
    await evaluate('document.querySelector("[name=deliveryArea]").value'),
    "",
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".order-summary").innerText.includes("Full Payment discount")',
    ),
    false,
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".order-summary").innerText.includes("Select delivery area")',
    ),
    true,
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".order-summary").innerText.includes("Grand total")',
    ),
    false,
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".checkout-form button[type=submit]").disabled',
    ),
    true,
  );
  await command("Emulation.setDeviceMetricsOverride", {
    width: 1366,
    height: 950,
    deviceScaleFactor: 1,
    mobile: false,
  });
  assert(
    await evaluate(
      '(() => { const a = document.querySelector("[name=name]").getBoundingClientRect(); const b = document.querySelector("[name=phone]").getBoundingClientRect(); return Math.abs(a.y-b.y)<1 && Math.abs(a.height-b.height)<1; })()',
    ),
    "Name and phone inputs must align and have equal heights",
  );
  await shot("checkout-unselected", 1366);
  await fill("[name=name]", "Fixture customer");
  await fill("[name=phone]", "01711111111");
  await fill("[name=address]", "Fixture address");
  await fill("[name=city]", "Dhaka");
  await fill("[name=district]", "Dhaka");
  assert.equal(
    await evaluate('document.querySelector("[name=deliveryArea]").value'),
    "",
    "Typing an address must not select a delivery area",
  );
  await evaluate(
    '(() => { const select = document.querySelector("[name=deliveryArea]"); select.value = "inside_dhaka"; select.dispatchEvent(new Event("change", { bubbles:true })); })()',
  );
  await until(
    'document.querySelector(".summary-details")?.innerText.includes("60.00")',
    "inside delivery quote",
  );
  await evaluate(
    '(() => { const select = document.querySelector("[name=deliveryArea]"); select.value = "outside_dhaka"; select.dispatchEvent(new Event("change", { bubbles:true })); })()',
  );
  await until(
    'document.querySelector(".summary-details")?.innerText.includes("90.00")',
    "outside delivery quote overrides typed Dhaka",
  );
  await evaluate(
    '(() => { const select = document.querySelector("[name=deliveryArea]"); select.value = "inside_dhaka"; select.dispatchEvent(new Event("change", { bubbles:true })); })()',
  );
  await until(
    '!document.querySelector(".checkout-form button[type=submit]")?.disabled',
    "checkout ready",
  );
  for (const width of [1366, 390]) await shot("checkout", width);
  await evaluate('document.documentElement.dataset.theme="light"');
  await shot("checkout-light", 1366);
  await evaluate('document.documentElement.dataset.theme="dark"');
  await evaluate(
    'document.querySelector(".checkout-form button[type=submit]").click()',
  );
  await until(
    'location.pathname === "/checkout/payment" && !!document.querySelector("input[value=FULL_PAYMENT]")',
    "separate payment page",
  );
  assert.equal(created, 0, "Continuing to payment must not create an order");
  assert.equal(
    await evaluate(
      '!!document.querySelector("input[name=paymentPlan]:checked")',
    ),
    false,
    "No payment plan may be selected by default",
  );
  assert.equal(
    await evaluate('!!document.querySelector(".confirmation-total-block")'),
    false,
    "No assumed COD/prepaid breakdown before plan selection",
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".order-summary").innerText.includes("Full Payment discount")',
    ),
    false,
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".checkout-form button[type=submit]").disabled',
    ),
    true,
  );
  for (const id of ["FULL_PAYMENT", "PARTIAL_ADVANCE", "COD"])
    assert(await evaluate(`!!document.querySelector('input[value=${id}]')`));
  assert.equal(
    await evaluate('document.body.innerText.includes("SSLCommerz")'),
    false,
  );
  await evaluate('document.querySelector("input[value=COD]").click()');
  await until(
    '!document.querySelector("[name=senderInfo]")',
    "COD requires no payment method",
  );
  await evaluate(
    'document.querySelector("input[value=PARTIAL_ADVANCE]").click()',
  );
  await until(
    'document.body.innerText.includes("Pay on delivery")',
    "partial preview",
  );
  await evaluate('document.querySelector("input[value=FULL_PAYMENT]").click()');
  await until(
    '!!document.querySelector("[name=senderInfo]") && document.querySelector(".order-summary").innerText.includes("Full Payment discount")',
    "explicit full payment applies discount",
  );
  await click("Bank Transfer");
  await until(
    'document.body.innerText.includes("123456789")',
    "bank routing details",
  );
  await click("Mobile Banking");
  await fill("[name=senderInfo]", "01711111111");
  await fill("[name=reference]", "DUPLICATE");
  await until(
    '!document.querySelector(".checkout-form button[type=submit]")?.disabled',
    "ready",
  );
  for (const width of [1366, 390]) await shot("payment", width);
  await evaluate('document.querySelector(".consent-row input").click()');
  await click("Confirm & Place Order");
  await until(
    'document.body.innerText.includes("already been submitted")',
    "duplicate reference feedback",
  );
  assert.equal(
    await evaluate('document.querySelector("[name=reference]").value'),
    "DUPLICATE",
  );
  await fill("[name=reference]", "TX123");
  await until(
    '!document.querySelector(".checkout-form button[type=submit]")?.disabled',
    "retry ready",
  );
  await click("Confirm & Place Order");
  await until(
    'location.pathname.includes("/order-success/") && document.body.innerText.includes("Awaiting Verification")',
    "created awaiting order",
  );
  assert.equal(created, 1);
  assert.equal(order.paidTotal, "0.00");
  for (const width of [1366, 390]) await shot("awaiting-verification", width);
  await evaluate('document.documentElement.dataset.theme="light"');
  await shot("success-light", 1366);
  await navigate(3039, `/orders/${orderId}`);
  await until(
    'document.body.innerText.includes("Order items")',
    "admin detail",
  );
  for (const heading of [
    "Order items",
    "Customer",
    "Shipping",
    "Payment",
    "Order timeline",
    "Notes",
    "Where this order came from",
    "OTP verification",
    "Tracking events",
    "Device & technical",
    "Raw data",
  ])
    assert(
      await evaluate(
        `document.body.textContent.includes(${JSON.stringify(heading)})`,
      ),
    );
  assert(
    await evaluate(`!!document.querySelector('a[href="tel:01711111111"]')`),
  );
  assert(
    await evaluate(
      `!!document.querySelector('a[href="https://wa.me/8801711111111"]')`,
    ),
  );
  for (const width of [1366, 390]) await shot("admin-review", width);
  await evaluate(
    'document.documentElement.dataset.theme="light"; document.documentElement.classList.remove("dark")',
  );
  await shot("admin-review-light", 1366);
  await evaluate(
    'document.documentElement.dataset.theme="dark"; document.documentElement.classList.add("dark")',
  );

  assert.equal(
    await evaluate('!!document.querySelector("select[name=action]")'),
    false,
    "Approval must be absent from order details",
  );
  await navigate(3039, `/orders?manage=${orderId}`);
  await until(
    'document.body.innerText.includes("Submit payment review")',
    "review from All Orders",
  );
  for (const width of [1366, 390]) await shot("all-orders-review", width);
  await evaluate(
    '(()=>{let el=document.querySelector("select[name=action]");el.value="reject";el.dispatchEvent(new Event("change",{bubbles:true}))})()',
  );
  await fill("[name=reason]", "No matching receipt");
  await click("Submit payment review");
  await until(
    '!document.body.innerText.includes("Submit payment review")',
    "rejected",
  );
  assert.equal(rejected, 1);
  assert.equal(order.paidTotal, "0.00");
  await navigate(3038, `/orders/${orderId}`);
  await until(
    'document.body.innerText.includes("No matching receipt")',
    "customer rejection",
  );
  await until(
    'Array.from(document.querySelectorAll(".ordered-product img")).some(img => img.complete && img.naturalWidth > 0 && img.src.includes("/uploads/order-fixture.png"))',
    "customer order image resolves and loads",
  );
  await fill("[name=sender]", "01711111111");
  await fill("[name=reference]", "TX456");
  await click("Resubmit payment reference");
  await until(
    'document.body.innerText.includes("Awaiting Verification")',
    "resubmitted",
  );
  await navigate(3039, `/orders?manage=${orderId}`);
  await until(
    'document.body.innerText.includes("Submit payment review")',
    "second review",
  );
  await click("Submit payment review");
  await until(
    '!document.body.innerText.includes("Submit payment review")',
    "confirmed",
  );
  assert.equal(approved, 1);
  assert.equal(order.paymentStatus, "PAID");
  await navigate(3038, `/orders/${orderId}`);
  await until(
    'document.body.innerText.includes("Payment verified")',
    "verified customer order",
  );
  assert.equal(
    await evaluate('!!document.querySelector("[name=reference]")'),
    false,
  );
  await navigate(3039, "/orders");
  await until(
    'document.body.innerText.includes("Update status")',
    "All Orders actions",
  );
  await click("Update status");
  await until(
    'document.body.innerText.includes("Save order status")',
    "quick status form",
  );
  await evaluate(
    '(() => { const button = [...document.querySelectorAll("dialog button")].find(element => element.textContent.trim() === "Save order status"); button.click(); button.click(); })()',
  );
  await until(
    'document.body.innerText.includes("Order updated successfully.")',
    "status update saved",
  );
  assert.equal(order.status, "PROCESSING");
  assert.equal(
    statusUpdates,
    1,
    "Rapid duplicate status submissions must mutate once",
  );
  await click("Close");
  await until('!document.querySelector("dialog[open]")', "actions dismissed");
  for (const width of [1366, 390]) await shot("all-orders-actions", width);
  await navigate(3039, `/orders/${orderId}`);
  await until(
    '!!document.querySelector("#order-internal-note")',
    "internal note controls",
  );
  await fill("#order-internal-note", "Fixture order detail note");
  await click("Add note");
  await until(
    'document.body.innerText.includes("Fixture order detail note")',
    "note persisted and details refreshed",
  );
  await click("Courier details");
  await until(
    'document.querySelector("#order-courier")?.open === true',
    "courier quick action opens workflow",
  );
  assert(
    await evaluate(
      '!!document.querySelector("#order-courier input[name=trackingNumber]")',
    ),
  );
  await navigate(3038, `/orders/${orderId}?payment=success`);
  await until(
    'location.pathname.includes("/order-success/") && !!document.querySelector(".order-success")',
    "gateway return uses actual order confirmation",
  );
  await navigate(3038, "/cart");
  await until(
    '!!document.querySelector(".cart-drawer[open]")',
    "legacy cart entry opens drawer",
  );
  await command("Emulation.setDeviceMetricsOverride", {
    width: 1366,
    height: 950,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await pause(300);
  await command("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: 10,
    y: 300,
    button: "left",
    clickCount: 1,
  });
  await command("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: 10,
    y: 300,
    button: "left",
    clickCount: 1,
  });
  await until(
    '!document.querySelector(".cart-drawer[open]")',
    "outside click closes drawer",
  );
  // Actual backend snapshots distinguish the submitted advance from credited payment.
  order.paymentPlan = "PARTIAL_ADVANCE";
  order.paymentOption = "PARTIAL_ADVANCE";
  order.paymentStatus = "UNPAID";
  order.grandTotal = "560.00";
  order.paidTotal = "0.00";
  order.amountDueOnDelivery = "500.00";
  order.manualPayments = [
    {
      ...order.manualPayments[0],
      plan: "PARTIAL_ADVANCE",
      status: "awaiting_verification",
      amountDueNow: "60.00",
      amountDueOnDelivery: "500.00",
      reference: "ADVANCE60",
    },
  ];
  await navigate(3038, `/order-success/${orderId}`);
  await until(
    'document.querySelector(".order-success")?.innerText.includes("Advance submitted")',
    "partial advance confirmation",
  );
  const confirmationFacts = await evaluate(
    'Object.fromEntries([...document.querySelectorAll(".success-facts > div")].map(element => [element.querySelector("dt").textContent, element.querySelector("dd").textContent]))',
  );
  assert.match(
    Object.entries(confirmationFacts).find(([key]) =>
      key.startsWith("Advance submitted"),
    )[1],
    /60\.00/,
  );
  assert.match(confirmationFacts["Verified amount paid"], /0\.00/);
  assert.match(
    Object.entries(confirmationFacts).find(([key]) =>
      key.startsWith("Pay on delivery"),
    )[1],
    /500\.00/,
  );
  assert.equal(
    confirmationFacts["Remaining amount"],
    undefined,
    "Do not present the pending advance as another delivery balance",
  );
  for (const width of [1366, 390]) await shot("partial-advance-pending", width);
  order.manualPayments[0].status = "confirmed";
  order.paymentStatus = "PARTIALLY_PAID";
  order.paidTotal = "60.00";
  await navigate(3038, `/order-success/${orderId}`);
  await until(
    'document.querySelector(".order-success")?.innerText.includes("Order Placed Successfully!")',
    "verified partial advance confirmation",
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".success-facts").innerText.includes("Advance submitted")',
    ),
    false,
  );
  assert(
    await evaluate(
      '[...document.querySelectorAll(".success-facts > div")].some(element => element.querySelector("dt").textContent === "Verified amount paid" && element.querySelector("dd").textContent.includes("60.00"))',
    ),
  );
  await navigate(3038, "/order-success/invalid-order");
  await until(
    '!!document.querySelector("[role=alert]")',
    "invalid order handled",
  );
  assert.equal(
    await evaluate('!!document.querySelector(".order-success")'),
    false,
  );
  await navigate(3038, "/checkout/payment");
  await until(
    'location.pathname === "/checkout"',
    "payment without draft returns to checkout",
  );
  if (interceptionError) throw interceptionError;
  console.log(
    "PASS: Explicit delivery/payment selection, neutral previews, field alignment, cart and checkout flow, order image loading, All Orders payment review/reject/approve, resubmission, single status mutation on rapid clicks, refreshed list, compact detail view, gateway returns and invalid-order handling; desktop/mobile overflow checks and screenshots. Fixtures only; no real database or transfers.",
  );
} catch (error) {
  console.error(error);
  throw error;
} finally {
  if (ws?.readyState === WebSocket.OPEN)
    await command("Browser.close").catch(() => {});
  ws?.close();
  chrome?.kill();
  for (const child of children) child.kill();
  api?.closeAllConnections();
  api?.close();
  await pause(500);
  if (
    resolve(dirname(profile)) === resolve(tmpdir()) &&
    basename(profile).startsWith("ds-checkout-redesign-")
  )
    try {
      rmSync(profile, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      });
    } catch (error) {
      console.log("Temporary browser profile cleanup deferred:", error.code);
    }
}
