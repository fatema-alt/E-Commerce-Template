// Run after building storefront with webpack. Uses in-memory API fixtures only.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(app, '../..');
const browser = process.env.PRODUCT_TEST_BROWSER || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(existsSync);
assert.ok(browser, 'Chrome/Edge required');
const source = readFileSync(join(root, 'apps/admin/src/components/cms/standard-template.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { getStandardEcommerceTemplate } = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));
const template = getStandardEcommerceTemplate();
const artifacts = mkdtempSync(join(tmpdir(), 'ds-wp1-b-'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let mode = 'template';
const api = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const path = new URL(req.url, 'http://localhost').pathname;
  if (mode === 'template' && path.endsWith('/storefront/cms/PAGE/home')) {
    res.end(JSON.stringify({ version: 1, assets: [], content: { title: 'WP1 default homepage', sections: template } }));
  } else if (path.endsWith('/categories')) res.end('[]');
  else if (path.endsWith('/products')) res.end('{"items":[],"total":0}');
  else { res.statusCode = 404; res.end('{}'); }
});
let server, chrome, ws;
let nextId = 0;
const pending = new Map();
const exceptions = [];
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  assert.equal(result.exceptionDetails, undefined);
  return result.result.value;
}
try {
  await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
  server = spawn(process.execPath, [join(app, 'node_modules/next/dist/bin/next'), 'start', '-p', '3018'], {
    cwd: app, windowsHide: true, stdio: 'ignore',
    env: { ...process.env, STOREFRONT_API_BASE_URL: `http://127.0.0.1:${api.address().port}/api/v1`, STOREFRONT_ORIGIN: 'http://localhost:3018', CMS_HOME_KEY: 'home' },
  });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch('http://localhost:3018/icon.svg')).ok) { ready = true; break; } } catch {}
    await pause(200);
  }
  assert.ok(ready, 'Production server ready');
  chrome = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9238', `--user-data-dir=${join(artifacts, 'profile')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let target;
  for (let i = 0; i < 100; i++) {
    try { target = (await (await fetch('http://localhost:9238/json')).json()).find(tab => tab.type === 'page'); if (target) break; } catch {}
    await pause(200);
  }
  assert.ok(target, 'Browser ready');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const call = pending.get(message.id); pending.delete(message.id);
      if (message.error) call?.reject(new Error(JSON.stringify(message.error))); else call?.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
  });
  await send('Page.enable'); await send('Runtime.enable');
  for (mode of ['template', 'fallback']) {
    for (const width of [1366, 390]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width === 390 });
      await send('Page.navigate', { url: `http://localhost:3018/?check=${mode}-${width}` });
      let page;
      for (let i = 0; i < 100; i++) {
        await pause(200);
        page = await evaluate(`({text:document.body?.innerText || '',overflow:(document.documentElement?.scrollWidth || 0)>innerWidth,newsletter:!!document.querySelector('.newsletter-panel')})`);
        if (page.text.includes('Questions about returns? Contact our team.') && page.newsletter) break;
      }
      assert.ok(page.text.includes('Questions about returns? Contact our team.'));
      assert.ok(page.text.includes('DS MART UPDATES'));
      assert.ok(page.text.includes('Check available payment methods at checkout.'));
      assert.doesNotMatch(page.text, /100%|24\/7|7-Day|Best Sellers|lightning-fast|hassle-free|৳|EXCLUSIVE MEMBER|2,400|What Our Customers Are Saying|Limited Time Flash/i);
      assert.equal(page.overflow, false, 'No page horizontal overflow');
      const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      writeFileSync(join(artifacts, `${mode}-${width}.png`), Buffer.from(screenshot.data, 'base64'));
      console.log(`PASS ${mode} ${width}px: neutral copy, no testimonials or invented sale, no horizontal overflow`);
    }
  }
  assert.equal(exceptions.length, 0, 'No browser runtime exceptions');
  console.log('Screenshots:', artifacts);
} finally {
  ws?.close(); chrome?.kill(); server?.kill(); api.close();
}
