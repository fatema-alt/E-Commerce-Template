// Run after the admin production build. Uses an isolated browser profile and
// intercepted API contracts; no store records or customer data are modified.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const browser = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert(browser, 'An installed Chrome or Edge is required');
const profile = mkdtempSync(join(tmpdir(), 'ds-editor-'));
const artifacts = join(app, '.editor-check'); mkdirSync(artifacts, { recursive: true });
const { CMS_SCHEMAS, BLOCK_SCHEMAS, DEFAULT_THEME } = await import('../../api/dist/cms/cms-schema.js');
let server, chrome, ws, role = 'SUPER_ADMIN';
let revision = 2, version = 1, published;
let content = {storeName:'DS Mart',locale:'en',currency:'BDT',announcementRibbon:{enabled:true,animation:'fade',intervalSeconds:5,items:[{id:'first',enabled:true,text:'First CMS message',device:'both'}]},contactWidget:{enabled:false,title:'How can we help you?',description:'Contact our team',position:'right',desktop:true,mobile:true,phone:{enabled:false}}};
const document = () => ({key:'default',revision,state:'PUBLISHED',publishedVersionId:'version-1',scheduledAt:null,latestVersion:{version,content}});
const requests = new Map(); let sequence = 0;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const requestId = ++sequence; const timer = setTimeout(() => { requests.delete(requestId); reject(new Error('CDP timeout: ' + method)); }, 15000);
    requests.set(requestId, { resolve: (result) => { clearTimeout(timer); resolve(result); }, reject });
    ws.send(JSON.stringify({ id: requestId, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function until(expression, label) {
  for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(100); }
  throw new Error('Timed out: ' + label);
}
async function navigate(path) {
  await command('Page.navigate', { url: 'http://localhost:3031' + path });
  await until('document.readyState === "complete"', 'page load');
}
async function click(text) {
  await until(`[...document.querySelectorAll('button')].some(el=>el.textContent.trim()===${JSON.stringify(text)}&&!el.disabled)`, 'enabled '+text);
  assert(await evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===${JSON.stringify(text)});if(!button||button.disabled)return false;button.click();return true;})()`), 'click '+text);
  await pause(80);
}
async function field(label, value, index = 0) {
  await evaluate(`(()=>{const label=[...document.querySelectorAll('.engagement-editor label')].filter(el=>el.textContent.trim()===${JSON.stringify(label)} && el.control?.type !== 'checkbox')[${index}];const el=label?.control||label?.querySelector('input,select');if(!el)throw Error('Missing field '+${JSON.stringify(label)});const proto=el instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await pause(80);
}
async function fulfill(event) {
  const path = new URL(event.request.url).pathname.replace('/api/v1', '');
  const method = event.request.method; let status = 200, body = {};
  if (method === 'OPTIONS') status = 204;
  else if (path === '/auth/me') body = { user: { id: 'admin-test', email: 'admin@test.local', role } };
  else if (path === '/admin/cms/schema') body = { documents: CMS_SCHEMAS, blocks: BLOCK_SCHEMAS, defaultTheme: DEFAULT_THEME };
  else if (path === '/admin/cms/media') body = { items: [], total: 0 };
  else if (path === '/admin/cms') body = { items: [document()], total: 1 };
  else if (path.endsWith('/versions')) body = { items: [{ id: 'version-1', version, createdAt: '2026-10-27T00:00:00Z' }], total: 1 };
  else if (path === '/admin/cms/SITE_SETTINGS/default/draft') {
    const payload = JSON.parse(event.request.postData);
    assert.equal(payload.expectedRevision, revision); assert.notEqual(role, 'STAFF');
    content = payload.content; revision++; version++; body = { revision, version };
  } else if (path === '/admin/cms/SITE_SETTINGS/default/publish') {
    assert.equal(role, 'SUPER_ADMIN'); assert.equal(JSON.parse(event.request.postData).expectedRevision, revision);
    published = structuredClone(content); revision++; body = { revision, publishedVersion: version };
  } else if (path === '/admin/cms/SITE_SETTINGS/default') body = document();
  await command('Fetch.fulfillRequest', { requestId: event.requestId, responseCode: status, responseHeaders: [
    { name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: 'http://localhost:3031' },
    { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'content-type,x-commerce-admin' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PATCH,DELETE,OPTIONS' },
  ], body: status === 204 ? '' : Buffer.from(JSON.stringify(body)).toString('base64') });
}
try {
  server = spawn(process.execPath, [join(app, 'node_modules/next/dist/bin/next'), 'start', '-p', '3031'], { cwd: app, windowsHide: true, stdio: 'ignore' });
  for (let i = 0; i < 80; i++) { try { await fetch('http://localhost:3031'); break; } catch { await pause(200); } }
  chrome = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9231', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let targets;
  for (let i = 0; i < 80; i++) { try { targets = await (await fetch('http://localhost:9231/json')).json(); if (targets.some((target) => target.type === 'page')) break; } catch {} await pause(100); }
  ws = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let interceptionError;
  ws.onmessage = (message) => {
    const event = JSON.parse(message.data);
    if (event.method === 'Fetch.requestPaused') void fulfill(event.params).catch((error) => { interceptionError = error; });
    const task = requests.get(event.id);
    if (task) { requests.delete(event.id); event.error ? task.reject(new Error(JSON.stringify(event.error))) : task.resolve(event.result); }
  };
  await command('Page.enable'); await command('Runtime.enable');
  await command('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/v1/*' }, { urlPattern: '*://*/uploads/editor-test.png' }] });
  await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await navigate('/cms/announcements'); await until('!!document.querySelector(".engagement-editor")', 'announcement editor');
  await field('Text', 'Edited CMS announcement'); await click('Save draft');
  await until('document.body.textContent.includes("Draft saved.")', 'saved announcement draft');
  assert.equal(content.announcementRibbon.items[0].text, 'Edited CMS announcement');
  assert.equal(published, undefined);
  await click('Publish latest saved version'); await until('document.body.textContent.includes("Publish completed.")', 'published announcement');
  assert.equal(published.announcementRibbon.items[0].text, 'Edited CMS announcement');
  await click('+ Add Items'); await field('Text', 'Second CMS announcement', 1);
  await evaluate('document.querySelector("[aria-label=\\"Move up items item 2\\"]").click()');
  await click('Save draft'); await until('document.body.textContent.includes("Draft saved.")', 'saved ordered announcements');
  await click('Publish latest saved version'); await until('document.body.textContent.includes("Publish completed.")', 'published order');
  assert.equal(published.announcementRibbon.items[0].text, 'Second CMS announcement');
  await evaluate('[...document.querySelectorAll(".engagement-editor button")].filter(el=>el.textContent.trim()==="Remove")[1].click()');
  await click('Save draft'); await until('document.body.textContent.includes("Draft saved.")', 'deleted announcement draft');
  await click('Publish latest saved version'); await until('document.body.textContent.includes("Publish completed.")', 'deleted announcement published');
  assert.equal(published.announcementRibbon.items.length, 1);
  console.log('PASS: CMS announcement create/edit/reorder/delete, private drafts, revision-aware publish and live preview');
  await navigate('/cms/contact-widget'); await until('!!document.querySelector(".engagement-editor")', 'contact settings');
  await field('Title', 'Talk with DS Mart Support');
  await evaluate('[...document.querySelectorAll(".engagement-editor label")].filter(el=>el.textContent.trim()==="Enabled")[0].querySelector("input").click()');
  await evaluate('[...document.querySelectorAll(".engagement-editor label")].filter(el=>el.textContent.trim()==="Enabled")[1].querySelector("input").click()');
  await evaluate('[...document.querySelectorAll(".engagement-editor label")].find(el=>el.textContent.trim()==="Number" && el.querySelector("input[type=checkbox]")).querySelector("input").click()');
  await field('Number', '+8801712345678'); await click('Save draft');
  await until('document.body.textContent.includes("Draft saved.")', 'saved contacts');
  await click('Publish latest saved version'); await until('document.body.textContent.includes("Publish completed.")', 'published contacts');
  assert.equal(published.contactWidget.phone.number, '+8801712345678'); assert.equal(published.contactWidget.enabled, true);
  await navigate('/cms/contact-widget'); await until('!!document.querySelector(".engagement-editor")', 'reloaded widget');
  assert.ok(await evaluate('document.querySelector(".engagement-editor").textContent.includes("Talk with DS Mart Support")'));
  for (const width of [375,768,1440]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: width < 600 });
    await pause(100);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    for (const theme of ['light','dark']) {
      await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)};document.querySelector('.engagement-preview').scrollIntoView({block:'start',behavior:'instant'})`);
      const shot = await command('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(artifacts, `cms-engagement-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
    }
  }
  role = 'STAFF'; await navigate('/cms/contact-widget'); await until('!!document.querySelector(".engagement-editor")', 'staff readonly view');
  assert.ok(await evaluate('document.querySelector(".engagement-editor input").disabled || document.querySelector(".engagement-editor input").matches(":disabled")'));
  assert.equal(await evaluate('[...document.querySelectorAll("button")].some(el=>el.textContent.trim()==="Save draft")'), false);
  if (interceptionError) throw interceptionError;
  console.log('PASS: contact CMS persistence, desktop/mobile live preview, light/dark responsiveness and staff readonly UI');
} finally {
  ws?.close(); chrome?.kill(); server?.kill(); await pause(700);
  assert.equal(dirname(resolve(profile)), resolve(tmpdir())); assert(basename(profile).startsWith('ds-editor-'));
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may briefly retain a lock. */ }
}
