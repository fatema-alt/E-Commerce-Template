import 'dotenv/config';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';

const target = process.env.CATALOG_TEST_DATABASE_URL;
if (
  !target ||
  !new URL(target).pathname.startsWith('/commerce_catalog_validation_')
)
  throw new Error(
    'Set CATALOG_TEST_DATABASE_URL to an isolated validation database',
  );
process.env.DATABASE_URL = target;
const media = await mkdtemp(join(tmpdir(), 'commerce-catalog-http-'));
process.env.MEDIA_ROOT = media;
process.env.MEDIA_STORAGE = 'local';
const { AppModule } = await import('../dist/app.module.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');
const { hashPassword } = await import('../dist/auth/password.js');
const { tokenDigest } = await import('../dist/auth/auth.service.js');
const app = await NestFactory.create(AppModule, { logger: false });
app.setGlobalPrefix('api/v1');
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
const suffix = randomUUID().slice(0, 8);
const password = randomUUID() + randomUUID();
let assertions = 0;
try {
  await app.listen(0, '127.0.0.1');
  const base = (await app.getUrl()) + '/api/v1';
  const db = app.get(PrismaService);
  await db.catalogAuditLog.deleteMany({
    where: { entity: 'authAttempt', entityId: tokenDigest('127.0.0.1') },
  });
  const check = (actual, expected) => {
    assert.equal(actual, expected);
    assertions++;
  };
  const send = async (path, method = 'GET', cookie, body, csrf = true) =>
    fetch(base + path, {
      method,
      headers: {
        ...(csrf ? { 'X-Commerce-Admin': '1' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body && !(body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
      body: body
        ? body instanceof FormData
          ? body
          : JSON.stringify(body)
        : undefined,
    });
  check((await send('/products')).status, 401);
  check(
    (
      await send(
        '/auth/login',
        'POST',
        undefined,
        { email: 'test@example.com', password },
        false,
      )
    ).status,
    403,
  );
  const cookies = {};
  const hash = await hashPassword(password);
  for (const role of ['SUPER_ADMIN', 'ADMIN', 'STAFF']) {
    const email = role.toLowerCase() + '-' + suffix + '@catalog.test';
    await db.adminUser.create({ data: { email, passwordHash: hash, role } });
    const response = await send('/auth/login', 'POST', undefined, {
      email,
      password,
    });
    check(response.status, 201);
    const cookie = response.headers.get('set-cookie');
    assert.ok(cookie?.includes('HttpOnly'));
    assert.ok(cookie?.includes('SameSite=Lax'));
    assertions += 2;
    cookies[role] = cookie.split(';')[0];
  }
  check(
    (
      await send('/categories', 'POST', cookies.STAFF, {
        name: 'Forbidden',
        slug: 'forbidden-' + suffix,
      })
    ).status,
    403,
  );
  const categoryResponse = await send('/categories', 'POST', cookies.ADMIN, {
    name: 'HTTP category',
    slug: 'http-' + suffix,
  });
  check(categoryResponse.status, 201);
  const category = await categoryResponse.json();
  const payload = {
    name: 'HTTP product',
    slug: 'http-product-' + suffix,
    sku: 'HTTP-' + suffix,
    price: '10.25',
    costPrice: '7.25',
    internalNotes: 'private',
    stock: 3,
    categoryId: category.id,
    status: 'ACTIVE',
  };
  const response = await send('/products', 'POST', cookies.ADMIN, payload);
  check(response.status, 201);
  const product = await response.json();
  const staffProduct = await (
    await send('/products/' + product.id, 'GET', cookies.STAFF)
  ).json();
  check('costPrice' in staffProduct, false);
  check('internalNotes' in staffProduct, false);
  check(
    (await send('/products/' + product.id, 'DELETE', cookies.ADMIN)).status,
    403,
  );
  check(
    (
      await send('/products/' + product.id, 'PATCH', cookies.ADMIN, {
        price: null,
      })
    ).status,
    400,
  );
  check(
    (await send('/products?pageSize=1000', 'GET', cookies.ADMIN)).status,
    400,
  );
  check(
    (
      await send('/products/bulk', 'POST', cookies.ADMIN, {
        ids: [product.id],
        action: 'DELETE',
      })
    ).status,
    403,
  );
  check(
    (await send('/categories/' + category.id, 'DELETE', cookies.SUPER_ADMIN))
      .status,
    409,
  );
  const fake = new FormData();
  fake.append(
    'file',
    new Blob(['<script>evil()</script>'], { type: 'image/png' }),
    'fake.png',
  );
  check(
    (
      await send(
        '/products/' + product.id + '/images',
        'POST',
        cookies.ADMIN,
        fake,
      )
    ).status,
    400,
  );
  const png = await sharp({
    create: { width: 64, height: 64, channels: 3, background: 'indigo' },
  })
    .png()
    .toBuffer();
  const valid = new FormData();
  valid.append('file', new Blob([png], { type: 'image/png' }), 'valid.png');
  const uploaded = await send(
    '/products/' + product.id + '/images',
    'POST',
    cookies.ADMIN,
    valid,
  );
  check(uploaded.status, 201);
  const image = await uploaded.json();
  check(image.isPrimary, true);
  assert.ok(image.url.endsWith('.webp'));
  assertions++;
  check(
    (
      await send(
        '/products/' + product.id + '/images/' + image.id,
        'DELETE',
        cookies.STAFF,
      )
    ).status,
    403,
  );
  check(
    (
      await send(
        '/products/' + product.id + '/images/' + image.id,
        'PATCH',
        cookies.ADMIN,
        { altText: 'Accessible product image' },
      )
    ).status,
    200,
  );
  const publicProduct = await (
    await send('/storefront/products/' + product.slug)
  ).json();
  check(publicProduct.price, '10.25');
  check('costPrice' in publicProduct, false);
  check('internalNotes' in publicProduct, false);
  check(
    (
      await send(
        '/products/' + product.id + '/images/' + image.id,
        'DELETE',
        cookies.ADMIN,
      )
    ).status,
    200,
  );
  check(
    (await send('/products/' + product.id, 'DELETE', cookies.SUPER_ADMIN))
      .status,
    200,
  );
  check((await send('/storefront/products/' + product.slug)).status, 404);
  check((await send('/auth/logout', 'POST', cookies.STAFF)).status, 201);
  check((await send('/products', 'GET', cookies.STAFF)).status, 401);
  console.log('Catalog HTTP smoke test passed: ' + assertions + ' assertions');
} finally {
  await app.close();
  const resolved = resolve(media);
  if (!resolved.startsWith(resolve(tmpdir()) + sep + 'commerce-catalog-http-'))
    throw new Error('Unexpected temporary media directory');
  await rm(resolved, { recursive: true, force: true });
}
