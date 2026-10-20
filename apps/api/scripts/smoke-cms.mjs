import 'dotenv/config';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';

const target = process.env.CMS_TEST_DATABASE_URL;
if (
  !target ||
  !new URL(target).pathname.startsWith('/commerce_cms_validation_')
)
  throw new Error(
    'CMS_TEST_DATABASE_URL must name an isolated CMS validation database',
  );
process.env.DATABASE_URL = target;
const mediaRoot = await mkdtemp(join(tmpdir(), 'cms-http-'));
process.env.MEDIA_STORAGE = 'local';
process.env.MEDIA_ROOT = mediaRoot;
const { AppModule } = await import('../dist/app.module.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');
const { tokenDigest, SESSION_COOKIE } =
  await import('../dist/auth/auth.service.js');
const { DEFAULT_THEME } = await import('../dist/cms/cms-schema.js');
const app = await NestFactory.create(AppModule, { logger: false });
app.setGlobalPrefix('api/v1');
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
let checks = 0;
try {
  await app.listen(0, '127.0.0.1');
  const base = (await app.getUrl()) + '/api/v1';
  const db = app.get(PrismaService);
  const cookies = {};
  for (const role of ['STAFF', 'ADMIN', 'SUPER_ADMIN']) {
    const token = randomUUID();
    const user = await db.adminUser.create({
      data: {
        email: `${token}@cms.test`,
        passwordHash: 'unused-test-session',
        role,
      },
    });
    await db.adminSession.create({
      data: {
        userId: user.id,
        tokenHash: tokenDigest(token),
        expiresAt: new Date(Date.now() + 60000),
      },
    });
    cookies[role] = `${SESSION_COOKIE}=${token}`;
  }
  const send = (path, method = 'GET', role, body, csrf = true, extra = {}) =>
    fetch(base + path, {
      method,
      headers: {
        ...(role ? { Cookie: cookies[role] } : {}),
        ...(csrf ? { 'X-Commerce-Admin': '1' } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...extra,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  const status = async (request, expected) => {
    const response = await request;
    assert.equal(response.status, expected, await response.clone().text());
    checks++;
    return response;
  };
  const key = `http-${randomUUID()}`;
  const admin = `/admin/cms/THEME/${key}`;
  const pub = `/storefront/cms/THEME/${key}`;
  const draft = { expectedRevision: 0, content: DEFAULT_THEME };
  await status(send('/admin/cms/schema'), 401);
  await status(send('/admin/cms/schema', 'GET', 'STAFF'), 200);
  await status(send(admin + '/draft', 'PATCH', 'STAFF', draft), 403);
  await status(send(admin + '/draft', 'PATCH', 'ADMIN', draft, false), 403);
  await status(send(admin + '/draft', 'PATCH', 'ADMIN', draft), 200);
  await status(send(pub), 404);
  const upload = async (role, bytes, name = 'test.png') => {
    const form = new FormData();
    form.append('file', new Blob([bytes]), name);
    return fetch(base + '/admin/cms/media', {
      method: 'POST',
      headers: { Cookie: cookies[role], 'X-Commerce-Admin': '1' },
      body: form,
    });
  };
  await status(upload('STAFF', Buffer.from('invalid')), 403);
  await status(upload('ADMIN', Buffer.from('invalid')), 400);
  const image = await sharp({
    create: { width: 64, height: 64, channels: 3, background: '#48725c' },
  })
    .png()
    .toBuffer();
  const uploaded = await status(upload('ADMIN', image), 201);
  const asset = await uploaded.json();
  assert.equal(asset.mimeType, 'image/webp');
  checks++;
  assert.ok(asset.url.startsWith('/uploads/cms/'));
  checks++;
  await status(
    send(admin + '/publish', 'POST', 'ADMIN', { expectedRevision: 1 }),
    403,
  );
  await status(
    send(admin + '/rollback', 'POST', 'SUPER_ADMIN', { expectedRevision: 1 }),
    400,
  );
  await status(
    send(admin + '/publish', 'POST', 'SUPER_ADMIN', { expectedRevision: 1 }),
    201,
  );
  const live = await status(send(pub), 200);
  const tag = live.headers.get('etag');
  assert.ok(tag);
  checks++;
  assert.equal(live.headers.get('cache-control'), 'no-store');
  checks++;
  const payload = await live.json();
  assert.equal(payload.revision, undefined);
  checks++;
  await status(
    send(pub, 'GET', undefined, undefined, true, { 'If-None-Match': tag }),
    304,
  );
  await status(
    send(admin + '/draft', 'PATCH', 'ADMIN', {
      expectedRevision: 2,
      content: { ...DEFAULT_THEME, primary: '#112233' },
    }),
    200,
  );
  const stillLive = await status(send(pub), 200);
  assert.equal(stillLive.headers.get('etag'), tag);
  checks++;
  await status(
    send(admin + '/publish', 'POST', 'SUPER_ADMIN', { expectedRevision: 2 }),
    409,
  );
  await status(
    send(admin + '/draft', 'PATCH', 'ADMIN', {
      expectedRevision: 3,
      content: { ...DEFAULT_THEME, primary: 'url(javascript:alert(1))' },
    }),
    400,
  );
  await status(send('/admin/cms/changes', 'GET', 'ADMIN'), 403);
  await status(send('/admin/cms/changes', 'GET', 'SUPER_ADMIN'), 200);
  await status(
    send(admin + '/unpublish', 'POST', 'SUPER_ADMIN', { expectedRevision: 3 }),
    201,
  );
  await status(send(pub), 404);
  console.log(`CMS HTTP checks passed: ${checks}`);
} finally {
  await app.close();
  await rm(mediaRoot, { recursive: true, force: true });
}
