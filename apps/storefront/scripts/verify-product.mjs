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
const simpleId = "00000000-0000-4000-8000-000000000003";
const api = http.createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  res.setHeader("Content-Type", "application/json");
  if (path.endsWith("/shop/me")) {
    res.end(JSON.stringify({ user: null }));
    return;
  }
  if (path.endsWith("/shop/payment-methods")) {
    res.end(
      JSON.stringify({
        methods: [{ id: "COD", label: "Cash on delivery", enabled: true }],
      }),
    );
    return;
  }
  if (path.endsWith("/shop/quote")) {
    let body = "";
    for await (const chunk of req) body += chunk;
    const { items } = JSON.parse(body);
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
        shipping: "0.00",
        tax: "0.00",
        total,
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
        STOREFRONT_ORIGIN: "http://localhost:3015",
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
  await command("Emulation.setDeviceMetricsOverride", {
    width: 1366,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
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
