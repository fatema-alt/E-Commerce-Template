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

const policy = JSON.parse(readFileSync(new URL('./claims-policy.json', import.meta.url), 'utf8'));
function neutral(text, context = 'Rendered copy') {
  for (const rule of policy.rules) assert.doesNotMatch(text, new RegExp(rule.pattern, 'i'), `${context}: ${rule.name}`);
}
function scanSource(source, path) {
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const copy = [];
  function visit(node) {
    if (ts.isPropertyAssignment(node) && /^(freeAbove|insideDhaka|outsideDhaka)$/.test(node.name.getText(tree).replace(/["']/g, '')) && ts.isNumericLiteral(node.initializer)) {
      assert.fail(`${path}: hardcoded shipping configuration in storefront copy`);
    }
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      const inline = node.children.map(child => ts.isJsxText(child) ? child.text : ts.isJsxExpression(child) && child.expression && (ts.isNumericLiteral(child.expression) || ts.isStringLiteral(child.expression)) ? child.expression.text : '${dynamic}').join('');
      neutral(inline.replace(/\s+/g, ' '), path);
    }
    if (ts.isTemplateExpression(node)) {
      copy.push(node.head.text + node.templateSpans.map(span => '${dynamic}' + span.literal.text).join(''));
      return;
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node)) copy.push(node.text.replace(/\s+/g, ' ').trim());
    if (ts.isJsxExpression(node) && node.expression && ts.isNumericLiteral(node.expression)) copy.push(node.expression.text);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  neutral(copy.join('\n'), path);
}
for (const path of policy.files) scanSource(readFileSync(resolve(root, path), 'utf8'), path);
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
const savedFetch = globalThis.fetch;
const productQueries = [];
try {
  globalThis.fetch = async url => {
    productQueries.push(new URL(url).searchParams.get('source'));
    return new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 });
  };
  await load('apps/storefront/src/lib/storefront.ts').getFeaturedProducts();
  const { sectionProducts } = load('apps/storefront/src/lib/cms.ts');
  await sectionProducts({ source: 'featured' });
  await sectionProducts({ source: 'latest' });
  assert.deepEqual(productQueries, ['featured', 'featured', 'latest']);
} finally { globalThis.fetch = savedFetch; }
for (const section of template) {
  assert.ok(BLOCK_SCHEMAS[section.type], `Known section type: ${section.type}`);
  for (const key of BLOCK_SCHEMAS[section.type].required || []) {
    assert.ok(Object.hasOwn(section.config, key), `${section.id} has required ${key}`);
  }
}
for (const text of [...textValues(fallbackConfig.home), ...textValues(template)]) neutral(text);
function noFillerDuplicates(text) {
  for (const phrase of policy.duplicatePhrases) {
    assert.ok(text.split('\n').filter(line => line.trim().toLowerCase() === phrase.toLowerCase()).length <= policy.maxVisibleOccurrencesPerPage, `Repeated filler: ${phrase}`);
  }
}
for (const sections of [template, fallbackConfig.home]) {
  noFillerDuplicates(textValues(sections.filter(section => section.visible !== false)).join('\n'));
}
assert.equal(template.find(section => section.type === 'trustFeatures').visible, false);
assert.equal(fallbackConfig.home.find(section => section.type === 'trustBadges').visible, false);
assert.equal(template.find(section => section.type === 'hero').config.showTrustStrip, false);
assert.equal(fallbackConfig.home.find(section => section.type === 'hero').showTrustStrip, false);
const sale = template.find(section => section.id === 'flash-sale-deals');
assert.equal(sale.type, 'productGrid', 'The dormant section is a normal grid, not an invented sale');
assert.ok(template.every(section => section.type !== 'flashSale'));
assert.equal(sale.visible, false, 'No invented flash sale on new installs/resets');
assert.equal(sale.config.endsAt, undefined, 'No automatically generated campaign deadline');
assert.equal(sale.config.source, 'featured');
assert.equal(fallbackConfig.home.find(section => section.type === 'products').source, 'featured');
assert.equal(template.find(section => section.id === 'best-sellers').config.source, 'latest');
assert.equal(template.find(section => section.id === 'best-sellers').config.title, 'Latest products');

const { HeroBanner } = load('apps/storefront/src/components/hero-banner.tsx');
const hero = renderToStaticMarkup(React.createElement(HeroBanner, { config: { title: 'Explore products' } }));
assert.ok(!hero.includes('class="hero-trust-strip"'), 'Hero strip hidden by default');
const enabledHero = renderToStaticMarkup(React.createElement(HeroBanner, { config: { title: 'Explore products', showTrustStrip: true } }));
const strip = enabledHero.slice(enabledHero.indexOf('class="hero-trust-strip"'));
assert.ok(strip.includes('class="hero-trust-strip"'), 'Hero strip can be explicitly enabled');
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
for (const rule of policy.rules) {
  for (const claim of rule.examples) {
    assert.match(claim, new RegExp(rule.pattern, 'i'), `Policy example matches ${rule.name}`);
    assert.throws(() => scanSource(`const copy = ${JSON.stringify(claim)}`, 'regression.ts'), undefined, `Reject: ${claim}`);
  }
}
neutral('Free delivery on orders of at least ৳${dynamic} after discounts.');
for (const phrase of policy.duplicatePhrases) assert.throws(() => noFillerDuplicates(`${phrase}\n${phrase}`));
assert.throws(() => scanSource('const C = () => <p>Free delivery over {2000}</p>', 'regression.tsx'));
assert.throws(() => scanSource('const rates = {freeAbove: 2000}', 'regression.ts'));
console.log(`PASS: ${policy.files.length} CMS/default/product/cart/checkout/help sources scanned; rendered copy and editable policy mutation checks`);
