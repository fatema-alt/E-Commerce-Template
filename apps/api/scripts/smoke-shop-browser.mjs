import 'dotenv/config';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
const target = process.env.SHOP_TEST_DATABASE_URL;
if (
  !target ||
  !new URL(target).pathname.startsWith('/commerce_cms_validation_')
)
  throw new Error('An isolated SHOP_TEST_DATABASE_URL is required');
process.env.DATABASE_URL = target;
process.env.CMS_SCHEDULER_ENABLED = 'false';
const { AppModule } = await import('../dist/app.module.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');
const app = await NestFactory.create(AppModule, { logger: false });
app.setGlobalPrefix('api/v1');
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
let next, chrome, ws;
let logs = '';
let checks = 0;
let command = 0;
const calls = new Map();
const runtimeErrors = [];
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++command;
    const timer = setTimeout(() => {
      calls.delete(id);
      reject(new Error('Browser command timed out: ' + method));
    }, 20000);
    calls.set(id, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      reject,
    });
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const response = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails)
    throw new Error(JSON.stringify(response.exceptionDetails));
  return response.result?.value;
};
const waitFor = async (expression, label) => {
  for (let i = 0; i < 150; i++) {
    if (await evaluate(expression)) {
      checks++;
      return;
    }
    await delay(200);
  }
  throw new Error(
    'Timed out waiting for ' +
      label +
      ': ' +
      (await evaluate('document.body.innerText')),
  );
};
const check = (value, message) => {
  assert.ok(value, message);
  checks++;
};
try {
  await app.listen(0, '127.0.0.1');
  const api = (await app.getUrl()) + '/api/v1';
  const db = app.get(PrismaService);
  const suffix = randomUUID();
  const category = await db.category.create({
    data: { name: 'Browser department', slug: 'browser-' + suffix },
  });
  const product = await db.product.create({
    data: {
      name: 'Browser Shopping Item',
      slug: 'browser-item-' + suffix,
      sku: 'browser-' + suffix,
      categoryId: category.id,
      status: 'ACTIVE',
      price: 125,
      inventory: { create: { quantity: 10 } },
    },
  });
  const portServer = createServer();
  await new Promise((resolve) => portServer.listen(0, '127.0.0.1', resolve));
  const port = portServer.address().port;
  await new Promise((resolve) => portServer.close(resolve));
  const storefront = resolve('../storefront');
  next = spawn(
    process.execPath,
    [
      '--max-old-space-size=384',
      '--max-semi-space-size=4',
      resolve(storefront, 'node_modules/next/dist/bin/next'),
      'start',
      '--port',
      String(port),
    ],
    {
      cwd: storefront,
      env: { ...process.env, STOREFRONT_API_BASE_URL: api },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );
  next.stdout.on('data', (chunk) => {
    logs = (logs + chunk).slice(-8000);
  });
  next.stderr.on('data', (chunk) => {
    logs = (logs + chunk).slice(-8000);
  });
  const origin = `http://localhost:${port}`;
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(origin)).ok) {
        ready = true;
        break;
      }
    } catch {}
    if (next.exitCode !== null) break;
    await delay(250);
  }
  assert.ok(ready, logs);
  for (const path of [
    '/shop',
    '/cart',
    '/checkout',
    '/account',
    '/orders',
    '/wishlist',
    '/help',
    '/contact',
    '/robots.txt',
    '/sitemap.xml',
  ]) {
    const response = await fetch(origin + path);
    check(response.ok, `${path}: ${response.status}`);
  }
  const rejected = await fetch(origin + '/api/shop/newsletter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://untrusted.example',
      'X-Storefront-Request': '1',
    },
    body: JSON.stringify({ email: 'test@example.test', consent: true }),
  });
  check(
    rejected.status === 403,
    'Cross-origin browser writes must be rejected',
  );
  check(
    (await fetch(origin + '/api/shop/admin')).status === 404,
    'API proxy cannot access admin endpoints',
  );
  const profile = resolve('../../.local-backups/browser-profiles', suffix);
  await mkdir(profile, { recursive: true });
  chrome = spawn(
    process.env.CHROME_PATH ||
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    [
      '--headless=new',
      '--disable-gpu',
      '--disable-background-networking',
      '--disable-extensions',
      '--no-first-run',
      '--no-default-browser-check',
      '--renderer-process-limit=1',
      '--remote-debugging-port=0',
      '--user-data-dir=' + profile,
      'about:blank',
    ],
    { stdio: 'ignore', windowsHide: true },
  );
  let debugPort;
  for (let i = 0; i < 80; i++) {
    try {
      debugPort = Number(
        (await readFile(resolve(profile, 'DevToolsActivePort'), 'utf8')).split(
          '\n',
        )[0],
      );
      break;
    } catch {}
    await delay(250);
  }
  assert.ok(debugPort, 'Chrome debugging port unavailable');
  const tab = await (
    await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, {
      method: 'PUT',
    })
  ).json();
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const call = calls.get(message.id);
      calls.delete(message.id);
      if (message.error) call?.reject(new Error(JSON.stringify(message.error)));
      else call?.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown')
      runtimeErrors.push(message.params.exceptionDetails.text);
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.navigate', { url: origin + '/product/' + product.slug });
  await waitFor(
    "document.body.innerText.includes('Add to cart')",
    'product page',
  );
  await delay(500);
  await evaluate(
    "[...document.querySelectorAll('button')].find(button => button.textContent === 'Add to cart').click()",
  );
  await waitFor(
    "JSON.parse(localStorage.getItem('commerce-cart-v1') || '[]').length === 1",
    'persistent add to cart',
  );
  await send('Page.navigate', { url: origin + '/cart' });
  await waitFor(
    "document.body.innerText.includes('Proceed to checkout')",
    'server-priced cart',
  );
  check(
    await evaluate("document.body.innerText.includes('Browser Shopping Item')"),
    'Cart survives navigation',
  );
  await send('Page.navigate', { url: origin + '/checkout' });
  await waitFor(
    "!!document.querySelector('form.checkout-form button[type=submit]') && !document.querySelector('form.checkout-form button[type=submit]').disabled",
    'checkout quote',
  );
  const desktop = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  });
  await writeFile(
    resolve('../../.local-backups/storefront-checkout-desktop.png'),
    Buffer.from(desktop.data, 'base64'),
  );
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  check(
    await evaluate(
      'document.documentElement.scrollWidth <= window.innerWidth + 1',
    ),
    'Checkout must fit a mobile viewport',
  );
  const mobile = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  });
  await writeFile(
    resolve('../../.local-backups/storefront-checkout-mobile.png'),
    Buffer.from(mobile.data, 'base64'),
  );
  await evaluate(
    `(() => { const values = {name:'Browser Shopper',phone:'01712345678',city:'Dhaka',address:'123 Browser Test Street'}; for (const [name,value] of Object.entries(values)) { const input = document.querySelector('form.checkout-form [name="'+name+'"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value); input.dispatchEvent(new Event('input',{bubbles:true})); } document.querySelector('form.checkout-form input[type=checkbox]').click(); document.querySelector('form.checkout-form button[type=submit]').click(); })()`,
  );
  await waitFor(
    "location.pathname.startsWith('/orders/') && document.body.innerText.includes('Order details') && document.body.innerText.includes('Browser Shopping Item')",
    'guest checkout confirmation and order access',
  );
  const guestOrderId = await evaluate("location.pathname.split('/').pop()");
  check(
    (await db.inventory.findUnique({ where: { productId: product.id } }))
      .reserved === 1,
    'Browser checkout reserves inventory once',
  );
  await send('Page.navigate', { url: origin + '/account' });
  await waitFor(
    "document.body.innerText.includes('New here? Create an account')",
    'guest account screen',
  );
  await evaluate(
    "[...document.querySelectorAll('button')].find(button => button.textContent.includes('New here?')).click()",
  );
  await waitFor(
    "!!document.querySelector('form input[name=name]')",
    'registration form',
  );
  await evaluate(
    `(() => { const values = {name:'Browser Shopper',email:${JSON.stringify(`browser-${suffix}@example.test`)},password:'browser-test-password-12345'}; for (const [name,value] of Object.entries(values)) { const input = document.querySelector('form [name="'+name+'"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value); input.dispatchEvent(new Event('input',{bubbles:true})); } document.querySelector('form button.primary-button').click(); })()`,
  );
  await waitFor(
    "document.body.innerText.includes('Welcome, Browser Shopper')",
    'customer registration',
  );
  check(
    await evaluate(
      `fetch('/api/shop/orders').then(response => response.json()).then(data => data.items.some(order => order.id === ${JSON.stringify(guestOrderId)}))`,
    ),
    'Guest order remains accessible after creating an account on the same browser',
  );
  check(
    runtimeErrors.length === 0,
    'No browser JavaScript exceptions: ' + runtimeErrors.join(', '),
  );
  console.log(`Storefront browser and API-bridge checks passed: ${checks}`);
  console.log(
    'Screenshots: .local-backups/storefront-checkout-desktop.png and storefront-checkout-mobile.png',
  );
} finally {
  try {
    if (ws?.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify({ id: ++command, method: 'Browser.close' }));
  } catch {}
  ws?.close();
  chrome?.kill();
  next?.kill();
  await app.close();
}
