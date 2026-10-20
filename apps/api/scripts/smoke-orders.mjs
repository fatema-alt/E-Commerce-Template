// Run after `pnpm --filter api build` and `verify-orders.ts`.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';

const url = new URL(
  process.env.ORDERS_TEST_DATABASE_URL ?? process.env.DATABASE_URL,
);
if (!process.env.ORDERS_TEST_DATABASE_URL)
  url.pathname = '/commerce_orders_validation_20261018';
if (!/^\/commerce_orders_validation_[a-zA-Z0-9_]+$/.test(url.pathname))
  throw new Error('Refusing non-isolated database');
process.env.DATABASE_URL = url.toString();
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
try {
  await app.init();
  const db = app.get(PrismaService);
  const tokens = {};
  for (const role of ['STAFF', 'ADMIN', 'SUPER_ADMIN']) {
    const token = randomUUID();
    tokens[role] = token;
    const user = await db.adminUser.create({
      data: {
        email: `orders-${randomUUID()}@test.invalid`,
        passwordHash: 'not-a-login-credential',
        role,
      },
    });
    await db.adminSession.create({
      data: {
        userId: user.id,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + 60000),
      },
    });
  }
  const http = () => request(app.getHttpServer());
  const cookie = (role) => `commerce_admin_session=${tokens[role]}`;
  const category = await db.category.create({
    data: { name: 'Orders HTTP test', slug: randomUUID() },
  });
  const product = await db.product.create({
    data: {
      name: 'HTTP snapshot',
      sku: randomUUID(),
      slug: randomUUID(),
      categoryId: category.id,
      price: '500',
      status: 'ACTIVE',
      inventory: { create: { quantity: 10 } },
    },
  });
  await http().get('/api/v1/orders').expect(401);
  await http()
    .post('/api/v1/orders')
    .set('Cookie', cookie('ADMIN'))
    .send({})
    .expect(403);
  const body = {
    customerName: 'HTTP guest',
    customerPhone: '01700000000',
    paymentMethod: 'BANK_TRANSFER',
    items: [{ productId: product.id, quantity: 1 }],
    shippingAddress: {
      recipientName: 'Guest',
      phone: '01700000000',
      line1: 'Test house',
      city: 'Dhaka',
    },
  };
  const created = await http()
    .post('/api/v1/orders')
    .set('Cookie', cookie('ADMIN'))
    .set('X-Commerce-Admin', '1')
    .set('Idempotency-Key', randomUUID())
    .send(body)
    .expect(201);
  const id = created.body.id;
  assert.ok(id, 'Order response must preserve existing unwrapped API contract');
  const mutation = (role, key = randomUUID()) =>
    http()
      .patch(`/api/v1/orders/${id}/status`)
      .set('Cookie', cookie(role))
      .set('X-Commerce-Admin', '1')
      .set('Idempotency-Key', key);
  await mutation('STAFF').send({ version: 0, status: 'CONFIRMED' }).expect(403);
  await mutation('ADMIN').send({ status: 'CONFIRMED' }).expect(400);
  await mutation('ADMIN')
    .send({ version: 0, status: 'CONFIRMED', paidTotal: 500 })
    .expect(400);
  const key = randomUUID();
  const confirmed = await mutation('ADMIN', key)
    .send({ version: 0, status: 'CONFIRMED' })
    .expect(200);
  const replay = await mutation('ADMIN', key)
    .send({ version: 0, status: 'CONFIRMED' })
    .expect(200);
  assert.equal(confirmed.body.version, 1);
  assert.deepEqual(replay.body, confirmed.body);
  await mutation('ADMIN')
    .send({ version: 0, status: 'PROCESSING' })
    .expect(409);
  await http()
    .post(`/api/v1/orders/${id}/payments`)
    .set('Cookie', cookie('ADMIN'))
    .set('X-Commerce-Admin', '1')
    .send({})
    .expect(403);
  await http()
    .post(`/api/v1/orders/${id}/payments`)
    .set('Cookie', cookie('SUPER_ADMIN'))
    .set('X-Commerce-Admin', '1')
    .set('Idempotency-Key', randomUUID())
    .send({
      version: 1,
      kind: 'MANUAL_VERIFIED',
      amount: '500.00',
      provider: 'bank',
      reference: randomUUID(),
      evidence: 'Verified completed bank statement transfer',
    })
    .expect(201);
  await http()
    .get('/api/v1/orders/export')
    .set('Cookie', cookie('STAFF'))
    .expect(403);
  const csv = await http()
    .get(`/api/v1/orders/export?q=${created.body.orderNumber}`)
    .set('Cookie', cookie('ADMIN'))
    .expect(200);
  assert.match(csv.headers['content-type'], /text\/csv/);
  assert.match(csv.text, /HTTP guest/);
  const report = await http()
    .get(`/api/v1/orders/reports?q=${created.body.orderNumber}`)
    .set('Cookie', cookie('STAFF'))
    .expect(200);
  assert.equal(report.body.paidTotal, '500.00');
  await http()
    .get(`/api/v1/orders/${id}`)
    .set('Cookie', cookie('STAFF'))
    .expect(200);
  await http()
    .post(`/api/v1/orders/${randomUUID()}/cancel`)
    .set('Cookie', cookie('ADMIN'))
    .set('X-Commerce-Admin', '1')
    .set('Idempotency-Key', randomUUID())
    .send({ version: 0 })
    .expect(404);
  await db.adminSession.updateMany({
    where: {
      tokenHash: {
        in: Object.values(tokens).map((t) =>
          createHash('sha256').update(t).digest('hex'),
        ),
      },
    },
    data: { revokedAt: new Date() },
  });
  console.log(
    'Orders HTTP smoke passed (sessions, CSRF, DTO validation, version/idempotency, RBAC, ledger, CSV, reports).',
  );
} finally {
  await app.close();
}
