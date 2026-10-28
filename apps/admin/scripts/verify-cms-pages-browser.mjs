// Run after the admin production build. Uses an isolated browser profile and
// intercepted API contracts; no store records or customer data are modified.
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const browser = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(existsSync);
assert(browser, "An installed Chrome or Edge is required");
const profile = mkdtempSync(join(tmpdir(), "ds-cms-pages-"));
const artifacts = join(app, ".editor-check");
mkdirSync(artifacts, { recursive: true });
const { CMS_SCHEMAS, BLOCK_SCHEMAS, DEFAULT_THEME } =
  await import("../../api/dist/cms/cms-schema.js");
let server,
  chrome,
  ws,
  role = "SUPER_ADMIN";
let revision = 2,
  version = 1,
  published;
let themeContent = {
  ...DEFAULT_THEME,
  radius: 19,
  spacing: 7,
  productCardStyle: "raised",
};
let content = {
  homePageKey: "landing",
  header: { layout: "compact" },
  storeName: "DS Mart",
  locale: "en",
  currency: "BDT",
  announcementRibbon: {
    enabled: true,
    animation: "fade",
    intervalSeconds: 5,
    items: [
      { id: "first", enabled: true, text: "First CMS message", device: "both" },
    ],
  },
  contactWidget: {
    enabled: false,
    title: "How can we help you?",
    description: "Contact our team",
    position: "right",
    desktop: true,
    mobile: true,
    phone: { enabled: false },
  },
};
const document = () => ({
  key: "default",
  revision,
  state: "PUBLISHED",
  publishedVersionId: "version-1",
  scheduledAt: null,
  latestVersion: { version, content },
});
const requests = new Map();
let sequence = 0;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const requestId = ++sequence;
    const timer = setTimeout(() => {
      requests.delete(requestId);
      reject(new Error("CDP timeout: " + method));
    }, 15000);
    requests.set(requestId, {
      resolve: (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      reject,
    });
    ws.send(JSON.stringify({ id: requestId, method, params }));
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
    if (await evaluate(expression)) return;
    await pause(100);
  }
  throw new Error("Timed out: " + label);
}
async function navigate(path) {
  await command("Page.navigate", { url: "http://localhost:3031" + path });
  await until('document.readyState === "complete"', "page load");
}
async function click(text) {
  await until(
    `[...document.querySelectorAll('button')].some(el=>el.textContent.trim()===${JSON.stringify(text)}&&!el.disabled)`,
    "enabled " + text,
  );
  assert(
    await evaluate(
      `(()=>{const button=[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===${JSON.stringify(text)});if(!button||button.disabled)return false;button.click();return true;})()`,
    ),
    "click " + text,
  );
  await pause(80);
}
async function field(label, value, index = 0) {
  await evaluate(
    `(()=>{const label=[...document.querySelectorAll('.engagement-editor label')].filter(el=>el.textContent.trim()===${JSON.stringify(label)} && el.control?.type !== 'checkbox')[${index}];const el=label?.control||label?.querySelector('input,select');if(!el)throw Error('Missing field '+${JSON.stringify(label)});const proto=el instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await pause(80);
}
const pageDocs = new Map();
let homepageAddress = "landing",
  settingsRevision = 8;
const makePage = (key, title, published = true) => ({
  key,
  title,
  revision: 2,
  state: published ? "PUBLISHED" : "DRAFT",
  publishedVersionId: published ? "live-" + key : null,
  scheduledAt: null,
  latestVersion: { version: 1, content: { title, sections: [] } },
});
pageDocs.set("landing", makePage("landing", "Campaign Home"));
pageDocs.set("policy", makePage("policy", "Privacy Policy"));
const privateSettings = {
  storeName: "Unpublished store name",
  homePageKey: "private-home",
};
async function fulfill(event) {
  const url = new URL(event.request.url),
    path = url.pathname.replace("/api/v1", ""),
    method = event.request.method;
  let status = 200,
    body = {};
  if (method === "OPTIONS") status = 204;
  else if (path === "/auth/me")
    body = { user: { id: "actor", email: "admin@test.local", role } };
  else if (path === "/admin/cms/schema")
    body = {
      documents: CMS_SCHEMAS,
      blocks: BLOCK_SCHEMAS,
      defaultTheme: DEFAULT_THEME,
    };
  else if (path === "/admin/cms/media") body = { items: [], total: 0 };
  else if (path === "/admin/cms/homepage/context")
    body = {
      settingsKey: "default",
      settingsRevision,
      settingsPublished: true,
      homePageKey: homepageAddress,
    };
  else if (path === "/admin/cms/homepage/assign") {
    const payload = JSON.parse(event.request.postData);
    assert.equal(role, "SUPER_ADMIN");
    assert.equal(payload.expectedSettingsRevision, settingsRevision);
    const target = pageDocs.get(payload.pageKey);
    assert(target?.publishedVersionId);
    assert.equal(payload.expectedPageRevision, target.revision);
    homepageAddress = payload.pageKey;
    settingsRevision++;
    body = { homePageKey: homepageAddress, revision: settingsRevision };
  } else if (path.startsWith("/admin/cms/page-address/")) {
    const address = path.split("/").at(-1);
    body = {
      available:
        !pageDocs.has(address) &&
        !["cart", "checkout", "shop", "product"].includes(address),
    };
  } else if (path === "/admin/cms")
    body = { items: [...pageDocs.values()], total: pageDocs.size };
  else if (path.endsWith("/versions")) body = { items: [], total: 0 };
  else if (path.startsWith("/admin/cms/PAGE/")) {
    const parts = path.split("/"),
      key = parts[4],
      action = parts[5];
    let doc = pageDocs.get(key);
    if (action === "draft") {
      const payload = JSON.parse(event.request.postData);
      assert.equal(payload.expectedRevision, doc?.revision ?? 0);
      assert.notEqual(role, "STAFF");
      doc = doc || makePage(key, payload.content.title, false);
      doc.latestVersion.content = payload.content;
      doc.revision++;
      pageDocs.set(key, doc);
      body = { revision: doc.revision };
    } else if (action === "publish") {
      assert.equal(role, "SUPER_ADMIN");
      doc.publishedVersionId = "live-" + key;
      doc.state = "PUBLISHED";
      doc.revision++;
      body = { revision: doc.revision };
    } else if (doc) body = doc;
    else {
      status = 404;
      body = { message: "Not found" };
    }
  }
  await command("Fetch.fulfillRequest", {
    requestId: event.requestId,
    responseCode: status,
    responseHeaders: [
      { name: "Content-Type", value: "application/json" },
      { name: "Access-Control-Allow-Origin", value: "http://localhost:3031" },
      { name: "Access-Control-Allow-Credentials", value: "true" },
      {
        name: "Access-Control-Allow-Headers",
        value: "content-type,x-commerce-admin",
      },
      {
        name: "Access-Control-Allow-Methods",
        value: "GET,POST,PATCH,DELETE,OPTIONS",
      },
    ],
    body:
      status === 204
        ? ""
        : Buffer.from(JSON.stringify(body)).toString("base64"),
  });
}
async function typeIn(id, value) {
  await evaluate(
    "(()=>{const el=document.getElementById(" +
      JSON.stringify(id) +
      ');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(el,' +
      JSON.stringify(value) +
      ');el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));})()',
  );
  await pause(100);
}
try {
  server = spawn(
    process.execPath,
    [join(app, "node_modules/next/dist/bin/next"), "start", "-p", "3031"],
    { cwd: app, windowsHide: true, stdio: "ignore" },
  );
  for (let i = 0; i < 80; i++) {
    try {
      await fetch("http://localhost:3031");
      break;
    } catch {
      await pause(200);
    }
  }
  chrome = spawn(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=9231",
      "--user-data-dir=" + profile,
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  let targets;
  for (let i = 0; i < 80; i++) {
    try {
      targets = await (await fetch("http://localhost:9231/json")).json();
      if (targets.some((t) => t.type === "page")) break;
    } catch {}
    await pause(100);
  }
  ws = new WebSocket(
    targets.find((t) => t.type === "page").webSocketDebuggerUrl,
  );
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let interceptionError;
  const errors = [];
  ws.onmessage = (message) => {
    const event = JSON.parse(message.data);
    if (event.method === "Page.javascriptDialogOpening")
      void command("Page.handleJavaScriptDialog", { accept: true });
    if (event.method === "Fetch.requestPaused")
      void fulfill(event.params).catch((error) => (interceptionError = error));
    if (event.method === "Runtime.exceptionThrown")
      errors.push(event.params.exceptionDetails.text);
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
  await command("Emulation.setFocusEmulationEnabled", { enabled: true });
  await command("Page.bringToFront");
  await command("Fetch.enable", {
    patterns: [{ urlPattern: "*://*/api/v1/*" }],
  });
  await command("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });

  await navigate("/cms/homepage");
  await until(
    'document.querySelector("#product-title") || document.body.textContent.includes("Campaign Home")',
    "assigned homepage loaded",
  );
  assert.equal(
    await evaluate('document.body.textContent.includes("Current homepage")'),
    true,
  );
  assert.equal(
    await evaluate('document.getElementById("cms-page-url").value'),
    "/landing",
  );
  assert.equal(
    await evaluate('document.getElementById("cms-page-url").readOnly'),
    true,
  );
  await navigate("/cms/pages");
  await until('!!document.getElementById("cms-new-title")', "pages list");
  assert.equal(
    await evaluate('document.body.textContent.includes("Current homepage")'),
    true,
  );
  await typeIn("cms-new-title", "About Us");
  assert.equal(
    await evaluate('document.getElementById("cms-new-key").value'),
    "about-us",
  );
  await click("+ Create page");
  await until(
    'document.body.textContent.includes("About Us") && !!document.getElementById("cms-page-url")',
    "new page editor",
  );
  assert.equal(
    await evaluate('document.getElementById("cms-page-url").value'),
    "/about-us",
  );
  await click("Save draft");
  await until(
    'document.body.textContent.includes("Draft saved.")',
    "save new page",
  );
  assert.equal(pageDocs.get("about-us").publishedVersionId, null);
  await click("Publish latest saved version");
  await until(
    'document.body.textContent.includes("Published. This page is not your homepage.")',
    "non-homepage notice",
  );
  assert.equal(homepageAddress, "landing");
  await click("Use as homepage");
  await until(
    'document.body.textContent.includes("Current homepage") && document.body.textContent.includes("Homepage updated.")',
    "assigned new homepage",
  );
  assert.equal(homepageAddress, "about-us");
  assert.deepEqual(privateSettings, {
    storeName: "Unpublished store name",
    homePageKey: "private-home",
  });
  await navigate("/cms/homepage");
  await until(
    'document.getElementById("cms-page-url")?.value==="/about-us"',
    "homepage opens new assignment",
  );
  await navigate("/cms/pages");
  await until(
    '!!document.getElementById("cms-new-title")',
    "pages for collision",
  );
  await typeIn("cms-new-title", "About Us");
  await click("+ Create page");
  await until(
    'document.body.textContent.includes("already used or reserved")',
    "collision error",
  );
  assert.equal(pageDocs.size, 3);
  await typeIn("cms-new-title", "Checkout");
  await click("+ Create page");
  await until(
    'document.body.textContent.includes("does not use a store route")',
    "reserved error",
  );
  assert.equal(pageDocs.size, 3);
  for (const path of ["/cms/pages", "/cms/homepage"]) {
    await navigate(path);
    await until(
      'document.querySelector(".cms-homepage-status")?.textContent.includes("about-us")',
      "responsive page",
    );
    for (const theme of ["light", "dark"]) {
      await evaluate(
        "document.documentElement.dataset.theme=" + JSON.stringify(theme),
      );
      await pause(100);
      assert.equal(
        await evaluate("document.documentElement.scrollWidth<=innerWidth"),
        true,
      );
      const shot = await command("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
      });
      writeFileSync(
        join(
          artifacts,
          "cms-pages-" + path.split("/").at(-1) + "-" + theme + "-390.png",
        ),
        Buffer.from(shot.data, "base64"),
      );
    }
  }
  role = "ADMIN";
  await navigate("/cms/pages?key=policy");
  await until('!!document.getElementById("cms-page-url")', "admin page");
  assert.equal(
    await evaluate(
      '[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="Use as homepage").disabled',
    ),
    true,
  );
  assert.equal(
    await evaluate('document.body.textContent.includes("Ask a Super Admin")'),
    true,
  );
  role = "STAFF";
  await navigate("/cms/pages");
  await until(
    '!!document.querySelector(".cms-homepage-status")',
    "staff pages",
  );
  assert.equal(
    await evaluate('!!document.getElementById("cms-new-title")'),
    false,
  );
  if (interceptionError) throw interceptionError;
  assert.deepEqual(errors, []);
  console.log(
    "PASS: assigned homepage, read-only existing URLs, title/slug creation, collision/reserved handling, draft-only save, publish notice, confirmed assignment, role UI and 390px light/dark layouts",
  );
} finally {
  ws?.close();
  chrome?.kill();
  server?.kill();
  await pause(700);
  assert.equal(dirname(resolve(profile)), resolve(tmpdir()));
  assert(basename(profile).startsWith("ds-cms-pages-"));
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {}
}
