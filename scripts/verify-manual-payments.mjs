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
const profile = mkdtempSync(join(tmpdir(), "ds-manual-payments-"));
const artifacts = join(root, ".manual-payment-check");
mkdirSync(artifacts, { recursive: true });
const account = {
  id: "MANUAL_BKASH",
  label: "bKash (manual)",
  accountName: "Fixture recipient",
  accountNumber: "01700000000",
  accountType: "personal",
  instructions: "Confirm recipient in your mobile app.",
};
const accounts = [
  account,
  {
    ...account,
    id: "MANUAL_NAGAD",
    label: "Nagad (manual)",
    accountType: "merchant",
  },
  {
    ...account,
    id: "BANK_TRANSFER",
    label: "Bank Transfer",
    accountType: "bank",
    bankName: "Fixture bank",
    branch: "Fixture branch",
  },
];
const gateways = accounts.map((a) => ({
  provider: a.id,
  title: a.label,
  isEnabled: true,
  isSandbox: false,
  config: {
    accountName: a.accountName,
    accountNumber: a.accountNumber,
    accountType: a.accountType,
    instructions: a.instructions,
    ...(a.bankName ? { name: a.bankName, branch: a.branch } : {}),
  },
}));
gateways.push(
  ...["COD", "BKASH", "SSLCOMMERZ"].map((provider) => ({
    provider,
    title: provider,
    isEnabled: false,
    isSandbox: false,
    config: {},
  })),
);
const methods = () => ({
  methods: gateways.map((g) => ({
    id: g.provider,
    label: g.title,
    enabled: g.isEnabled,
  })),
  manualTransfers: accounts.filter(
    (a) => gateways.find((g) => g.provider === a.id)?.isEnabled,
  ),
  bank: {
    name: "Fixture bank",
    accountName: account.accountName,
    accountNumber: account.accountNumber,
    branch: "Fixture branch",
  },
  options: {
    optionAEnabled: false,
    optionBEnabled: false,
    optionCEnabled: false,
    optionCDiscountPercent: 0,
    optionCDiscountFixed: 0,
  },
});
const orderId = "00000000-0000-4000-8000-000000000001";
const productId = "00000000-0000-4000-8000-000000000002";
const order = {
  id: orderId,
  orderNumber: "DS-MANUAL-TEST",
  version: 1,
  status: "PENDING",
  paymentStatus: "UNPAID",
  paymentMethod: "MANUAL",
  paymentOption: "MANUAL_BKASH",
  grandTotal: "560.00",
  subtotal: "500.00",
  shippingTotal: "60.00",
  taxTotal: "0.00",
  discountTotal: "0.00",
  paidTotal: "0.00",
  refundedTotal: "0.00",
  refundableBalance: "0.00",
  amountDueOnDelivery: "0.00",
  customerName: "Fixture customer",
  customerPhone: "01711111111",
  createdAt: "2026-10-31T00:00:00Z",
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
  addresses: [],
  shipments: [],
  returns: [],
  events: [],
  notes: [],
  payments: [],
  manualPayment: { account, submissions: [] },
};
let attempts = 0,
  created = 0,
  saves = 0,
  approved = 0,
  rejected = 0;
const claims = () => {
  order.manualPayment.submissions = order.payments.map((p) => ({
    ...p,
    reference: p.providerReference,
    rejectionReason: p.metadata.rejectionReason,
  }));
};
async function response(path, method, body) {
  const p = path.replace("/api/v1", "");
  if (p === "/auth/me")
    return {
      role: "SUPER_ADMIN",
      id: "fixture-admin",
      email: "fixture@example.invalid",
    };
  if (p === "/admin/payments/settings")
    return { gateways, paymentOptions: methods().options };
  if (p.startsWith("/admin/payments/settings/") && method === "PUT") {
    const provider = p.split("/").pop();
    Object.assign(
      gateways.find((g) => g.provider === provider),
      body,
    );
    saves++;
    return { ok: true };
  }
  if (p === "/shop/payment-methods") return methods();
  if (p === "/shop/me") return { user: null };
  if (p === "/shop/quote")
    return {
      items: body.items.map((line) => ({
        ...line,
        name: "Fixture item",
        unitPrice: "500.00",
        lineTotal: "500.00",
      })),
      subtotal: "500.00",
      shipping: "60.00",
      tax: "0.00",
      total: "560.00",
      shippingRates: { insideDhaka: 60, outsideDhaka: 60, freeAbove: null },
      quoteToken: "fixture-only",
    };
  if (p === "/shop/orders" && method === "POST") {
    assert.equal(body.paymentMethod, "MANUAL");
    assert.equal(body.paymentOption, "MANUAL_BKASH");
    created++;
    return order;
  }
  if (p === `/shop/orders/${orderId}/manual-payment`) {
    attempts++;
    if (attempts === 1)
      return { status: 503, message: "Fixture temporary submission error" };
    assert.equal(body.reference, "TX123");
    assert.equal(body.sender, "01711111111");
    order.payments = [
      {
        id: "00000000-0000-4000-8000-000000000003",
        provider: "manual_bkash",
        providerReference: "TX123",
        amount: "560.00",
        type: "PAYMENT",
        status: "PENDING",
        metadata: {
          sender: body.sender,
          verification: "CUSTOMER_CLAIM_PENDING",
        },
        createdAt: order.createdAt,
      },
    ];
    order.version++;
    claims();
    return { ok: true, status: "PENDING" };
  }
  if (p === `/orders/${orderId}/payments`) {
    assert.equal(body.version, order.version);
    assert.equal(body.kind, "MANUAL_VERIFIED");
    assert.equal(body.reference, "TX123");
    assert(body.evidence.length >= 10);
    order.payments[0].status = "SUCCEEDED";
    order.paymentStatus = "PAID";
    order.paidTotal = "560.00";
    order.version++;
    approved++;
    claims();
    return order;
  }
  if (
    p ===
    `/orders/${orderId}/payments/00000000-0000-4000-8000-000000000003/reject`
  ) {
    assert.equal(body.version, order.version);
    assert(body.note.length >= 5);
    order.payments[0].status = "FAILED";
    order.payments[0].metadata.rejectionReason = body.note;
    order.version++;
    rejected++;
    claims();
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
    `(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing input '+${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`,
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
    name + " has horizontal overflow at " + width,
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
              value: "GET,PUT,POST,OPTIONS",
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
    `!!document.querySelector('[aria-label="Manual mobile payments"] form')`,
    "manual settings",
  );
  await fill(
    '[aria-label="Manual mobile payments"] form input[inputmode=tel]',
    "01800000000",
  );
  await click("Save bKash (manual)");
  await until(
    'document.body.innerText.includes("settings saved successfully")',
    "settings persisted",
  );
  assert.equal(gateways[0].config.accountNumber, "01800000000");
  assert.equal(saves, 1);
  for (const width of [1366, 390]) await shot("admin-settings", width);
  console.log(
    "PASS: manual recipient settings save without API credentials; desktop and 390px",
  );
  await navigate(3038, "/");
  const cart = [
    {
      productId,
      slug: "fixture",
      name: "Fixture item",
      quantity: 1,
      price: 500,
    },
  ];
  await evaluate(
    `localStorage.setItem('commerce-cart-v1', ${JSON.stringify(JSON.stringify(cart))})`,
  );
  await navigate(3038, "/checkout");
  await until(
    '!!document.querySelector("input[value=MANUAL_NAGAD]")',
    "manual checkout options",
  );
  for (const id of ["MANUAL_BKASH", "MANUAL_NAGAD", "BANK_TRANSFER"])
    assert(await evaluate(`!!document.querySelector('input[value=${id}]')`));
  assert.equal(
    await evaluate('!!document.querySelector("input[value=OPTION_B]")'),
    false,
  );
  for (const width of [1366, 390]) await shot("checkout", width);
  await fill("[name=name]", "Fixture customer");
  await fill("[name=phone]", "01711111111");
  await fill("[name=address]", "Fixture address");
  await fill("[name=city]", "Dhaka");
  await until(
    '!document.querySelector(".checkout-form button[type=submit]")?.disabled',
    "checkout ready",
  );
  await evaluate('document.querySelector(".consent-row input").click()');
  await evaluate('document.querySelector(".checkout-form").requestSubmit()');
  await until(
    'location.pathname.includes("/orders/") && !!document.querySelector("input[name=sender]")',
    "created manual order",
  );
  assert.equal(created, 1);
  for (const width of [1366, 390]) await shot("order-instructions", width);
  await fill("[name=sender]", "01711111111");
  await fill("[name=reference]", "TX123");
  await click("Submit transaction for verification");
  await until(
    'document.body.innerText.includes("Fixture temporary submission error")',
    "failed submission",
  );
  assert.equal(
    await evaluate('document.querySelector("[name=reference]").value'),
    "TX123",
  );
  await click("Submit transaction for verification");
  await until(
    'document.body.innerText.includes("Transaction submitted")',
    "pending verification",
  );
  assert.equal(attempts, 2);
  assert.equal(order.paymentStatus, "UNPAID");
  assert.equal(order.paidTotal, "0.00");
  console.log(
    "PASS: manual checkout, order instructions, failed submission retains input, reference submission stays UNPAID",
  );
  await navigate(3039, `/orders/${orderId}`);
  await until(
    'document.body.innerText.includes("Customer transfer — awaiting verification")',
    "admin pending claim",
  );
  for (const width of [1366, 390]) await shot("admin-review", width);
  await fill(
    '[aria-label="Pending manual transfer"] [name=note]',
    "No matching transfer found",
  );
  await click("Reject payment claim");
  await until(
    `!document.querySelector('[aria-label="Pending manual transfer"]')`,
    "claim rejected",
  );
  assert.equal(rejected, 1);
  assert.equal(order.paidTotal, "0.00");
  await navigate(3038, `/orders/${orderId}`);
  await until(
    'document.body.innerText.includes("No matching transfer found")',
    "customer rejection reason",
  );
  assert(await evaluate('!!document.querySelector("input[name=sender]")'));
  order.payments[0].status = "PENDING";
  delete order.payments[0].metadata.rejectionReason;
  order.version++;
  claims();
  await navigate(3039, `/orders/${orderId}`);
  await until(
    `!!document.querySelector('[aria-label="Pending manual transfer"]')`,
    "approval fixture",
  );
  await fill(
    '[aria-label="Pending manual transfer"] [name=evidence]',
    "Receipt independently checked in account",
  );
  await click("Confirm verified transfer");
  await until(
    `!document.querySelector('[aria-label="Pending manual transfer"]')`,
    "claim approved",
  );
  assert.equal(approved, 1);
  assert.equal(order.paymentStatus, "PAID");
  await navigate(3038, `/orders/${orderId}`);
  await until(
    'document.body.innerText.includes("Payment received. No transfer is needed.")',
    "customer verified state",
  );
  assert.equal(
    await evaluate('!!document.querySelector("input[name=sender]")'),
    false,
  );
  if (interceptionError) throw interceptionError;
  console.log(
    "PASS: SUPER_ADMIN rejection with customer feedback and approval reflected on order; no transfer form after PAID",
  );
  console.log(
    "PASS: screenshot artifacts in .manual-payment-check; no real accounts or transactions used",
  );
} finally {
  ws?.close();
  chrome?.kill();
  for (const child of children) child.kill();
  api?.closeAllConnections();
  api?.close();
  await pause(500);
  if (basename(profile).startsWith("ds-manual-payments-"))
    rmSync(profile, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
}
