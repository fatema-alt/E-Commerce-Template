// Test script to verify the Smart Adaptive Product Image Gallery for DS Mart
// Tests landscape, portrait, square, and unusual aspect ratios across desktop, tablet, and mobile.
import http from "node:http";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "../apps/storefront");
const browser =
  process.env.PRODUCT_TEST_BROWSER ||
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].find(existsSync);

assert.ok(browser, "Chrome/Edge executable required for testing.");

const profile = mkdtempSync(join(tmpdir(), "ds-gallery-"));
const artifacts = resolve(app, ".product-check");
mkdirSync(artifacts, { recursive: true });

// Mock products representing the user's specific items and aspect ratios
const mockProducts = {
  // 1. FlexiLife 3 in 1 Combo – Landscape (16:9 / 1200x675)
  "flexilife-3-in-1-combo": {
    type: "SIMPLE",
    id: "00000000-0000-4000-8000-000000000001",
    slug: "flexilife-3-in-1-combo",
    name: "FlexiLife 3 in 1 Combo",
    sku: "DS-FLEXI-3IN1",
    brand: "FlexiLife",
    price: "1850.00",
    effectivePrice: "1850.00",
    availableStock: 12,
    currency: "BDT",
    description: "Versatile 3 in 1 combo set engineered for flexibility and comfort.",
    shortDescription: "3 in 1 ergonomic combo with premium accessories.",
    images: [
      { url: "/uploads/mock-landscape.svg", altText: "FlexiLife Combo Landscape View", isPrimary: true },
      { url: "/uploads/mock-landscape-2.svg", altText: "FlexiLife Detail View" },
    ],
  },
  // 2. Unique Magic Writing Book – Portrait (9:16 / 675x1200)
  "unique-magic-writing-book": {
    type: "SIMPLE",
    id: "00000000-0000-4000-8000-000000000002",
    slug: "unique-magic-writing-book",
    name: "Unique Magic Writing Book",
    sku: "DS-MAGIC-BOOK",
    brand: "Magic Book",
    price: "450.00",
    effectivePrice: "450.00",
    availableStock: 25,
    currency: "BDT",
    description: "Reusable grooved practice copybook set for kids with disappearing ink.",
    shortDescription: "Magic calligraphy and drawing practice book for early learning.",
    images: [
      { url: "/uploads/mock-portrait.svg", altText: "Magic Writing Book Front Cover", isPrimary: true },
      { url: "/uploads/mock-portrait-2.svg", altText: "Magic Writing Book Inside Pages" },
    ],
  },
  // 3. QY33 Wireless Microphone – Square (1:1 / 800x800)
  "qy33-wireless-microphone": {
    type: "SIMPLE",
    id: "00000000-0000-4000-8000-000000000003",
    slug: "qy33-wireless-microphone",
    name: "QY33 Wireless Microphone",
    sku: "DS-QY33-WLMIC",
    brand: "QY33",
    price: "3500.00",
    effectivePrice: "3500.00",
    availableStock: 8,
    currency: "BDT",
    description: "Professional 360° omnidirectional lavalier microphone with noise cancellation.",
    shortDescription: "Ultra-low latency wireless dual mic system for vlogging.",
    images: [
      { url: "/uploads/mock-square.svg", altText: "QY33 Wireless Microphone In-Case", isPrimary: true },
      { url: "/uploads/mock-square-2.svg", altText: "QY33 Dual Transmitters" },
    ],
  },
  // 4. Unusual Aspect Ratio – Ultra-wide Panoramic (3:1 / 1500x500)
  "panoramic-soundbar": {
    type: "SIMPLE",
    id: "00000000-0000-4000-8000-000000000004",
    slug: "panoramic-soundbar",
    name: "Panoramic Ultra-Wide Soundbar",
    sku: "DS-PANO-BAR",
    brand: "AcousticLab",
    price: "8500.00",
    effectivePrice: "8500.00",
    availableStock: 5,
    currency: "BDT",
    description: "Ultra-wide 3:1 panoramic Dolby Atmos soundbar for immersive theater sound.",
    shortDescription: "Wide aspect audiobar with built-in dual subwoofers.",
    images: [
      { url: "/uploads/mock-ultrawide.svg", altText: "Ultra-wide Soundbar", isPrimary: true },
    ],
  },
};

const api = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;
  res.setHeader("Content-Type", "application/json");

  // SVG Mock Images with precise aspect ratios
  if (path.startsWith("/uploads/")) {
    res.setHeader("Content-Type", "image/svg+xml");
    if (path.includes("landscape")) {
      // 16:9 Landscape
      res.end(
        `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><rect width="1200" height="675" fill="#1e3a8a"/><circle cx="600" cy="337" r="180" fill="#3b82f6"/><text x="600" y="350" font-family="Arial" font-size="44" fill="#ffffff" text-anchor="middle" font-weight="bold">FLEXILIFE 3 IN 1 (16:9)</text></svg>`
      );
      return;
    }
    if (path.includes("portrait")) {
      // 9:16 Portrait
      res.end(
        `<svg xmlns="http://www.w3.org/2000/svg" width="675" height="1200" viewBox="0 0 675 1200"><rect width="675" height="1200" fill="#047857"/><circle cx="337" cy="600" r="180" fill="#10b981"/><text x="337" y="610" font-family="Arial" font-size="34" fill="#ffffff" text-anchor="middle" font-weight="bold">MAGIC BOOK (9:16)</text></svg>`
      );
      return;
    }
    if (path.includes("square")) {
      // 1:1 Square
      res.end(
        `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><rect width="800" height="800" fill="#6d28d9"/><circle cx="400" cy="400" r="220" fill="#8b5cf6"/><text x="400" y="415" font-family="Arial" font-size="40" fill="#ffffff" text-anchor="middle" font-weight="bold">QY33 MIC (1:1)</text></svg>`
      );
      return;
    }
    if (path.includes("ultrawide")) {
      // 3:1 Ultra-wide
      res.end(
        `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="500" viewBox="0 0 1500 500"><rect width="1500" height="500" fill="#b45309"/><text x="750" y="270" font-family="Arial" font-size="48" fill="#ffffff" text-anchor="middle" font-weight="bold">SOUNDBAR (3:1)</text></svg>`
      );
      return;
    }
    res.statusCode = 404;
    res.end();
    return;
  }

  if (path.includes("/storefront/products/")) {
    const slug = path.split("/").pop();
    const found = mockProducts[slug];
    if (found) {
      res.end(JSON.stringify(found));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ message: "Product not found" }));
    }
    return;
  }

  if (path.endsWith("/storefront/cms/SITE_SETTINGS/default")) {
    res.end(JSON.stringify({ content: { storeName: "DS Mart" }, assets: [], version: 1 }));
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
  throw new Error("Timed out waiting for: " + label);
}

async function navigate(path) {
  await command("Page.navigate", { url: "http://localhost:3017" + path });
  await until('document.readyState === "complete"', "page load");
  await pause(350);
}

function pass(label) {
  console.log("  ✓ PASS: " + label);
}

try {
  console.log("\n========================================================");
  console.log("Starting Smart Adaptive Image Gallery Test Suite");
  console.log("========================================================\n");

  await new Promise((resolve) => api.listen(4115, "127.0.0.1", resolve));

  server = spawn(
    process.execPath,
    [resolve(app, "node_modules/next/dist/bin/next"), "start", "-p", "3017"],
    {
      cwd: app,
      env: {
        ...process.env,
        STOREFRONT_API_BASE_URL: "http://127.0.0.1:4115/api/v1",
        STOREFRONT_ORIGIN: "http://localhost:3017/",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    }
  );

  let serverReady = false;
  for (let i = 0; i < 80; i++) {
    try {
      await fetch("http://localhost:3017/icon.svg");
      serverReady = true;
      break;
    } catch {
      await pause(250);
    }
  }
  assert.ok(serverReady, "Production server failed to start.");

  chrome = spawn(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=9235",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true }
  );

  let targets;
  for (let i = 0; i < 100; i++) {
    try {
      targets = await (await fetch("http://localhost:9235/json")).json();
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
  await command("Emulation.setFocusEmulationEnabled", { enabled: true });

  // --------------------------------------------------------------------------
  // TEST 1: FlexiLife 3 in 1 Combo (Landscape Image: 16:9)
  // --------------------------------------------------------------------------
  console.log("1. Testing FlexiLife 3 in 1 Combo (Landscape 16:9 Image)...");
  await command("Emulation.setDeviceMetricsOverride", {
    width: 1366,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await navigate("/product/flexilife-3-in-1-combo");
  await until('!!document.querySelector(".gallery-main")', "gallery mounted");

  // Check 1:1 gallery container aspect ratio
  const landscapeBox = await evaluate(`(()=>{
    const el = document.querySelector(".gallery-main");
    const rect = el.getBoundingClientRect();
    return { width: Math.round(rect.width), height: Math.round(rect.height), ratio: (rect.width / rect.height).toFixed(2) };
  })()`);
  assert.equal(landscapeBox.width, landscapeBox.height, "Gallery container must have exact 1:1 aspect ratio");
  pass("Gallery container maintains strict 1:1 aspect ratio on desktop");

  // Check adaptive background layer presence and styling
  const bgData = await evaluate(`(()=>{
    const bgWrap = document.querySelector(".pdp-gallery-bg");
    const bgBlur = document.querySelector(".pdp-gallery-bg-blur");
    if (!bgWrap || !bgBlur) return null;
    const style = window.getComputedStyle(bgBlur);
    return {
      hasBg: true,
      bgImage: bgBlur.style.backgroundImage,
      filter: style.filter,
      opacity: parseFloat(style.opacity),
      width: Math.round(bgWrap.getBoundingClientRect().width),
      containerWidth: Math.round(document.querySelector(".gallery-main").getBoundingClientRect().width),
    };
  })()`);
  assert.ok(bgData && bgData.hasBg, "Adaptive background layer must exist");
  assert.ok(bgData.bgImage.includes("mock-landscape.svg"), "Background must use the active product image");
  assert.ok(bgData.filter.includes("blur"), "Background must have blur effect applied");
  assert.ok(bgData.opacity > 0 && bgData.opacity <= 0.45, "Background opacity must remain subtle to not distract");
  console.log("bgData:", bgData);
  assert.ok(Math.abs(bgData.width - bgData.containerWidth) <= 4, "Background layer must fill the entire gallery width without voids");
  pass("Adaptive blurred background layer properly renders with subtle opacity and fills container");

  // Check original foreground image properties
  const fgData = await evaluate(`(()=>{
    const img = document.querySelector(".gallery-main img.product-image");
    const style = window.getComputedStyle(img);
    const rect = img.getBoundingClientRect();
    return {
      objectFit: style.objectFit,
      objectPosition: style.objectPosition,
      width: rect.width,
      height: rect.height,
      renderedRatio: (rect.width / rect.height).toFixed(2),
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    };
  })()`);
  assert.equal(fgData.objectFit, "contain", "Foreground image must strictly use object-fit: contain");
  assert.ok(fgData.objectPosition.includes("50%") || fgData.objectPosition.includes("center"), "Foreground must be centered");
  // 1200x675 is ratio 1.78
  assert.equal(fgData.renderedRatio, (1200 / 675).toFixed(2), "Foreground image aspect ratio must be 100% preserved (not stretched)");
  pass("Landscape foreground image maintains natural aspect ratio without cropping or distortion");

  // Screenshot landscape
  const landscapeScreenshot = await command("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(artifacts, "gallery-test-1-landscape-flexilife.png"), Buffer.from(landscapeScreenshot.data, "base64"));

  // --------------------------------------------------------------------------
  // TEST 2: Unique Magic Writing Book (Portrait Image: 9:16)
  // --------------------------------------------------------------------------
  console.log("\n2. Testing Unique Magic Writing Book (Portrait 9:16 Image)...");
  await navigate("/product/unique-magic-writing-book");
  await until('!!document.querySelector(".gallery-main")', "gallery mounted");

  const portraitBox = await evaluate(`(()=>{
    const el = document.querySelector(".gallery-main");
    const rect = el.getBoundingClientRect();
    return { width: Math.round(rect.width), height: Math.round(rect.height) };
  })()`);
  assert.equal(portraitBox.width, portraitBox.height, "Portrait product must maintain identical 1:1 container dimensions");

  const portraitFg = await evaluate(`(()=>{
    const el = document.querySelector(".gallery-main");
    const containerRect = el.getBoundingClientRect();
    const img = el.querySelector("img.product-image");
    const style = window.getComputedStyle(img);
    const rect = img.getBoundingClientRect();
    const bgBlur = document.querySelector(".pdp-gallery-bg-blur");
    return {
      objectFit: style.objectFit,
      renderedRatio: (rect.width / rect.height).toFixed(2),
      bgImage: bgBlur?.style.backgroundImage,
      rectHeight: rect.height,
      containerHeight: containerRect.height,
      rectWidth: rect.width,
      containerWidth: containerRect.width,
      isFullyVisible: rect.height <= containerRect.height && rect.width <= containerRect.width,
    };
  })()`);
  const hierarchy = await evaluate(`(()=>{
    const main = document.querySelector(".gallery-main");
    const btn = document.querySelector(".pdp-zoom-trigger");
    const inner = document.querySelector(".pdp-image-stage");
    const img = inner?.querySelector("img");
    return {
      main: main ? { h: main.getBoundingClientRect().height, ch: main.clientHeight, sh: main.scrollHeight } : null,
      btn: btn ? { h: btn.getBoundingClientRect().height, ch: btn.clientHeight, sh: btn.scrollHeight, display: window.getComputedStyle(btn).display } : null,
      inner: inner ? { h: inner.getBoundingClientRect().height, ch: inner.clientHeight, sh: inner.scrollHeight } : null,
      img: img ? { h: img.getBoundingClientRect().height, styleW: img.style.width, styleH: img.style.height, compW: window.getComputedStyle(img).width, compH: window.getComputedStyle(img).height, maxH: window.getComputedStyle(img).maxHeight } : null,
    };
  })()`);
  console.log("Hierarchy metrics:", JSON.stringify(hierarchy, null, 2));
  assert.equal(portraitFg.objectFit, "contain");
  assert.equal(portraitFg.renderedRatio, (675 / 1200).toFixed(2), "Portrait aspect ratio must be preserved");
  assert.ok(portraitFg.isFullyVisible, "Portrait image must remain fully visible within padded bounds");
  assert.ok(portraitFg.bgImage.includes("mock-portrait.svg"), "Background must match portrait image");
  pass("Portrait image centered, fully visible, with subtle background filling pillarbox space");

  const portraitScreenshot = await command("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(artifacts, "gallery-test-2-portrait-magic-book.png"), Buffer.from(portraitScreenshot.data, "base64"));

  // --------------------------------------------------------------------------
  // TEST 3: QY33 Wireless Microphone (Square Image: 1:1)
  // --------------------------------------------------------------------------
  console.log("\n3. Testing QY33 Wireless Microphone (Square 1:1 Image)...");
  await navigate("/product/qy33-wireless-microphone");
  await until('!!document.querySelector(".gallery-main")', "gallery mounted");

  const squareBox = await evaluate(`(()=>{
    const el = document.querySelector(".gallery-main");
    const rect = el.getBoundingClientRect();
    const img = el.querySelector("img.product-image");
    const imgRect = img.getBoundingClientRect();
    return {
      containerW: Math.round(rect.width),
      containerH: Math.round(rect.height),
      imgW: Math.round(imgRect.width),
      imgH: Math.round(imgRect.height),
      imgRatio: (imgRect.width / imgRect.height).toFixed(2),
    };
  })()`);
  assert.equal(squareBox.containerW, squareBox.containerH);
  assert.equal(squareBox.imgRatio, "1.00", "Square image must remain perfectly square");
  pass("Square image displays naturally with balanced spacing and 1:1 container");

  const squareScreenshot = await command("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(artifacts, "gallery-test-3-square-qy33.png"), Buffer.from(squareScreenshot.data, "base64"));

  // --------------------------------------------------------------------------
  // TEST 4: Unusual Aspect Ratio (Ultra-wide 3:1 Image)
  // --------------------------------------------------------------------------
  console.log("\n4. Testing Panoramic Soundbar (Unusual 3:1 Aspect Ratio)...");
  await navigate("/product/panoramic-soundbar");
  await until('!!document.querySelector(".gallery-main")', "gallery mounted");

  const ultraBox = await evaluate(`(()=>{
    const el = document.querySelector(".gallery-main");
    const rect = el.getBoundingClientRect();
    const img = el.querySelector("img.product-image");
    const imgRect = img.getBoundingClientRect();
    return {
      containerW: Math.round(rect.width),
      containerH: Math.round(rect.height),
      ratio: (imgRect.width / imgRect.height).toFixed(2),
      objectFit: window.getComputedStyle(img).objectFit,
    };
  })()`);
  assert.equal(ultraBox.containerW, ultraBox.containerH, "Container remains 1:1 even with extreme aspect ratio");
  assert.equal(ultraBox.ratio, (1500 / 500).toFixed(2), "Ultra-wide ratio preserved without distortion");
  assert.equal(ultraBox.objectFit, "contain");
  pass("Unusual 3:1 aspect ratio displays cleanly without breaking gallery layout");

  const ultraScreenshot = await command("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(artifacts, "gallery-test-4-ultrawide.png"), Buffer.from(ultraScreenshot.data, "base64"));

  // --------------------------------------------------------------------------
  // TEST 5: Thumbnail Gallery
  // --------------------------------------------------------------------------
  console.log("\n5. Testing Thumbnail Gallery and Selection...");
  await navigate("/product/flexilife-3-in-1-combo");
  await until('!!document.querySelector(".gallery-thumbnails")', "thumbnails mounted");

  const thumbMetrics = await evaluate(`(()=>{
    const btns = document.querySelectorAll(".gallery-thumbnails button");
    const items = [...btns].map(b => {
      const rect = b.getBoundingClientRect();
      const img = b.querySelector("img");
      const fit = img ? window.getComputedStyle(img).objectFit : "";
      return { w: Math.round(rect.width), h: Math.round(rect.height), fit };
    });
    return items;
  })()`);
  assert.ok(thumbMetrics.length >= 2, "Must have at least 2 thumbnails");
  assert.ok(thumbMetrics.every(t => t.w === t.h), "All thumbnails must maintain strict 1:1 square dimensions");
  assert.ok(thumbMetrics.every(t => t.fit === "contain"), "All thumbnail images must use object-fit: contain");
  pass("Thumbnail dimensions are consistent (1:1 square) and use object-fit: contain");

  // Test thumbnail click switches active image and background
  await evaluate('document.querySelectorAll(".gallery-thumbnails button")[1].click()');
  await pause(150);
  const switched = await evaluate(`(()=>{
    const mainImg = document.querySelector(".gallery-main img.product-image").src;
    const bgImg = document.querySelector(".pdp-gallery-bg-blur").style.backgroundImage;
    const secondThumbActive = document.querySelectorAll(".gallery-thumbnails button")[1].getAttribute("aria-pressed");
    return { mainImg, bgImg, secondThumbActive };
  })()`);
  assert.ok(switched.mainImg.includes("mock-landscape-2.svg"), "Main image switched to second image");
  assert.ok(switched.bgImg.includes("mock-landscape-2.svg"), "Background layer synced to second image");
  assert.equal(switched.secondThumbActive, "true", "Active thumbnail indicator updated");
  pass("Thumbnail click smoothly switches active image, background layer, and active state");

  // --------------------------------------------------------------------------
  // TEST 6: Zoom and Lightbox Modal
  // --------------------------------------------------------------------------
  console.log("\n6. Testing Desktop Hover Zoom and Lightbox Dialog...");

  // Hover Zoom
  await evaluate(`(()=>{
    const wrap = document.querySelector(".gallery-main");
    wrap.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    wrap.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    const rect = wrap.getBoundingClientRect();
    wrap.dispatchEvent(new MouseEvent("mousemove", {
      bubbles: true,
      clientX: rect.left + rect.width * 0.75,
      clientY: rect.top + rect.height * 0.75,
    }));
  })()`);
  await pause(200);

  const zoomScale = await evaluate(`(()=>{
    const img = document.querySelector(".gallery-main img.product-image");
    return {
      transform: img.style.transform,
      origin: img.style.transformOrigin,
    };
  })()`);
  console.log("zoomScale:", zoomScale);
  assert.ok(zoomScale.transform.includes("scale(2.1)"), "Hover zoom must scale image up to 2.1x");
  pass("Desktop hover zoom smoothly activates with cursor tracking");

  // Lightbox Modal
  await evaluate('document.querySelector(".pdp-zoom-trigger").click()');
  await pause(150);
  assert.equal(await evaluate('document.querySelector("dialog.pdp-lightbox").open'), true, "Lightbox dialog must open on click");

  const lightboxImg = await evaluate(`(()=>{
    const img = document.querySelector("dialog.pdp-lightbox .flex-1 img");
    return {
      src: img?.src,
      fit: window.getComputedStyle(img).objectFit,
      hasBgLayerInLightbox: !document.querySelector("dialog.pdp-lightbox .pdp-gallery-bg"),
    };
  })()`);
  assert.ok(lightboxImg.src.includes("mock-landscape-2.svg"), "Lightbox displays high-res active image");
  assert.equal(lightboxImg.fit, "contain", "Lightbox displays original uncropped image");
  assert.ok(lightboxImg.hasBgLayerInLightbox, "Lightbox modal does not show blurred background layer");
  pass("Lightbox modal displays original high-resolution uncropped image cleanly");

  // Dismiss Lightbox
  await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await pause(100);
  assert.equal(await evaluate('document.querySelector("dialog.pdp-lightbox").open'), false, "Escape closes lightbox");
  pass("Lightbox dismissed via Escape key");

  // --------------------------------------------------------------------------
  // TEST 7: Responsive Layouts (Tablet & Mobile)
  // --------------------------------------------------------------------------
  console.log("\n7. Testing Tablet and Mobile Responsive Layouts...");

  // Tablet (768px)
  await command("Emulation.setDeviceMetricsOverride", {
    width: 768,
    height: 1024,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await pause(150);
  const tabletBox = await evaluate(`(()=>{
    const el = document.querySelector(".gallery-main");
    const rect = el.getBoundingClientRect();
    return { w: Math.round(rect.width), h: Math.round(rect.height), overflow: document.documentElement.scrollWidth > window.innerWidth };
  })()`);
  assert.equal(tabletBox.w, tabletBox.h, "Gallery must maintain strict 1:1 on tablet (previously broken by sm:aspect-[4/3])");
  assert.equal(tabletBox.overflow, false, "No horizontal overflow on tablet");
  pass("Tablet layout maintains 1:1 aspect ratio with zero horizontal overflow");

  // Mobile (390px)
  await command("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await pause(150);
  const mobileBox = await evaluate(`(()=>{
    const el = document.querySelector(".gallery-main");
    const rect = el.getBoundingClientRect();
    return { w: Math.round(rect.width), h: Math.round(rect.height), overflow: document.documentElement.scrollWidth > window.innerWidth };
  })()`);
  assert.equal(mobileBox.w, mobileBox.h, "Gallery must maintain strict 1:1 on mobile");
  assert.equal(mobileBox.overflow, false, "No horizontal overflow on mobile");
  pass("Mobile layout maintains 1:1 aspect ratio with zero horizontal overflow");

  const mobileScreenshot = await command("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(artifacts, "gallery-test-5-mobile-390.png"), Buffer.from(mobileScreenshot.data, "base64"));

  console.log("\n========================================================");
  console.log("✓ ALL ADAPTIVE PRODUCT GALLERY TESTS PASSED SUCCESSFULLY!");
  console.log("========================================================\n");
} catch (err) {
  console.error("Test Suite Failed:", err);
  process.exitCode = 1;
} finally {
  if (chrome) chrome.kill();
  if (server) server.kill();
  if (api) api.close();
}
