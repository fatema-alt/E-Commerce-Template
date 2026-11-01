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
  attempts = 0;
function plans() {
  return [
    {
      plan: "FULL_PAYMENT",
      available: true,
      total: "535.00",
      payableNow: "535.00",
      amountDueOnDelivery: "0.00",
      prepaidDiscount: "25.00",
      couponDiscount: "0.00",
    },
    {
      plan: "PARTIAL_ADVANCE",
      available: true,
      total: "560.00",
      payableNow: "60.00",
      amountDueOnDelivery: "500.00",
      prepaidDiscount: "0.00",
      couponDiscount: "0.00",
    },
    {
      plan: "COD",
      available: settings.codEnabled,
      total: "560.00",
      payableNow: "0.00",
      amountDueOnDelivery: "560.00",
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
  if (p === "/shop/payment-methods") return { settings, methods };
  if (p === "/shop/me") return { user: null };
  if (p === "/shop/quote") {
    const plan =
      plans().find((plan) => plan.plan === body.paymentOption) || plans()[0];
    return {
      ...plan,
      paymentOption: plan.plan,
      plans: plans(),
      items: body.items.map((line) => ({
        ...line,
        name: "Fixture item",
        unitPrice: "500.00",
        lineTotal: "500.00",
      })),
      subtotal: "500.00",
      shipping: "60.00",
      tax: "0.00",
      discount: plan.prepaidDiscount,
      onlinePaymentDiscount: plan.prepaidDiscount,
      shippingRates: { insideDhaka: 60, outsideDhaka: 60, freeAbove: null },
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
    patterns: [{ urlPattern: "*://*/api/v1/*" }],
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
  await navigate(3038, "/checkout");
  await until(
    '!!document.querySelector("input[value=FULL_PAYMENT]")',
    "payment plans",
  );
  for (const id of ["FULL_PAYMENT", "PARTIAL_ADVANCE", "COD"])
    assert(await evaluate(`!!document.querySelector('input[value=${id}]')`));
  assert.equal(
    await evaluate('document.body.innerText.includes("SSLCommerz")'),
    false,
  );
  await fill("[name=name]", "Fixture customer");
  await fill("[name=phone]", "01711111111");
  await fill("[name=address]", "Fixture address");
  await fill("[name=city]", "Dhaka");
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
    '!!document.querySelector("[name=senderInfo]")',
    "prepaid fields",
  );
  await evaluate(
    '(()=>{const el=document.querySelector("[name=methodCategory]");el.value="bank";el.dispatchEvent(new Event("change",{bubbles:true}))})()',
  );
  await until(
    'document.body.innerText.includes("123456789")',
    "bank routing details",
  );
  await evaluate(
    '(()=>{const el=document.querySelector("[name=methodCategory]");el.value="mobile_banking";el.dispatchEvent(new Event("change",{bubbles:true}))})()',
  );
  await fill("[name=senderInfo]", "01711111111");
  await fill("[name=reference]", "DUPLICATE");
  await until(
    '!document.querySelector(".checkout-form button[type=submit]")?.disabled',
    "ready",
  );
  for (const width of [1366, 390]) await shot("checkout", width);
  await evaluate('document.querySelector(".consent-row input").click()');
  await click("Confirm My Order");
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
  await click("Confirm My Order");
  await until(
    'location.pathname.includes("/orders/") && document.body.innerText.includes("Awaiting Verification")',
    "created awaiting order",
  );
  assert.equal(created, 1);
  assert.equal(order.paidTotal, "0.00");
  for (const width of [1366, 390]) await shot("awaiting-verification", width);
  await navigate(3039, `/orders/${orderId}`);
  await until(
    'document.body.innerText.includes("Submit payment review")',
    "admin review",
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
        `document.body.innerText.includes(${JSON.stringify(heading)})`,
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
  await fill("[name=sender]", "01711111111");
  await fill("[name=reference]", "TX456");
  await click("Resubmit payment reference");
  await until(
    'document.body.innerText.includes("Awaiting Verification")',
    "resubmitted",
  );
  await navigate(3039, `/orders/${orderId}`);
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
  if (interceptionError) throw interceptionError;
  console.log(
    "PASS: Plans settings, Methods form, all three checkout plans, no online gateways, duplicate feedback with retained input, awaiting verification, admin rejection, customer resubmission, approval and paid state; 1366px/390px overflow checks and screenshots. Fixtures only; no real database or transfers.",
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
