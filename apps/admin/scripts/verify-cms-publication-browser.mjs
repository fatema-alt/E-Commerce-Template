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
const profile = mkdtempSync(join(tmpdir(), "ds-cms-publish-"));
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
  publishedVersionId: liveVersion,
  scheduledAt: scheduled,
  latestVersion: { id: "version-" + version, version, content },
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
  }).catch(error=>{throw new Error(expression+" :: "+error.message);});
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
let liveVersion = "version-1",
  scheduled = null,
  draftCalls = 0,
  publishCalls = 0,
  rollbackCalls = 0,
  unpublishCalls = 0,
  forceConflict = false,
  acceptConfirm = true;
const dialogs = [];
let leaveWarnings=0;
const snapshots = new Map([[1, structuredClone(content)]]);
async function fulfill(event) {
  const path = new URL(event.request.url).pathname.replace("/api/v1", ""),
    method = event.request.method;
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
  else if (path === "/admin/cms/homepage/context")
    body = {
      settingsKey: "default",
      settingsRevision: 2,
      settingsPublished: true,
      homePageKey: "home",
    };
  else if (path.endsWith("/versions"))
    body = {
      items: [...snapshots.keys()]
        .reverse()
        .map((v) => ({
          id: "version-" + v,
          version: v,
          createdAt: "2026-10-28T00:00:00Z",
        })),
      total: snapshots.size,
    };
  else if (path.match(/\/versions\/\d+$/))
    body = {
      content: structuredClone(snapshots.get(Number(path.split("/").at(-1)))),
    };
  else if (path === "/admin/cms/SITE_SETTINGS/default/draft") {
    draftCalls++;
    const payload = JSON.parse(event.request.postData);
    assert.notEqual(role, "STAFF");
    if (forceConflict || payload.expectedRevision !== revision) {
      status = 409;
      body = { message: "Revision mismatch" };
    } else if (!payload.content.storeName) {
      status = 400;
      body = { message: "Store name is required" };
    } else {
      content = payload.content;
      revision++;
      version++;
      snapshots.set(version, structuredClone(content));
      body = { revision, version };
    }
  } else if (path === "/admin/cms/SITE_SETTINGS/default/publish") {
    assert.equal(role, "SUPER_ADMIN");
    assert.equal(JSON.parse(event.request.postData).expectedRevision, revision);
    publishCalls++;
    published = structuredClone(content);
    liveVersion = "version-" + version;
    revision++;
    body = { revision };
  } else if (path === "/admin/cms/SITE_SETTINGS/default/rollback") {
    assert.equal(role, "SUPER_ADMIN");
    const payload = JSON.parse(event.request.postData);
    assert.equal(payload.expectedRevision, revision);
    rollbackCalls++;
    liveVersion = "version-" + payload.version;
    revision++;
    body = { revision };
  } else if (path === "/admin/cms/SITE_SETTINGS/default/schedule") {
    assert.equal(role, "SUPER_ADMIN");
    scheduled = JSON.parse(event.request.postData).scheduledAt;
    revision++;
    body = { revision };
  } else if (path === "/admin/cms/SITE_SETTINGS/default/cancel-schedule") {
    scheduled = null;
    revision++;
    body = { revision };
  } else if (path === "/admin/cms/SITE_SETTINGS/default/unpublish") {
    unpublishCalls++;
    liveVersion = null;
    revision++;
    body = { revision };
  } else if (path === "/admin/cms/SITE_SETTINGS/default") body = document();
  else if (path.startsWith("/admin/cms/PAGE/")) {
    status = 404;
    body = { message: "No page yet" };
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
async function storeName(value) {
  await evaluate(
    '(()=>{const el=[...document.querySelectorAll("label")].find(l=>l.textContent.trim()==="Store Name").control;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(el,' +
      JSON.stringify(value) +
      ');el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));})()',
  );
  await pause(100);
}
const storageKeys =
  'Object.keys(localStorage).filter(key=>key.startsWith("cms-unsaved:v1:"))';
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
    if (event.method === "Page.javascriptDialogOpening") {
      dialogs.push(event.params.message);
      if(event.params.type==="beforeunload")leaveWarnings++;
      void command("Page.handleJavaScriptDialog", {
        accept: event.params.type === "beforeunload" ? true : acceptConfirm,
      });
    }
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
  await until('!!document.querySelector(".cms-task-editor")', "editor loaded");
  await until(
    'document.querySelector(".cms-publication strong")?.textContent==="Live"',
    "initial live status",
  );
  assert.equal(
    await evaluate(
      '[...document.querySelectorAll("button")].filter(b=>b.textContent.trim()==="Publish").length',
    ),
    1,
  );
  await storeName("");
  assert.equal(
    await evaluate(
      'document.querySelector(".cms-publication strong").textContent',
    ),
    "Not saved",
  );
  assert.equal(
    await evaluate(
      "JSON.parse(localStorage.getItem((" +
        storageKeys +
        ")[0])).content.storeName",
    ),
    "",
  );
  await pause(700);
  assert.equal(draftCalls, 0);
  await click("Save draft");
  await until(
    'document.body.textContent.includes("Store name is required")',
    "invalid save rejected",
  );
  assert.equal(snapshots.size, 1);
  assert.equal(
    await evaluate(
      "JSON.parse(localStorage.getItem((" +
        storageKeys +
        ")[0])).content.storeName",
    ),
    "",
  );
  await navigate("/cms/settings");
  await until(
    'document.body.textContent.includes("Unsaved changes found, restore?")',
    "recovery prompt",
  );
  assert(leaveWarnings>0,"leave-page warning remains active");
  await click("Restore unsaved changes");
  assert.equal(
    await evaluate(
      '[...document.querySelectorAll("label")].find(l=>l.textContent.trim()==="Store Name").control.value',
    ),
    "",
  );
  await storeName("Saved after recovery");
  await click("Save draft");
  await until(
    'document.querySelector(".cms-publication strong")?.textContent==="Draft changes (not live)"',
    "private saved status",
  );
  assert.equal(await evaluate(storageKeys + ".length"), 0);
  assert.equal(snapshots.size, 2);
  assert.equal(published, undefined);
  acceptConfirm = false;
  await click("Publish");
  await pause(100);
  assert.equal(publishCalls, 0);
  assert(dialogs.at(-1).includes("live site"));
  acceptConfirm = true;
  await click("Publish");
  await until(
    'document.querySelector(".cms-publication strong")?.textContent==="Live"',
    "published status",
  );
  assert.equal(publishCalls, 1);
  await evaluate(
    'document.querySelector(".cms-publication-options summary").focus()',
  );
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
  await until(
    'document.querySelector(".cms-publication-options").open',
    "keyboard history menu",
  );
  await evaluate(
    '(()=>{const el=document.getElementById("cms-schedule");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(el,"2030-01-01T12:00");el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));})()',
  );
  await click("Schedule");
  await until(
    'document.querySelector(".cms-publication strong")?.textContent==="Scheduled"',
    "scheduled status",
  );
  await click("Cancel schedule");
  await until(
    'document.querySelector(".cms-publication strong")?.textContent==="Live"',
    "cancel schedule",
  );
  await click("Restore and publish");
  await until(
    'document.body.textContent.includes("Rollback completed.")',
    "rollback done",
  );
  assert.equal(rollbackCalls, 1);
  assert(dialogs.at(-1).includes("Restore and publish saved version"));
  await click("Unpublish");
  await until(
    'document.querySelector(".cms-publication strong")?.textContent==="Saved"',
    "unpublished saved status",
  );
  assert.equal(unpublishCalls, 1);
  assert(dialogs.at(-1).includes("no longer be publicly available"));
  await storeName("Conflict work");
  forceConflict = true;
  await click("Save draft");
  await until(
    'document.body.textContent.includes("Saving and publishing are stopped")',
    "conflict blocks writes",
  );
  const attempts = draftCalls;
  await evaluate(
    '[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="Save draft").click()',
  );
  assert.equal(draftCalls, attempts);
  assert.equal(
    await evaluate(
      "JSON.parse(localStorage.getItem((" +
        storageKeys +
        ")[0])).content.storeName",
    ),
    "Conflict work",
  );
  forceConflict = false;
  revision++;
  content = { ...content, storeName: "Other admin saved" };
  await click("Reload saved content");
  await until(
    'document.body.textContent.includes("Unsaved changes found, restore?")',
    "stale recovery offered",
  );
  await click("Restore unsaved changes");
  assert.equal(
    await evaluate(
      '[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="Save draft").disabled',
    ),
    true,
  );
  assert.equal(draftCalls, attempts);
  await click("Reload saved content");
  await until(
    'document.body.textContent.includes("Unsaved changes found, restore?")',
    "reload stale state",
  );
  await click("Discard local copy");
  assert.equal(await evaluate(storageKeys + ".length"), 0);
  await evaluate(
    'window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error("Blocked storage")};',
  );
  await storeName("Storage blocked input");
  await until(
    'document.body.textContent.includes("Browser storage is unavailable or full")',
    "truthful storage warning",
  );
  await evaluate("Storage.prototype.setItem=window.originalSetItem");
  await click("Save draft");
  await until(
    'document.body.textContent.includes("Draft saved.")',
    "save despite blocked storage",
  );
  for (const theme of ["light", "dark"]) {
    await evaluate(
      "document.documentElement.dataset.theme=" + JSON.stringify(theme),
    );
    assert.equal(
      await evaluate("document.documentElement.scrollWidth<=innerWidth"),
      true,
    );
    const shot = await command("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
    });
    writeFileSync(
      join(artifacts, "cms-publication-" + theme + "-390.png"),
      Buffer.from(shot.data, "base64"),
    );
  }
  await evaluate('localStorage.setItem("cms-unsaved:v1:"+JSON.stringify(["http://localhost:4000/api/v1","admin-test","PAGE","new-draft"]),JSON.stringify({format:1,baseRevision:0,savedAt:Date.now(),content:{title:"Recovered new page",sections:[]}}))');
  await navigate('/cms/pages?key=new-draft');await until('document.body.textContent.includes("Unsaved changes found, restore?")','new unpublished page recovery');await click('Restore unsaved changes');assert.equal(await evaluate('document.querySelector(".cms-publication strong").textContent'),'Not saved');assert.equal(await evaluate('document.body.textContent.includes("Recovered new page")'),true);
  role = "ADMIN";
  await navigate("/cms/settings");
  await until(
    '!!document.querySelector("#cms-publish-permission")',
    "permission explanation",
  );
  assert.equal(
    await evaluate(
      '[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="Publish").disabled',
    ),
    true,
  );
  role = "STAFF";
  await navigate("/cms/settings");
  await until('!!document.querySelector(".cms-task-editor")', "staff editor");
  assert.equal(
    await evaluate(
      '[...document.querySelectorAll("button")].some(b=>b.textContent.trim()==="Save draft")',
    ),
    false,
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".cms-task-editor input").matches(":disabled")',
    ),
    true,
  );
  if (interceptionError) throw interceptionError;
  assert.deepEqual(errors, []);
  console.log(
    "PASS: invalid local recovery, no server autosave, clear after save, publish cancel/confirm, statuses, keyboard history, schedule/rollback/unpublish, retained conflicts, blocked storage, permissions and 390px themes",
  );
} finally {
  ws?.close();
  chrome?.kill();
  server?.kill();
  await pause(700);
  assert.equal(dirname(resolve(profile)), resolve(tmpdir()));
  assert(basename(profile).startsWith("ds-cms-publish-"));
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {}
}
