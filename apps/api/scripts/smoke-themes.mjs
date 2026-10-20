import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
let chrome, next;
const clients = [];
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };
const fixtureApi = createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.url.includes('/SITE_SETTINGS/')) return res.end(JSON.stringify({ content: { storeName: 'Theme Preview Store', locale: 'en', currency: 'BDT' }, assets: [] }));
  if (req.url.includes('/THEME/')) return res.end(JSON.stringify({ content: { primary: '#48725C', background: '#FFF3DF', heading: '#203E33', secondarySurface: '#ffffff', accent: '#F3DED0' }, assets: [] }));
  if (req.url.includes('/NAVIGATION/')) return res.end(JSON.stringify({ content: { items: [] }, assets: [] }));
  if (req.url.includes('/PAGE/')) return res.end(JSON.stringify({ content: { title: 'Theme preview', sections: [{ id: 'hero', type: 'hero', visible: true, config: { title: 'A store for every day', subtitle: 'Published CMS colors remain in light mode.' } }, { id: 'faq', type: 'faq', visible: true, config: { title: 'Questions', items: [{ question: 'How does it work?', answer: 'Choose your preferred color theme.' }] } }] }, assets: [] }));
  if (req.url === '/api/v1/shop/me') return res.end(JSON.stringify({ user: null }));
  res.statusCode = 404; res.end('{}');
});
function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url); let sequence = 0; const pending = new Map(); const errors = [];
    const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; const timeout = setTimeout(() => reject(new Error('CDP timeout: ' + method)), 15000); pending.set(id, { resolve: value => { clearTimeout(timeout); resolve(value); }, reject }); ws.send(JSON.stringify({ id, method, params })); });
    const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result?.value; };
    const client = { ws, send, evaluate, errors, origin: '' };
    ws.onopen = () => resolve(client); ws.onerror = reject;
    ws.onmessage = event => { const message = JSON.parse(event.data); if (message.id) { const call = pending.get(message.id); pending.delete(message.id); if (message.error) call?.reject(new Error(JSON.stringify(message.error))); else call?.resolve(message.result); } if (message.method === 'Runtime.exceptionThrown') errors.push(JSON.stringify(message.params.exceptionDetails)); if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map(arg => arg.value || arg.description || '').join(' ')); if (message.method === 'Fetch.requestPaused') void send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: client.origin }, { name: 'Access-Control-Allow-Credentials', value: 'true' }], body: Buffer.from(JSON.stringify({ user: { id: 'theme-fixture', role: 'SUPER_ADMIN' } })).toString('base64') }); };
  });
}
async function wait(client, expression, label) { for (let i = 0; i < 100; i++) { if (await client.evaluate(expression)) { checks++; return; } await delay(200); } throw new Error(label + ': ' + await client.evaluate('document.body.innerText')); }
const select = (client, value) => client.evaluate(`(() => {const select=document.querySelector('[aria-label="Color theme"]');select.value=${JSON.stringify(value)};select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
async function stop(child) { if (!child || child.exitCode !== null) return; child.kill(); await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(2000)]); }
try {
  await new Promise(resolve => fixtureApi.listen(0, '127.0.0.1', resolve));
  const api = `http://127.0.0.1:${fixtureApi.address().port}/api/v1`;
  const profile = resolve('../../.local-backups/theme-browser', randomUUID()); await mkdir(profile, { recursive: true });
  chrome = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--disable-gpu', '--disable-background-networking', '--disable-extensions', '--no-first-run', '--renderer-process-limit=1', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let debugPort; for (let i = 0; i < 80; i++) { try { debugPort = Number((await readFile(resolve(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; } catch {} await delay(250); } assert.ok(debugPort, 'Chrome did not start');
  async function tab() { const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' })).json(); const client = await connect(target.webSocketDebuggerUrl); clients.push(client); await client.send('Page.enable'); await client.send('Runtime.enable'); return client; }
  for (const app of ['admin', 'storefront']) {
    const temporary = createServer(); await new Promise(resolve => temporary.listen(0, '127.0.0.1', resolve)); const port = temporary.address().port; await new Promise(resolve => temporary.close(resolve));
    const origin = `http://localhost:${port}`;
    const cwd = resolve('../' + app);
    next = spawn(process.execPath, ['--max-old-space-size=256', '--max-semi-space-size=2', resolve(cwd, 'node_modules/next/dist/bin/next'), 'start', '--port', String(port)], { cwd, env: { ...process.env, STOREFRONT_API_BASE_URL: api }, stdio: 'ignore', windowsHide: true });
    let ready = false; for (let i = 0; i < 60; i++) { try { if ((await fetch(origin + (app === 'admin' ? '/login' : '/account'), { signal: AbortSignal.timeout(5000) })).ok) { ready = true; break; } } catch {} await delay(250); } assert.ok(ready, app + ' did not start');
    const client = await tab(); client.origin = origin;
    if (app === 'admin') await client.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/auth/me' }] });
    await client.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await client.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
    await client.send('Page.navigate', { url: origin + (app === 'admin' ? '/login' : '/account') });
    await wait(client, "!!document.querySelector('[aria-label=\"Color theme\"]') && document.documentElement.dataset.theme==='dark'", app + ' system dark'); await delay(500);
    await select(client, 'light');
    await wait(client, "document.documentElement.dataset.theme==='light'", app + ' light switch');
    check(await client.evaluate(`localStorage.getItem('commerce-${app}-theme')==='light'`), app + ' preference persisted');
    await client.send('Page.reload'); await delay(700);
    await wait(client, "document.readyState==='complete' && document.documentElement.dataset.theme==='light' && document.querySelector('[aria-label=\"Color theme\"]')?.value==='light'", app + ' reload persistence');
    await select(client, 'system');
    await wait(client, "document.documentElement.dataset.theme==='dark'", app + ' system selection');
    await client.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
    await wait(client, "document.documentElement.dataset.theme==='light'", app + ' follows OS change');
    await select(client, 'dark'); await client.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
    check(await client.evaluate("document.documentElement.dataset.theme==='dark'"), app + ' explicit preference overrides OS');
    await client.evaluate("window.__originalThemeSetter=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new Error('Test quota exceeded')}");
    await select(client, 'light');
    await wait(client, "document.documentElement.dataset.theme==='light'", app + ' quota failure still switches');
    await client.evaluate('Storage.prototype.setItem=window.__originalThemeSetter');
    const secondary = await tab(); await secondary.send('Page.navigate', { url: origin + (app === 'admin' ? '/login' : '/account') });
    await wait(secondary, 'document.readyState===\'complete\' && !!document.querySelector(\'[aria-label="Color theme"]\')', app + ' second tab');
    await secondary.evaluate(`localStorage.setItem('commerce-${app}-theme','light');localStorage.setItem('commerce-${app}-theme','dark')`);
    await wait(client, "document.documentElement.dataset.theme==='dark'", app + ' cross-tab sync');
    await client.send('Page.navigate', { url: origin + '/' });
    await wait(client, app === 'admin' ? "document.body.innerText.includes('Total sales')" : "document.body.innerText.includes('A store for every day')", app + ' themed main page');
    await delay(300);
    const surface = app === 'admin' ? '.bg-white' : '.storefront';
    check(await client.evaluate(`getComputedStyle(document.querySelector('${surface}')).backgroundColor===${JSON.stringify(app === 'admin' ? 'rgb(22, 32, 51)' : 'rgb(16, 24, 19)')}`), app + ' dark surfaces');
    for (const mode of ['dark', 'light']) { await select(client, mode); await wait(client, `document.documentElement.dataset.theme==='${mode}'`, app + ' screenshot mode'); const image = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(resolve(`../../.local-backups/${app}-${mode}.png`), Buffer.from(image.data, 'base64')); }
    if (app === 'storefront') check(await client.evaluate("getComputedStyle(document.querySelector('.storefront')).backgroundColor==='rgb(255, 243, 223)'"), 'Published CMS light background remains intact');
    await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    check(await client.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), app + ' mobile has no horizontal overflow');
    check(!client.errors.some(error => /hydration|uncaught|not defined|typeerror/i.test(error)), app + ' no hydration/runtime errors: ' + client.errors.join(';'));
    await client.send('Page.close'); await secondary.send('Page.close'); await stop(next); next = undefined;
    console.log(app + ' theme browser checks passed');
  }
  console.log(`Theme checks passed: ${checks}`);
} finally { for (const client of clients) client.ws.close(); await stop(next); await stop(chrome); await new Promise(resolve => fixtureApi.close(resolve)); }
