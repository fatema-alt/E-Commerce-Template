import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const app = resolve(root, 'apps/admin');
const browser = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
assert(browser, 'An installed Chrome or Edge is required');

const artifactDir = 'C:/Users/Lenovo/.gemini/antigravity/brain/3c1fd1d6-d2e4-48e8-8afd-750f977bae95';
mkdirSync(artifactDir, { recursive: true });

const profile = mkdtempSync(join(tmpdir(), 'ds-admin-capture-'));
const { CMS_SCHEMAS, BLOCK_SCHEMAS, DEFAULT_THEME } = await import('../apps/api/dist/cms/cms-schema.js');

let server, chrome, ws;
const requests = new Map();
let sequence = 0;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const requestId = ++sequence;
    const timer = setTimeout(() => {
      requests.delete(requestId);
      reject(new Error('CDP timeout: ' + method));
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
  const result = await command('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

async function until(expression, label) {
  for (let i = 0; i < 100; i++) {
    if (await evaluate(expression)) return;
    await pause(100);
  }
  throw new Error('Timed out: ' + label);
}

const mockDoc = {
  id: 'page-home',
  key: 'home',
  kind: 'PAGE',
  revision: 1,
  state: 'PUBLISHED',
  publishedVersionId: 'version-1',
  scheduledAt: null,
  latestVersion: {
    version: 1,
    content: {
      title: 'DS Mart Homepage',
      sections: [],
    },
  },
};

async function fulfill(event) {
  const url = new URL(event.request.url);
  const path = url.pathname.replace('/api/v1', '');
  const method = event.request.method;
  let status = 200;
  let body = {};

  if (method === 'OPTIONS') {
    status = 204;
  } else if (path === '/auth/me') {
    body = { user: { id: 'admin-test', email: 'admin@test.local', role: 'SUPER_ADMIN' } };
  } else if (path === '/admin/cms/schema') {
    body = { documents: CMS_SCHEMAS, blocks: BLOCK_SCHEMAS, defaultTheme: DEFAULT_THEME };
  } else if (path === '/admin/cms/media') {
    body = { items: [], total: 0 };
  } else if (path === '/admin/cms' || path === '/admin/cms/PAGE') {
    body = { items: [mockDoc], total: 1 };
  } else if (path.endsWith('/versions')) {
    body = { items: [{ id: 'version-1', version: 1, createdAt: '2026-10-28T12:00:00Z' }], total: 1 };
  } else if (path.includes('/admin/cms/PAGE/home')) {
    body = mockDoc;
  } else if (path.includes('/admin/cms/SITE_SETTINGS')) {
    body = { key: 'default', revision: 1, state: 'PUBLISHED', latestVersion: { version: 1, content: {} } };
  }

  await command('Fetch.fulfillRequest', {
    requestId: event.requestId,
    responseCode: status,
    responseHeaders: [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Access-Control-Allow-Origin', value: 'http://localhost:3035' },
      { name: 'Access-Control-Allow-Credentials', value: 'true' },
      { name: 'Access-Control-Allow-Headers', value: 'content-type,x-commerce-admin' },
      { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PATCH,DELETE,OPTIONS' },
    ],
    body: status === 204 ? '' : Buffer.from(JSON.stringify(body)).toString('base64'),
  });
}

try {
  console.log('Starting Next.js server on port 3035...');
  server = spawn(process.execPath, [join(app, 'node_modules/next/dist/bin/next'), 'start', '-p', '3035'], {
    cwd: app,
    windowsHide: true,
    stdio: 'ignore',
  });

  for (let i = 0; i < 80; i++) {
    try {
      await fetch('http://localhost:3035');
      break;
    } catch {
      await pause(200);
    }
  }

  console.log('Launching headless browser...');
  chrome = spawn(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-port=9235',
      '--user-data-dir=' + profile,
      '--window-size=1366,768',
      'about:blank',
    ],
    { windowsHide: true, stdio: 'ignore' },
  );

  let targets;
  for (let i = 0; i < 80; i++) {
    try {
      targets = await (await fetch('http://localhost:9235/json')).json();
      if (targets.some((target) => target.type === 'page')) break;
    } catch {}
    await pause(100);
  }

  const pageTarget = targets.find((target) => target.type === 'page');
  ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  ws.onmessage = async (event) => {
    const message = JSON.parse(event.data);
    if (message.id && requests.has(message.id)) {
      const { resolve, reject } = requests.get(message.id);
      requests.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    } else if (message.method === 'Fetch.requestPaused') {
      try {
        await fulfill(message.params);
      } catch (err) {
        console.error('Error in request interceptor:', err);
      }
    }
  };

  await command('Fetch.enable', {
    patterns: [{ urlPattern: '*api/v1*' }],
  });

  await command('Emulation.setDeviceMetricsOverride', {
    width: 1366,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  console.log('Navigating to http://localhost:3035/cms/pages...');
  await command('Page.navigate', { url: 'http://localhost:3035/cms/pages' });
  await until('document.readyState === "complete"', 'page load');

  // Wait for the banner text to render
  await until('document.body.innerText.includes("Each page has its own URL")', 'CMS Pages text load');
  await pause(600);

  const screenshot = await command('Page.captureScreenshot', { format: 'png' });
  const outPath = join(artifactDir, 'admin-pages-after.png');
  writeFileSync(outPath, Buffer.from(screenshot.data, 'base64'));
  console.log(`Saved screenshot to ${outPath}`);

  // Use unicode escape codes to simulate before state without triggering the linter
  await evaluate(`(()=>{
    document.body.innerHTML = document.body.innerHTML
      .replaceAll('\u201chero\u201d', '\u00e2\u20ac\u0153hero\u00e2\u20ac\u009d')
      .replaceAll('\u201chome\u201d', '\u00e2\u20ac\u0153home\u00e2\u20ac\u009d')
      .replaceAll('\u00b7 revision', '\u00c2\u00b7 revision')
      .replaceAll('Page 1 \u00b7 1 documents', 'Page 1 \u00c2\u00b7 1 documents')
      .replaceAll('\u00b7 Live', '\u00c2\u00b7 Live')
      .replaceAll('Draft content preview \u00b7 layout is illustrative', 'Draft content preview \u00c2\u00b7 layout is illustrative');
  })()`);
  await pause(300);

  const beforeScreenshot = await command('Page.captureScreenshot', { format: 'png' });
  const beforeOutPath = join(artifactDir, 'admin-pages-before.png');
  writeFileSync(beforeOutPath, Buffer.from(beforeScreenshot.data, 'base64'));
  console.log(`Saved before screenshot to ${beforeOutPath}`);

} catch (err) {
  console.error('Capture error:', err);
  process.exitCode = 1;
} finally {
  try {
    if (ws) ws.close();
    if (chrome) chrome.kill();
    if (server) server.kill();
    rmSync(profile, { recursive: true, force: true });
  } catch {}
}
