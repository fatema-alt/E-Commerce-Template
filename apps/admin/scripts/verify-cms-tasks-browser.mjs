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
const profile = mkdtempSync(join(tmpdir(), "ds-cms-tasks-"));
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
async function fulfill(event) {
  const path = new URL(event.request.url).pathname.replace("/api/v1", "");
  const method = event.request.method;
  let status = 200,
    body = {};
  if (method === "OPTIONS") status = 204;
  else if (path === "/auth/me")
    body = { user: { id: "admin-test", email: "admin@test.local", role } };
  else if (path === "/admin/cms/schema")
    body = {
      documents: CMS_SCHEMAS,
      blocks: BLOCK_SCHEMAS,
      defaultTheme: DEFAULT_THEME,
    };
  else if (path === "/admin/cms/media") body = { items: [], total: 0 };
  else if (path === "/admin/cms") body = { items: [document()], total: 1 };
  else if (path === "/admin/cms/THEME/default")
    body = { ...document(), latestVersion: { version, content: themeContent } };
  else if (path === "/admin/cms/THEME/default/draft") {
    const payload = JSON.parse(event.request.postData);
    assert.equal(payload.expectedRevision, revision);
    assert.notEqual(role, "STAFF");
    themeContent = payload.content;
    revision++;
    version++;
    body = { revision, version };
  } else if (path === "/admin/cms/PAGE/home")
    body = {
      ...document(),
      key: "home",
      latestVersion: { version, content: { title: "Home", sections: [] } },
    };
  else if (path === "/admin/cms/NAVIGATION/main")
    body = {
      ...document(),
      key: "main",
      latestVersion: { version, content: { label: "Main menu", items: [] } },
    };
  else if (path.endsWith("/versions"))
    body = {
      items: [{ id: "version-1", version, createdAt: "2026-10-27T00:00:00Z" }],
      total: 1,
    };
  else if (path === "/admin/cms/SITE_SETTINGS/default/draft") {
    const payload = JSON.parse(event.request.postData);
    assert.equal(payload.expectedRevision, revision);
    assert.notEqual(role, "STAFF");
    content = payload.content;
    revision++;
    version++;
    body = { revision, version };
  } else if (path === "/admin/cms/SITE_SETTINGS/default/publish") {
    assert.equal(role, "SUPER_ADMIN");
    assert.equal(JSON.parse(event.request.postData).expectedRevision, revision);
    published = structuredClone(content);
    revision++;
    body = { revision, publishedVersion: version };
  } else if (path === "/admin/cms/SITE_SETTINGS/default") body = document();
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
  await navigate("/cms/settings");
  await until(
    '!!document.querySelector(".cms-task-editor")',
    "unified store info",
  );
  assert.deepEqual(
    await evaluate(
      '[...document.querySelectorAll("nav")].find(n=>n.getAttribute("aria-label")==="CMS navigation").querySelectorAll("a").length===6 ? [...document.querySelectorAll("nav")].find(n=>n.getAttribute("aria-label")==="CMS navigation").textContent.split("Media library")[0].match(/Store info|Look|Homepage|Pages|Menus/g) : []',
    ),
    ["Store info", "Look", "Homepage", "Pages", "Menus"],
  );
  assert.deepEqual(
    await evaluate(
      '[...document.querySelectorAll(".cms-task-editor section>h2")].map(h=>h.textContent)',
    ),
    [
      "Store identity",
      "Contact details",
      "Announcement bar",
      "Floating contact widget",
    ],
  );
  assert.equal(
    await evaluate('document.querySelector(".cms-advanced").open'),
    false,
  );
  await evaluate('document.querySelector(".cms-store-sections a").focus()');
  await command("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
  });
  await command("Input.dispatchKeyEvent", {
    type: "char",
    text: "\r",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
  });
  await command("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
  });
  await evaluate(
    '(()=>{const el=[...document.querySelectorAll("label")].find(l=>l.textContent.trim()==="Store Name").control;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(el,"Edited Store");el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));})()',
  );
  await click("Save draft");
  await until(
    'document.body.textContent.includes("Draft saved.")',
    "store saved",
  );
  assert.equal(content.storeName, "Edited Store");
  assert.equal(content.homePageKey, "landing");
  assert.equal(content.header.layout, "compact");
  assert.equal(content.announcementRibbon.items[0].text, "First CMS message");
  assert.equal(published, undefined);
  for (const path of ["/cms/announcements", "/cms/contact-widget"]) {
    await navigate(path);
    await until(
      '!!document.querySelector(".cms-task-editor")',
      "legacy route opens unified settings",
    );
  }
  await navigate("/cms/theme");
  await until(
    'document.querySelectorAll(".cms-look-presets button").length===4',
    "four theme presets",
  );
  await until(
    '!document.querySelector(".cms-look-presets button").matches(":disabled")',
    "loaded editable preset",
  );
  await evaluate('document.querySelector(".cms-look-presets button").focus()');
  await command("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
  });
  await command("Input.dispatchKeyEvent", {
    type: "char",
    text: "\r",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
  });
  await command("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
  });
  await click("Save draft");
  await until(
    'document.body.textContent.includes("Draft saved.")',
    "look saved",
  );
  assert.equal(themeContent.primary, "#00AEEF");
  assert.equal(themeContent.radius, 19);
  assert.equal(themeContent.spacing, 7);
  assert.equal(themeContent.productCardStyle, "raised");
  await evaluate('document.querySelector(".cms-advanced summary").focus()');
  await command("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
  });
  await command("Input.dispatchKeyEvent", {
    type: "char",
    text: "\r",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
  });
  await command("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
  });
  assert.equal(
    await evaluate('document.querySelector(".cms-advanced").open'),
    true,
  );
  for (const path of ["/cms/settings", "/cms/theme"]) {
    await navigate(path);
    await until(
      '!!document.querySelector(".cms-task-editor")',
      "responsive editor",
    );
    for (const theme of ["light", "dark"]) {
      await evaluate(
        "document.documentElement.dataset.theme=" + JSON.stringify(theme),
      );
      await pause(150);
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
          "cms-tasks-" + path.split("/").at(-1) + "-" + theme + "-390.png",
        ),
        Buffer.from(shot.data, "base64"),
      );
    }
  }
  role = "STAFF";
  await navigate("/cms/settings");
  await until('!!document.querySelector(".cms-task-editor")', "staff view");
  assert.equal(
    await evaluate(
      'document.querySelector(".cms-task-editor input").matches(":disabled")',
    ),
    true,
  );
  assert.equal(
    await evaluate(
      '[...document.querySelectorAll("button")].some(b=>b.textContent.trim()==="Save draft")',
    ),
    false,
  );
  role = "ADMIN";
  await navigate("/cms/theme");
  await until('!!document.querySelector(".cms-task-editor")', "admin view");
  assert.equal(
    await evaluate(
      'document.querySelector(".cms-look-presets button").matches(":disabled")',
    ),
    false,
  );
  assert.equal(
    await evaluate(
      '[...document.querySelectorAll("button")].some(b=>b.textContent.trim()==="Publish" && !b.disabled)',
    ),
    false,
  );
  if (interceptionError) throw interceptionError;
  assert.deepEqual(errors, []);
  console.log(
    "PASS: 390px unified store editor, five task areas, legacy routes, draft isolation, preserved settings, keyboard preset/Advanced controls, light/dark layout and role UI",
  );
} finally {
  ws?.close();
  chrome?.kill();
  server?.kill();
  await pause(700);
  assert.equal(dirname(resolve(profile)), resolve(tmpdir()));
  assert(basename(profile).startsWith("ds-cms-tasks-"));
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {}
}
