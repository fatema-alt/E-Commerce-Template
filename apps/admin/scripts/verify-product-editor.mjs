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
const id = '11111111-1111-4111-8111-111111111111';
const category = { id: '22222222-2222-4222-8222-222222222222', name: 'Test category', isActive: true, children: [] };
let record, server, chrome, ws, role = 'SUPER_ADMIN';
let createAttempts = 0, created = 0, uploads = 0, updates = 0;
let replacements = 0;
const firstImageId = '33333333-3333-4333-8333-333333333333', secondImageId = '44444444-4444-4444-8444-444444444444';
const richDescription = '<h2>বাংলা Product 😀</h2><p>English <strong>bold</strong>, <em>italic</em> and <u>underline</u>.</p><h3>Features</h3><ul><li>বাংলা bullet</li><li>English bullet</li></ul><ol><li>First step</li><li>Second step</li></ol><blockquote><p>Mixed ভাষা 🛍️</p></blockquote>';
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
async function field(label, value) {
  await evaluate(`(()=>{const label=[...document.querySelectorAll('#product-editor label')].find(el=>el.firstChild?.textContent.trim()===${JSON.stringify(label)});const input=label?.querySelector('input,textarea,select');if(!input)throw Error('Missing field '+${JSON.stringify(label)});const proto=input instanceof HTMLSelectElement?HTMLSelectElement.prototype:input instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await pause(80);
}
async function click(text) {
  await until(`[...document.querySelectorAll('#product-editor button')].some(el=>el.textContent.trim()===${JSON.stringify(text)}&&!el.disabled)`, 'enabled '+text);
  assert(await evaluate(`(()=>{const button=[...document.querySelectorAll('#product-editor button')].find(el=>el.textContent.trim()===${JSON.stringify(text)});if(!button||button.disabled)return false;button.click();return true;})()`), 'click ' + text);
  await pause(100);
}
async function fulfill(event) {
  if (new URL(event.request.url).pathname === '/uploads/editor-test.png') { await command('Fetch.fulfillRequest', { requestId: event.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'image/png' }], body: readFileSync(resolve(app, '../storefront/public/brand/ds-symbol.png')).toString('base64') }); return; }
  const path = new URL(event.request.url).pathname.replace('/api/v1', '');
  const method = event.request.method;
  let status = 200, body = [];
  if (method === 'OPTIONS') status = 204;
  else if (path === '/auth/me') body = { user: { id: 'test-admin', email: 'test@example.com', role } };
  else if (path === '/categories/tree') body = [category];
  else if (path === '/products' && method === 'POST') {
    createAttempts++;
    if (createAttempts === 1) { status = 503; body = { message: 'Simulated save failure' }; }
    else {
      const payload = JSON.parse(event.request.postData); assert.equal(payload.status, 'DRAFT'); assert.equal(payload.stock, 7); assert(payload.sku); assert.equal(payload.price, '250');
      created++; record = { ...payload, id, updatedAt: '2026-10-27T00:00:00.000Z', createdAt: '2026-10-27T00:00:00.000Z', category, images: [], variants: [], isActive: false, availableStock: 7, inventory: { quantity: 7, reserved: 0, lowStockAt: 5 } }; body = record;
    }
  } else if (path === '/products/' + id && method === 'PATCH') {
    const payload = JSON.parse(event.request.postData); assert.equal(payload.expectedUpdatedAt, record.updatedAt); assert(!('stock' in payload)); updates++;
    record = { ...record, ...payload, isActive: payload.status === 'ACTIVE', updatedAt: `2026-10-27T00:00:${String(updates).padStart(2, '0')}.000Z` }; body = record;
  } else if (path === '/products/' + id) body = record;
  else if (path === '/products/' + id + '/images' && method === 'POST') {
    uploads++;
    if (uploads === 1) { status = 503; body = { message: 'Simulated image failure' }; }
    else { body = { id: firstImageId, productId: id, url: '/uploads/editor-test.png', altText: 'Test product', isPrimary: true, sortOrder: 0 }; record.images = [body]; }
  } else if (path === '/products/'+id+'/images/order') {
    const {imageIds} = JSON.parse(event.request.postData);
    assert.equal(imageIds.length, record.images.length);
    record.images = imageIds.map((imageId,index) => ({...record.images.find(image=>image.id===imageId),sortOrder:index,isPrimary:index===0})); body={success:true};
  } else if (path.startsWith('/products/'+id+'/images/') && path.endsWith('/primary')) {
    const imageId=path.split('/').at(-2); record.images=record.images.map(image=>({...image,isPrimary:image.id===imageId})); body={};
  } else if (path.startsWith('/products/'+id+'/images/') && path.endsWith('/replace')) {
    replacements++;
    body={image:record.images.find(image=>image.id===path.split('/').at(-2))};
  } else if (path.startsWith('/products/'+id+'/images/') && method==='PATCH') {
    const imageId=path.split('/').at(-1); const payload=JSON.parse(event.request.postData);
    record.images=record.images.map(image=>image.id===imageId?{...image,...payload}:image); body=record.images.find(image=>image.id===imageId);
  } else if (path.startsWith('/products/'+id+'/images/') && method==='DELETE') {
    record.images=record.images.filter(image=>image.id!==path.split('/').at(-1)); body={success:true};
  } else if (path === '/products/' + id + '/images') body = record?.images || [];
  else if (path === '/products/' + id + '/variants') body = [];
  else if (path === '/products/summary') body = { total: created, active: record?.isActive ? 1 : 0, draft: record?.isActive ? 0 : created };
  else if (path === '/products') body = { items: record ? [record] : [], total: created, page: 1, pageSize: 25 };
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
  await navigate('/products/add'); await until('!!document.querySelector("#product-editor")', 'authorized editor');
  assert.ok(await evaluate('document.querySelector("#product-editor").textContent.includes("Basic information")'));
  assert.equal(await evaluate('document.querySelectorAll("#product-editor [role=tab]").length'), 0);
  await click('Save Draft');
  await until('!!document.querySelector("#product-editor [role=alert]")', 'inline errors'); assert.equal(created, 0);
  await field('Product Name', 'Test editor product'); await field('Category', category.id); await field('Regular Price (BDT)', '250'); await field('Stock Quantity', '7');
  await until('!!document.querySelector(".product-rich-content[contenteditable=true]")', 'TipTap ready');
  await evaluate(`(()=>{const data=new DataTransfer();data.setData('text/html',${JSON.stringify(richDescription)});const editor=document.querySelector('.product-rich-content');editor.focus();editor.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));})()`);
  await until('!!document.querySelector(".product-rich-content h2") && !!document.querySelector(".product-rich-content ol")', 'formatted paste');
  assert.ok(await evaluate('document.querySelector(".product-rich-content").textContent.includes("বাংলা")'));
  const document = await command('DOM.getDocument');
  const file = await command('DOM.querySelector', { nodeId: document.root.nodeId, selector: '#product-editor input[type=file]' });
  await command('DOM.setFileInputFiles', { nodeId: file.nodeId, files: [resolve(app, '../storefront/public/brand/ds-symbol.png')] });
  await until('document.querySelector("#product-editor").textContent.includes("ds-symbol.png")', 'queued image preview');
  await click('Save Draft');
  await until('document.body.textContent.includes("Simulated save failure")', 'save error');
  assert.equal(await evaluate('document.querySelector("#product-editor input").value'), 'Test editor product');
  await click('Save Draft');
  await until('document.body.textContent.includes("still need uploading")', 'partial image failure');
  assert.equal(created, 1); assert.equal(uploads, 1);
  await click('Save Draft');
  await until('location.pathname === "/products"', 'draft saved');
  assert.equal(created, 1); assert.equal(uploads, 2);
  for(const tag of ['h2','h3','strong','em','u','ul','ol','blockquote']) assert.ok(record.description.includes('<'+tag+'>'), 'saved '+tag);
  console.log('PASS: required fields, generated SKU, create draft, image upload failure/retry, no duplicate product');
  await navigate('/products/' + id + '/edit'); await until('!!document.querySelector("#product-editor")', 'edit product');
  await until('document.querySelector(".product-rich-content")?.textContent.includes("বাংলা Product")', 'description reopens');
  assert.equal(await evaluate('document.querySelectorAll(".product-rich-content li").length'),4);
  assert.equal(await evaluate('document.querySelector("#product-editor input").value'), 'Test editor product');
  await field('Regular Price (BDT)', '275'); await click('Publish Product');
  await until('location.pathname === "/products"', 'published product');
  assert.equal(record.status, 'ACTIVE'); assert.equal(record.price, '275'); assert.equal(record.stock, 7);
  writeFileSync(join(artifacts,'rich-product.json'), JSON.stringify({description:record.description}));
  console.log('PASS: editing uses revision guard, publishes real payload and retains inventory');
  record.images.push({id:secondImageId,productId:id,url:'/uploads/editor-test.png',altText:'Second image',isPrimary:false,sortOrder:1});
  await navigate('/products/' + id + '/edit'); await until('!!document.querySelector("#product-editor")', 'responsive editor');
  await until('document.querySelectorAll(".product-gallery-tile").length===2', 'compact gallery');
  await evaluate('document.querySelector("[aria-label=\\"Move image 2 earlier\\"]").click()');
  await until('document.querySelector(".product-gallery-tile .gallery-primary-badge") && document.querySelector("[aria-label=\\"Move image 1 later\\"]")?.disabled===false','reordered gallery');
  assert.equal(record.images[0].id,secondImageId); assert.equal(record.images[0].isPrimary,true);
  await evaluate('document.querySelector("[aria-label=\\"Edit details for image 1\\"]").click()');
  await until('!!document.querySelector(".gallery-image-details")', 'image details');
  await evaluate(`(()=>{const input=document.querySelector('.gallery-image-details input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'বাংলা image alt');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await evaluate('[...document.querySelectorAll(".gallery-image-details button")].find(button=>button.textContent==="Save image details").click()');
  await until('!document.querySelector(".gallery-image-details")','saved image alt');
  assert.equal(record.images[0].altText,'বাংলা image alt');
  await evaluate(`(()=>{const tiles=document.querySelectorAll('.product-gallery-tile');const data=new DataTransfer();tiles[0].dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:data}));tiles[1].dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:data}));tiles[1].dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));})()`);
  await until('document.querySelector("[aria-label=\\"Edit details for image 1\\"]")?.disabled===false','drag reorder saved');
  assert.equal(record.images[0].id,firstImageId);
  await evaluate('document.querySelector("[aria-label=\\"Edit details for image 2\\"]").click()');
  await until('!!document.querySelector(".gallery-image-details")','secondary image details');
  await evaluate('[...document.querySelectorAll(".gallery-image-details button")].find(button=>button.textContent==="Set as Primary").click()');
  await until('document.querySelector("[aria-label=\\"Edit details for image 1\\"]")?.disabled===false','primary saved');
  assert.equal(record.images.find(image=>image.id===secondImageId).isPrimary,true);
  await evaluate('document.querySelector("[aria-label=\\"Edit details for image 1\\"]").click()');
  await until('!!document.querySelector(".gallery-image-details input[type=file]")','replacement input');
  const replaceDocument = await command('DOM.getDocument');
  const replaceInput = await command('DOM.querySelector',{nodeId:replaceDocument.root.nodeId,selector:'.gallery-image-details input[type=file]'});
  await command('DOM.setFileInputFiles',{nodeId:replaceInput.nodeId,files:[resolve(app,'../storefront/public/brand/ds-symbol.png')]});
  await until('document.querySelector("[aria-label=\\"Edit details for image 1\\"]")?.disabled===false','replacement saved');
  assert.equal(replacements,1); assert.equal(record.images.length,2);
  await evaluate('document.querySelector("[aria-label=\\"Edit details for image 2\\"]").click()');
  await until('!!document.querySelector(".gallery-image-details")','remove details');
  await evaluate('[...document.querySelectorAll(".gallery-image-details button")].find(button=>button.textContent==="Remove image").click()');
  await until('[...document.querySelectorAll("dialog[open] button")].some(button=>button.textContent.trim()==="Confirm")','remove confirmation');
  await evaluate('[...document.querySelectorAll("dialog[open] button")].find(button=>button.textContent.trim()==="Confirm").click()');
  await until('document.querySelectorAll(".product-gallery-tile").length===1','image removed');
  assert.equal(record.images.length,1);
  console.log('PASS: drag reorder, explicit primary selection, replacement preserves mapping, and confirmed image removal');
  await until('!!document.querySelector(".product-rich-content")','editor after image edits');
  await evaluate(`(()=>{const data=new DataTransfer();data.setData('text/html','<p>Edited again বাংলা 😀</p>');const editor=document.querySelector('.product-rich-content');editor.focus();editor.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));})()`);
  await click('Update Product'); await until('location.pathname==="/products"','edited rich text saved again');
  assert.ok(record.description.includes('Edited again বাংলা')); assert.ok(record.description.includes('<h2>')); assert.ok(record.description.includes('<ul>'));
  writeFileSync(join(artifacts,'rich-product.json'),JSON.stringify({description:record.description}));
  await navigate('/products/'+id+'/edit'); await until('!!document.querySelector("#product-editor")','editor after rich update');
  console.log('PASS: formatted description persists and reopens; compact gallery order/primary and alt text save');
  await field('Product type', 'VARIABLE');
  assert.ok(await evaluate('document.querySelector("#product-editor").textContent.includes("+ Add option")'));
  await field('Product type', 'SIMPLE');
  assert.equal(await evaluate('document.querySelector("#product-editor").textContent.includes("+ Add option")'), false);
  await evaluate('[...document.querySelectorAll("#product-editor label")].find(label=>label.textContent.includes("Physical product / requires shipping")).querySelector("input").click()');
  assert.equal(await evaluate('[...document.querySelectorAll("#product-editor label")].some(label=>label.firstChild?.textContent.trim()==="Weight")'), false);
  await evaluate('[...document.querySelectorAll("#product-editor label")].find(label=>label.textContent.includes("Physical product / requires shipping")).querySelector("input").click()');
  for (const width of [390, 768, 1440]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: width < 600 });
    await pause(120);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
    for (const theme of ['light', 'dark']) {
      await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)};window.scrollTo({top:0,behavior:'instant'})`);
      const shot = await command('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(artifacts, `editor-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
    }
  }
  role = 'STAFF'; await navigate('/products/add');
  await until('document.body.textContent.includes("You do not have permission")', 'staff permission');
  assert.equal(await evaluate('!!document.querySelector("#product-editor")'), false);
  if (interceptionError) throw interceptionError;
  console.log('PASS: mobile/tablet/desktop overflow, light/dark screenshots, and staff role restriction');
  console.log('Screenshots: ' + artifacts);
} finally {
  ws?.close(); chrome?.kill(); server?.kill(); await pause(700);
  assert.equal(dirname(resolve(profile)), resolve(tmpdir())); assert(basename(profile).startsWith('ds-editor-'));
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may briefly retain a lock. */ }
}
