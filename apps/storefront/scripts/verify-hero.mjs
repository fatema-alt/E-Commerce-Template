import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const modules = new Map();
function load(name) {
  if (modules.has(name)) return modules.get(name);
  const source = readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { fileName: `${name}.ts`, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  modules.set(name, module.exports);
  new Function('require', 'exports', 'module', code)((id) => id.startsWith('./') ? load(id.slice(2)) : require(id), module.exports, module);
  modules.set(name, module.exports);
  return module.exports;
}
const { heroSlides } = load('hero-slides');
const image = { assetId: 'desktop', alt: 'Shopping offer' };
const mobileImage = { assetId: 'mobile', alt: 'Mobile offer' };
const assets = [{ id: 'desktop', url: '/uploads/desktop.webp' }, { id: 'mobile', url: '/uploads/mobile.webp' }];
const slides = heroSlides({ slides: [
  { title: 'Shopping', slideType: 'full_banner', image, mobileImage, bannerLink: '/shop' },
  { title: 'Fashion', slideType: 'split_content', image, button: { label: 'Shop fashion', href: '/category/fashion' } },
  { title: 'Disabled', enabled: false },
] }, assets);
assert.equal(slides.length, 2);
assert.equal(slides[0].type, 'full_banner');
assert(slides[0].imageSrc.endsWith('/uploads/desktop.webp'));
assert(slides[0].mobileSrc.endsWith('/uploads/mobile.webp'));
assert.equal(slides[0].href, '/shop');
assert.equal(slides[1].primary.href, '/category/fashion');
assert.equal(heroSlides({ slides: [{ bannerType: 'without_button' }] })[0].type, 'full_banner');
assert.equal(heroSlides({ slides: [{ slideType: 'split_content', bannerType: 'without_button' }] })[0].type, 'split_content');
assert.equal(heroSlides({ slides: [{ enabled: false }] }).length, 0);
assert.equal(heroSlides({ title: 'Legacy hero' }).length, 1);
assert.equal(heroSlides({ slides: [{ button: { label: 'Unsafe', href: 'javascript:alert(1)' }, bannerLink: '//evil.example' }] })[0].primary, undefined);
assert.equal(heroSlides({ slides: [{ bannerLink: '//evil.example' }] })[0].href, undefined);
assert(!heroSlides({ slides: [{ backgroundGradient: 'url(https://evil.example)' }] })[0].gradient.includes('url('));
console.log('Hero checks passed: types, mobile images, ordering, legacy compatibility, disabled slides, safe links and gradients.');
