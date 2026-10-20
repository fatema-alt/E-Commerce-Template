import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';

const url = process.env.DASHBOARD_TEST_DATABASE_URL;
if (
  !url ||
  !/^\/commerce_dashboard_validation_[a-zA-Z0-9_]+$/.test(new URL(url).pathname)
)
  throw new Error(
    'Set DASHBOARD_TEST_DATABASE_URL to a migrated, isolated commerce_dashboard_validation_* database.',
  );
process.env.DATABASE_URL = url;
process.env.CMS_SCHEDULER_ENABLED = 'false';
process.env.STOREFRONT_CHECKOUT_SECRET = randomUUID();
const { AppModule } = await import('../dist/app.module.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');
const { DashboardService, dashboardWindow } =
  await import('../dist/dashboard/dashboard.service.js');
const app = await NestFactory.create(AppModule, { logger: false });
app.setGlobalPrefix('api/v1');
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
const db = app.get(PrismaService);
const dashboard = app.get(DashboardService);
const suffix = randomUUID();
try {
  await app.listen(0, '127.0.0.1');
  const api = (await app.getUrl()) + '/api/v1';
  const boundary = dashboardWindow(new Date('2026-10-31T18:00:00Z'));
  assert.equal(boundary.month, '2026-11');
  assert.equal(boundary.start.toISOString(), '2026-10-31T18:00:00.000Z');
  assert.equal(boundary.days.length, 7);
  const baseline = await dashboard.overview();
  assert.equal(baseline.revenue.length, 7);
  assert.ok(
    baseline.revenue.every((bucket) => typeof bucket.revenue === 'string'),
  );
  const customer = await db.customer.create({
    data: { firstName: 'Dashboard test', email: suffix + '@example.test' },
  });
  const category = await db.category.create({
    data: { name: 'Dashboard ' + suffix, slug: suffix },
  });
  const product = await db.product.create({
    data: {
      name: 'Dashboard test',
      slug: suffix,
      sku: suffix,
      categoryId: category.id,
      price: '100',
      inventory: { create: { quantity: 9, reserved: 2 } },
    },
  });
  async function order(currency, status, total) {
    return db.order.create({
      data: {
        orderNumber: randomUUID(),
        customerId: customer.id,
        customerName: 'Test',
        customerPhone: '01700000000',
        paymentMethod: 'COD',
        status,
        currency,
        subtotal: total,
        grandTotal: total,
        items: {
          create: {
            productId: product.id,
            skuSnapshot: product.sku,
            nameSnapshot: product.name,
            quantity: 1,
            unitPrice: total,
            lineTotal: total,
          },
        },
      },
    });
  }
  const paid = await order('BDT', 'CONFIRMED', '100.00');
  await order('BDT', 'CANCELLED', '999.00');
  await order('USD', 'CONFIRMED', '500.00');
  await db.orderPaymentTransaction.create({
    data: {
      orderId: paid.id,
      type: 'REFUND',
      status: 'SUCCEEDED',
      provider: 'dashboard-test',
      idempotencyKey: randomUUID(),
      amount: '20.00',
    },
  });
  const sessionId = randomUUID(),
    id = randomUUID();
  await dashboard.track({
    id,
    sessionId,
    kind: 'PRODUCT_VIEW',
    source: 'organic',
  });
  await dashboard.track({
    id,
    sessionId,
    kind: 'PRODUCT_VIEW',
    source: 'direct',
  });
  await dashboard.track({
    id: randomUUID(),
    sessionId,
    kind: 'PRODUCT_VIEW',
    source: 'direct',
  });
  await dashboard.track({
    id: randomUUID(),
    sessionId,
    kind: 'ADD_TO_CART',
    source: 'direct',
  });
  const data = await dashboard.overview();
  assert.equal(
    Number(data.totals.sales) - Number(baseline.totals.sales),
    80,
    'Exclude cancelled orders and other currencies; subtract successful refunds',
  );
  assert.equal(data.totals.orders - baseline.totals.orders, 3);
  assert.equal(
    data.totals.inventory - baseline.totals.inventory,
    9,
    'Count on-hand units rather than available units',
  );
  assert.equal(data.totals.customers - baseline.totals.customers, 1);
  assert.equal(data.funnel.purchases - baseline.funnel.purchases, 1);
  assert.equal(
    data.funnel.productViews - baseline.funnel.productViews,
    1,
    'Funnel counts unique sessions, not repeated events',
  );
  assert.equal(
    await db.analyticsEvent.count({ where: { id } }),
    1,
    'Retry event IDs are idempotent',
  );
  assert.equal(
    (await db.analyticsSession.findUnique({ where: { id: sessionId } })).source,
    'organic',
    'First-touch attribution is retained',
  );
  assert.equal(
    Number(data.categories.find((c) => c.name === category.name).amount),
    80,
  );
  const cookies = {};
  for (const role of ['ADMIN', 'STAFF']) {
    const token = randomUUID();
    await db.adminUser.create({
      data: {
        email: role + suffix + '@example.test',
        passwordHash: 'unused',
        role,
        sessions: {
          create: {
            tokenHash: createHash('sha256').update(token).digest('hex'),
            expiresAt: new Date(Date.now() + 3600000),
          },
        },
      },
    });
    cookies[role] = 'commerce_admin_session=' + token;
  }
  assert.equal((await fetch(api + '/dashboard')).status, 401);
  assert.equal(
    (await fetch(api + '/dashboard', { headers: { Cookie: cookies.STAFF } }))
      .status,
    200,
  );
  const setTarget = (cookie, amount) =>
    fetch(api + '/dashboard/target', {
      method: 'PATCH',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
        'X-Commerce-Admin': '1',
      },
      body: JSON.stringify({ amount }),
    });
  assert.equal((await setTarget(cookies.STAFF, '1000')).status, 403);
  assert.equal((await setTarget(cookies.ADMIN, '-1')).status, 400);
  assert.equal((await setTarget(cookies.ADMIN, '1000.50')).status, 200);
  assert.equal((await dashboard.overview()).target.amount, '1000.50');
  const tracking = (token) =>
    fetch(api + '/shop/analytics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Commerce-Admin': '1',
        'X-Commerce-Tracking': token,
      },
      body: JSON.stringify({
        id: randomUUID(),
        sessionId: randomUUID(),
        kind: 'PAGE_VIEW',
        source: 'direct',
      }),
    });
  assert.equal((await tracking('wrong')).status, 403);
  assert.equal(
    (await tracking(process.env.STOREFRONT_CHECKOUT_SECRET)).status,
    201,
  );
  console.log(
    'PASS: Dhaka boundaries, seven-day buckets, currency-safe/refund-aware totals, inventory, categories, unique sessions, first-touch attribution, idempotency, authentication, target validation and role permissions.',
  );
} finally {
  await app.close();
}
