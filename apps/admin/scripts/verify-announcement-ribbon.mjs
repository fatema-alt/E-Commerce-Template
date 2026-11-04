// Run with the storefront dev server at http://localhost:3108. No CMS records are changed.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 850 } });
let ribbon = { enabled: true, animation: 'marquee', scrollSpeed: 80, intervalSeconds: 6, backgroundColor: '#123456', textColor: '#ffffff', accentColor: '#ddff55', items: [
  { id: 'first', enabled: true, text: 'Published CMS announcement', device: 'both', ctaLabel: 'Shop offers', ctaUrl: '/shop' },
  { id: 'second', enabled: true, text: 'Delivery updates', device: 'both' },
  { id: 'hidden', enabled: false, text: 'Disabled text', device: 'both' },
] };
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.route('**/api/storefront-settings', (route) => route.fulfill({ json: { announcementRibbon: ribbon } }));
const matrix = () => page.locator('.ribbon-marquee-track').evaluate((node) => getComputedStyle(node).transform);
const refresh = async () => {
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
};
try {
  await page.goto('http://localhost:3108/track', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator('.ribbon-marquee-track').waitFor();
  assert.equal(await page.locator('.ribbon-marquee-group').count(), 2);
  assert.equal(await page.locator('.ribbon-marquee-group').first().getByRole('link', { name: 'Shop offers' }).getAttribute('href'), '/shop');
  assert.equal(await page.locator('.smart-ribbon').getByText('Disabled text').count(), 0);
  assert.equal(await page.locator('.smart-ribbon').evaluate((node) => getComputedStyle(node).backgroundColor), 'rgb(18, 52, 86)');
  const before = await matrix();
  await page.waitForTimeout(250);
  assert.notEqual(await matrix(), before, 'ribbon moves continuously');
  await page.locator('.smart-ribbon').hover();
  const hovered = await matrix();
  await page.waitForTimeout(200);
  assert.equal(await matrix(), hovered, 'hover pauses motion');
  await page.getByRole('button', { name: 'Pause announcements' }).click();
  await page.mouse.move(600, 400);
  assert.equal(await page.locator('.ribbon-marquee-track').evaluate((node) => getComputedStyle(node).animationPlayState), 'paused');
  await page.getByRole('button', { name: 'Play announcements' }).click();
  await page.mouse.move(600, 400);
  ribbon = { ...ribbon, items: [{ id: 'new', enabled: true, text: 'Freshly published ribbon', device: 'both' }] };
  await refresh();
  await page.locator('.ribbon-marquee-group').first().getByText('Freshly published ribbon').waitFor();
  ribbon = { ...ribbon, enabled: false };
  await refresh();
  await page.locator('.smart-ribbon').waitFor({ state: 'detached' });
  ribbon = { ...ribbon, enabled: true, items: [{ id: 'mobile', enabled: true, text: 'Mobile offer', device: 'mobile' }, { id: 'desktop', enabled: true, text: 'Desktop offer', device: 'desktop' }] };
  await page.setViewportSize({ width: 390, height: 844 });
  await refresh();
  await page.locator('.ribbon-marquee-group').first().getByText('Mobile offer').waitFor();
  assert.equal(await page.locator('.smart-ribbon').getByText('Desktop offer').count(), 0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.ribbon-marquee-track').evaluate((node) => getComputedStyle(node).animationName), 'none');
  assert.equal(await page.locator('.ribbon-marquee-group[aria-hidden]').isVisible(), false);
  assert.deepEqual(errors, []);
  console.log('PASS: CMS content, colors, links, seamless loop, hover/pause, published refresh, disable, mobile and reduced motion.');
} finally {
  await browser.close();
}
