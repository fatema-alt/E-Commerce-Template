import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(import.meta.url);
const modules = new Map();
function load(relative) {
  const path = resolve(root, relative);
  if (modules.has(path)) return modules.get(path).exports;
  const module = { exports: {} };
  modules.set(path, module);
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  new Function('require', 'exports', 'module', code)((id) => {
    if (!id.startsWith('.')) return require(id);
    const base = resolve(dirname(path), id);
    const dependency = [base, `${base}.ts`, `${base}.tsx`].find(existsSync);
    assert.ok(dependency, `Module exists: ${id}`);
    return load(dependency);
  }, module.exports, module);
  return module.exports;
}

const forbidden = /100\s*%\s*(?:authentic|genuine)|authentic guarantee|authorized (?:brand )?distributors?|full warranty|24\s*\/\s*7|lightning[ -]fast|\b\d+\s*(?:-|to)\s*\d+\s*(?:hours?|h|days?)\b|\b\d+[ -]*(?:day|hour)s?\b|hassle[ -]free|\b(?:full|quick) refunds?\b|best sellers|top sellers|inspect(?:ion)?|cashback|\bEMI\b|\d+(?:[.,]\d+)?\s*%|[৳]|\bBDT\s*\d|anywhere (?:across|in)|(?:all across|nationwide)|exclusive (?:member|voucher)|weekly (?:newsletter|sales)|secret weekend|limited time flash/i;
function neutral(text) { assert.doesNotMatch(text, forbidden); }
function textValues(value) {
  if (typeof value === 'string') return [value];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, item]) =>
    ['id', 'type', 'icon', 'source', 'href', 'ctaHref', 'privacyHref'].includes(key) ? [] : textValues(item));
}
const { fallbackConfig } = load('apps/storefront/src/lib/storefront.ts');
const { getStandardEcommerceTemplate } = load('apps/admin/src/components/cms/standard-template.ts');
const template = getStandardEcommerceTemplate();
const { BLOCK_SCHEMAS } = load('apps/api/src/cms/cms-schema.ts');
for (const section of template) {
  assert.ok(BLOCK_SCHEMAS[section.type], `Known section type: ${section.type}`);
  for (const key of BLOCK_SCHEMAS[section.type].required || []) {
    assert.ok(Object.hasOwn(section.config, key), `${section.id} has required ${key}`);
  }
}
for (const text of [...textValues(fallbackConfig.home), ...textValues(template)]) neutral(text);
const sale = template.find(section => section.id === 'flash-sale-deals');
assert.equal(sale.type, 'productGrid', 'The dormant section is a normal grid, not an invented sale');
assert.ok(template.every(section => section.type !== 'flashSale'));
assert.equal(sale.visible, false, 'No invented flash sale on new installs/resets');
assert.equal(sale.config.endsAt, undefined, 'No automatically generated campaign deadline');
assert.equal(template.find(section => section.id === 'best-sellers').config.source, 'latest');
assert.equal(template.find(section => section.id === 'best-sellers').config.title, 'Latest products');

const { HeroBanner } = load('apps/storefront/src/components/hero-banner.tsx');
const hero = renderToStaticMarkup(React.createElement(HeroBanner, { config: { title: 'Explore products' } }));
const strip = hero.slice(hero.indexOf('class="hero-trust-strip"'));
neutral(strip.replace(/<[^>]*>/g, ' '));
assert.ok(strip.includes('Questions about returns? Contact our team.'));
assert.ok(strip.includes('Check available payment methods at checkout.'));

const { Newsletter } = load('apps/storefront/src/components/newsletter.tsx');
for (const props of [{}, { title: 'Get 10% Off Your First Order', description: 'Exclusive voucher drops and secret weekend sales.' }]) {
  const html = renderToStaticMarkup(React.createElement(Newsletter, props));
  neutral(html.replace(/<[^>]*>/g, ' '));
  assert.ok(html.includes('DS MART UPDATES'));
  assert.ok(html.includes('Subscribe to receive news and product updates from DS Mart.'));
}

// Prove the guard rejects representative reintroductions, rather than merely matching today's copy.
for (const claim of ['100% authentic', 'full warranty', '24/7', 'lightning-fast', '24 to 48 hours', '7-Day Returns', 'hassle-free refunds', 'Best Sellers', 'inspect before paying', 'bKash cashback', '0% EMI', '60% OFF', '৳80', 'BDT 2000', 'anywhere in Bangladesh', 'EXCLUSIVE MEMBER OFFERS']) {
  assert.throws(() => neutral(claim), undefined, `Reject: ${claim}`);
}
console.log('PASS: neutral homepage defaults, rendered hero strip and newsletter; unsupported-claim regression guard');
