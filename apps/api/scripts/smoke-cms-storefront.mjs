import 'dotenv/config';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
const target = process.env.CMS_TEST_DATABASE_URL;
if (
  !target ||
  !new URL(target).pathname.startsWith('/commerce_cms_validation_')
)
  throw new Error('An isolated CMS validation database is required');
process.env.DATABASE_URL = target;
process.env.MEDIA_STORAGE = 'local';
const { AppModule } = await import('../dist/app.module.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');
const { CmsService } = await import('../dist/cms/cms.service.js');
const { DEFAULT_THEME } = await import('../dist/cms/cms-schema.js');
const app = await NestFactory.create(AppModule, { logger: false });
app.setGlobalPrefix('api/v1');
app.useGlobalPipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
);
let child;
let logs = '';
let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks++;
};
try {
  await app.listen(0, '127.0.0.1');
  const api = (await app.getUrl()) + '/api/v1';
  const db = app.get(PrismaService);
  const cms = app.get(CmsService);
  const suffix = randomUUID();
  const key = (prefix) => prefix + '-' + suffix;
  const actor = await db.adminUser.create({
    data: {
      email: key('publisher') + '@cms.test',
      passwordHash: 'unused',
      role: 'SUPER_ADMIN',
    },
  });
  const category = await db.category.create({
    data: { name: key('Department'), slug: key('department') },
  });
  const makeProduct = (name, extra = {}) =>
    db.product.create({
      data: {
        name: key(name),
        slug: key(name),
        sku: key(name),
        categoryId: category.id,
        price: 100,
        status: 'ACTIVE',
        ...extra,
      },
    });
  const first = await makeProduct('First', { isFeatured: true, salePrice: 80 });
  const second = await makeProduct('Second');
  const hidden = await makeProduct('Private', { isVisible: false });
  const asset = await db.cmsMediaAsset.create({
    data: {
      storageKey: key('asset'),
      uploadedBy: actor.id,
      mimeType: 'image/webp',
      bytes: 300,
      url: '/uploads/cms/fixture.webp',
    },
  });
  const publish = async (kind, name, content) => {
    await cms.draft(kind, name, content, 0, actor.id);
    await cms.publish(kind, name, 1, actor.id);
  };
  const image = { assetId: asset.id, alt: key('Image') };
  const button = { label: 'Explore', href: '/categories' };
  const configs = {
    hero: { title: key('Hero'), image, button },
    bannerSlider: { slides: [{ title: key('Slide'), image }] },
    categoryGrid: { title: 'Departments', categoryIds: [category.id] },
    productGrid: {
      title: 'Selected products',
      source: 'selected',
      productIds: [second.id, first.id, hidden.id],
    },
    productCarousel: { title: 'Featured products', source: 'featured' },
    featuredCollections: {
      title: 'Collections',
      collections: [{ name: 'Collection', href: '/categories', image }],
    },
    brandShowcase: { title: 'Brands', brands: [{ name: 'Brand', image }] },
    flashSale: {
      title: 'Sale',
      source: 'sale',
      endsAt: new Date(Date.now() + 86400000).toISOString(),
    },
    promoBanner: { title: key('Promo'), button },
    imageText: { title: 'Image story', paragraphs: ['A simple story'], image },
    richText: { paragraphs: ['<script>literal content</script>'] },
    faq: {
      title: 'Questions',
      items: [{ question: 'Delivery?', answer: 'Contact our store.' }],
    },
    newsletter: {
      title: 'News',
      buttonLabel: 'Learn more',
      consentText: 'Read our policy',
      privacyHref: '/privacy',
    },
    trustFeatures: {
      items: [
        {
          title: 'Quality',
          description: 'Selected with care',
          icon: 'quality',
        },
      ],
    },
  };
  await publish('THEME', key('theme'), {
    ...DEFAULT_THEME,
    primary: '#123456',
    radius: 9,
  });
  await publish('NAVIGATION', key('menu'), {
    label: 'Main',
    items: [
      {
        id: 'home',
        label: key('Menu'),
        href: '/categories',
        children: [{ id: 'nested', label: 'Nested menu', href: '/categories' }],
      },
    ],
  });
  await publish('SITE_SETTINGS', key('settings'), {
    storeName: key('Store'),
    currency: 'BDT',
    locale: 'en',
    logoAssetId: asset.id,
    header: {
      layout: 'classic',
      searchPlacement: 'header',
      menuKey: key('menu'),
    },
    footer: { columns: [], copyright: key('Copyright') },
  });
  const content = {
    title: key('Page'),
    seo: { title: key('SEO'), description: 'CMS integration test' },
    sections: Object.entries(configs).map(([type, config]) => ({
      id: type,
      type,
      visible: true,
      config,
    })),
  };
  await publish('PAGE', key('home'), content);
  await publish('PAGE', key('about'), { title: key('About'), sections: [] });
  await cms.draft(
    'PAGE',
    key('draft'),
    { title: key('SecretPage'), sections: [] },
    0,
    actor.id,
  );
  const getApi = async (path) => {
    const response = await fetch(api + path);
    assert.equal(response.status, 200);
    checks++;
    return response.json();
  };
  const selected = await getApi(
    `/storefront/products?source=selected&ids=${second.id},${first.id},${hidden.id}&pageSize=1`,
  );
  check(
    selected.items.length === 1 && selected.items[0].id === second.id,
    'Selection order must be applied before pagination',
  );
  const featured = await getApi(
    `/storefront/products?source=featured&ids=${first.id},${second.id}`,
  );
  check(
    featured.items.length === 1 && featured.items[0].id === first.id,
    'Featured filter',
  );
  const sale = await getApi(
    `/storefront/products?source=sale&ids=${first.id},${second.id}`,
  );
  check(
    sale.items.length === 1 && sale.items[0].id === first.id,
    'Active sale filter',
  );
  const publicPage = await getApi(`/storefront/cms/PAGE/${key('home')}`);
  check(
    publicPage.assets.length === 1 &&
      publicPage.assets[0].id === asset.id &&
      !('uploadedBy' in publicPage.assets[0]),
    'Only referenced public image metadata',
  );
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  const storefront = resolve('../storefront');
  child = spawn(
    process.execPath,
    [
      '--max-old-space-size=512',
      resolve(storefront, 'node_modules/next/dist/bin/next'),
      'start',
      '--port',
      String(port),
    ],
    {
      cwd: storefront,
      env: {
        ...process.env,
        STOREFRONT_API_BASE_URL: api,
        CMS_SETTINGS_KEY: key('settings'),
        CMS_THEME_KEY: key('theme'),
        CMS_HOME_KEY: key('home'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  child.stdout.on('data', (chunk) => {
    logs = (logs + chunk).slice(-8000);
  });
  child.stderr.on('data', (chunk) => {
    logs = (logs + chunk).slice(-8000);
  });
  const origin = `http://localhost:${port}`;
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(origin)).ok) {
        ready = true;
        break;
      }
    } catch {}
    if (child.exitCode !== null) break;
    await delay(500);
  }
  assert.ok(ready, logs);
  const html = await (await fetch(origin)).text();
  for (const text of [
    key('Store'),
    key('Menu'),
    key('Hero'),
    key('Promo'),
    first.name,
    second.name,
    category.name,
    key('Copyright'),
    '#123456',
    '/uploads/cms/fixture.webp',
    'Nested menu',
  ])
    check(html.includes(text), 'Missing rendered content: ' + text);
  check(!html.includes(hidden.name), 'Hidden catalog content must not appear');
  check(
    html.includes('&lt;script&gt;literal content&lt;/script&gt;'),
    'Text must be escaped',
  );
  check(html.includes(key('SEO')), 'Published page metadata');
  await cms.draft(
    'PAGE',
    key('home'),
    {
      ...content,
      sections: [
        {
          id: 'private',
          type: 'hero',
          visible: true,
          config: { title: key('SecretDraft') },
        },
      ],
    },
    2,
    actor.id,
  );
  const unchanged = await (await fetch(origin)).text();
  check(
    unchanged.includes(key('Hero')) && !unchanged.includes(key('SecretDraft')),
    'Unpublished draft must not change storefront',
  );
  await cms.publish('PAGE', key('home'), 3, actor.id);
  check(
    (await (await fetch(origin)).text()).includes(key('SecretDraft')),
    'Publication must be visible without rebuilding',
  );
  const about = await fetch(`${origin}/${key('about')}`);
  check((await about.text()).includes(key('About')), 'Published dynamic page');
  const draft = await fetch(`${origin}/${key('draft')}`);
  check(
    !(await draft.text()).includes(key('SecretPage')),
    'Draft dynamic page must not leak',
  );
  console.log(`CMS storefront integration checks passed: ${checks}`);
} finally {
  child?.kill();
  await app.close();
}
