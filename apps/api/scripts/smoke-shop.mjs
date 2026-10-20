import 'dotenv/config';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
const target = process.env.SHOP_TEST_DATABASE_URL;
if (
  !target ||
  !new URL(target).pathname.startsWith('/commerce_cms_validation_')
)
  throw new Error(
    'Use an isolated commerce_cms_validation_ database for SHOP_TEST_DATABASE_URL',
  );
process.env.DATABASE_URL = target;
process.env.CMS_SCHEDULER_ENABLED = 'false';
const { AppModule } = await import('../dist/app.module.js');
const { PrismaService } = await import('../dist/prisma/prisma.service.js');
const app = await NestFactory.create(AppModule, { logger: false });
app.setGlobalPrefix('api/v1');
app.useGlobalPipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
);
let checks = 0;
try {
  await app.listen(0, '127.0.0.1');
  const api = (await app.getUrl()) + '/api/v1';
  const db = app.get(PrismaService);
  const suffix = randomUUID();
  const category = await db.category.create({
    data: { name: 'Shopping test', slug: 'shop-' + suffix },
  });
  const product = await db.product.create({
    data: {
      name: 'Test item',
      slug: 'item-' + suffix,
      sku: 'item-' + suffix,
      categoryId: category.id,
      price: 100,
      salePrice: 80,
      status: 'ACTIVE',
      inventory: { create: { quantity: 20 } },
    },
  });
  const hidden = await db.product.create({
    data: {
      name: 'Hidden',
      slug: 'hidden-' + suffix,
      sku: 'hidden-' + suffix,
      categoryId: category.id,
      price: 100,
      status: 'ACTIVE',
      isVisible: false,
    },
  });
  const send = (path, body, cookie, key) =>
    fetch(api + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Commerce-Admin': '1',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(key ? { 'Idempotency-Key': key } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const status = async (request, expected) => {
    const response = await request;
    assert.equal(response.status, expected, await response.clone().text());
    checks++;
    return response;
  };
  const check = (condition, message) => {
    assert.ok(condition, message);
    checks++;
  };
  const cookie = (response) =>
    response.headers
      .getSetCookie()
      .find((value) => value.startsWith('commerce_shopper='))
      ?.split(';')[0];
  await status(send('/shop/orders'), 401);
  await status(
    send('/shop/quote', { items: [{ productId: hidden.id, quantity: 1 }] }),
    400,
  );
  const items = [{ productId: product.id, quantity: 2 }];
  const quoteResponse = await status(send('/shop/quote', { items }), 201);
  const guest = cookie(quoteResponse);
  check(
    !!guest && quoteResponse.headers.get('set-cookie').includes('HttpOnly'),
    'Secure anonymous browser session',
  );
  const quote = await quoteResponse.json();
  check(quote.total === '160.00', 'Server computes active sale price');
  const payload = {
    items,
    quoteToken: quote.quoteToken,
    customerName: 'Test Shopper',
    customerPhone: '01712345678',
    shippingAddress: {
      recipientName: 'Test Shopper',
      phone: '01712345678',
      line1: '123 Test Street',
      city: 'Dhaka',
    },
    paymentMethod: 'COD',
  };
  await status(
    send(
      '/shop/orders',
      { ...payload, customerId: randomUUID() },
      guest,
      randomUUID(),
    ),
    400,
  );
  await status(
    send('/shop/orders', { ...payload, grandTotal: 1 }, guest, randomUUID()),
    400,
  );
  await status(
    send(
      '/shop/orders',
      { ...payload, paymentMethod: 'ONLINE' },
      guest,
      randomUUID(),
    ),
    400,
  );
  await status(
    send(
      '/shop/orders',
      { ...payload, paymentMethod: 'BANK_TRANSFER' },
      guest,
      randomUUID(),
    ),
    400,
  );
  await status(
    send(
      '/shop/orders',
      { ...payload, quoteToken: quote.quoteToken + '00' },
      guest,
      randomUUID(),
    ),
    400,
  );
  const key = randomUUID();
  const order = await (
    await status(send('/shop/orders', payload, guest, key), 201)
  ).json();
  check(
    order.grandTotal === '160' || order.grandTotal === '160.00',
    'Charged server total',
  );
  check(
    order.paymentStatus === 'UNPAID' && order.paymentMethod === 'COD',
    'COD is not falsely marked paid',
  );
  check(
    !('notes' in order) && !('events' in order),
    'No internal records in customer response',
  );
  const retry = await (
    await status(send('/shop/orders', payload, guest, key), 201)
  ).json();
  check(retry.id === order.id, 'Retry must not create a duplicate order');
  const reserved = await db.inventory.findUnique({
    where: { productId: product.id },
  });
  check(reserved.reserved === 2, 'Inventory reserved once');
  await status(send('/shop/orders/' + order.id, undefined, guest), 200);
  const otherQuote = await status(send('/shop/quote', { items }), 201);
  const stranger = cookie(otherQuote);
  await status(send('/shop/orders/' + order.id, undefined, stranger), 404);
  await status(send('/shop/orders', payload, stranger, randomUUID()), 409);
  const fresh = await (
    await status(send('/shop/quote', { items }, guest), 201)
  ).json();
  await db.product.update({
    where: { id: product.id },
    data: { price: 200, salePrice: null },
  });
  await status(
    send(
      '/shop/orders',
      { ...payload, quoteToken: fresh.quoteToken },
      guest,
      randomUUID(),
    ),
    409,
  );
  check(
    (await db.inventory.findUnique({ where: { productId: product.id } }))
      .reserved === 2,
    'Stale price failure rolls back reservations',
  );
  await db.category.update({
    where: { id: category.id },
    data: { isVisible: false },
  });
  await status(send('/shop/quote', { items }, guest), 400);
  await db.category.update({
    where: { id: category.id },
    data: { isVisible: true },
  });
  const email = `shop-${suffix}@example.test`;
  const password = 'secure-test-password-' + suffix;
  const registration = await status(
    send('/shop/register', { name: 'Registered Shopper', email, password }),
    201,
  );
  const member = cookie(registration);
  const registrationBody = await registration.json();
  check(
    registrationBody.user.email === email &&
      !('passwordHash' in registrationBody.user),
    'Customer registration projection',
  );
  await status(send('/orders', undefined, member), 401);
  await status(
    send('/shop/login', { email, password: password + 'incorrect' }),
    401,
  );
  const loggedIn = await status(send('/shop/login', { email, password }), 201);
  const signedIn = cookie(loggedIn);
  check((await loggedIn.json()).user.email === email, 'Customer login');
  const accountQuote = await (
    await status(send('/shop/quote', { items }, signedIn), 201)
  ).json();
  const accountOrder = await (
    await status(
      send(
        '/shop/orders',
        { ...payload, quoteToken: accountQuote.quoteToken },
        signedIn,
        randomUUID(),
      ),
      201,
    )
  ).json();
  const list = await (
    await status(send('/shop/orders', undefined, signedIn), 200)
  ).json();
  check(
    list.items.some((item) => item.id === accountOrder.id),
    'Own account order history',
  );
  await status(
    send(
      '/shop/password',
      { currentPassword: password, newPassword: password + 'new' },
      signedIn,
    ),
    201,
  );
  check(
    (await (await send('/shop/me', undefined, member)).json()).user === null,
    'Password change revokes other sessions',
  );
  await status(send('/shop/newsletter', { email, consent: false }), 400);
  await status(
    send('/shop/newsletter', { email: email.toUpperCase(), consent: true }),
    201,
  );
  await status(send('/shop/newsletter', { email, consent: true }), 201);
  check(
    (await db.newsletterSubscription.count({ where: { email } })) === 1,
    'Normalized idempotent signup',
  );
  await status(
    send('/shop/newsletter/preferences', { consent: false }, signedIn),
    201,
  );
  check(
    (await (await send('/shop/newsletter', undefined, signedIn)).json())
      .subscribed === false,
    'Authenticated unsubscribe',
  );
  await status(
    send('/shop/newsletter/preferences', { consent: true }, signedIn),
    201,
  );
  check(
    (await (await send('/shop/newsletter', undefined, signedIn)).json())
      .subscribed === true,
    'Authenticated resubscribe',
  );
  await status(
    send('/shop/newsletter/preferences', { consent: true }, guest),
    401,
  );
  const lastItem = await db.product.create({
    data: {
      name: 'Last stock item',
      slug: 'last-' + suffix,
      sku: 'last-' + suffix,
      categoryId: category.id,
      price: 50,
      status: 'ACTIVE',
      inventory: { create: { quantity: 1 } },
    },
  });
  const lastLines = [{ productId: lastItem.id, quantity: 1 }];
  const quoteA = await (
    await send('/shop/quote', { items: lastLines }, guest)
  ).json();
  const quoteB = await (
    await send('/shop/quote', { items: lastLines }, stranger)
  ).json();
  const race = await Promise.all([
    send(
      '/shop/orders',
      { ...payload, items: lastLines, quoteToken: quoteA.quoteToken },
      guest,
      randomUUID(),
    ),
    send(
      '/shop/orders',
      { ...payload, items: lastLines, quoteToken: quoteB.quoteToken },
      stranger,
      randomUUID(),
    ),
  ]);
  check(
    race.filter((response) => response.status === 201).length === 1 &&
      race.filter((response) => response.status === 409).length === 1,
    'Only one shopper can buy the last available item',
  );
  check(
    (await db.inventory.findUnique({ where: { productId: lastItem.id } }))
      .reserved === 1,
    'Concurrent checkout cannot over-reserve',
  );
  process.env.BANK_NAME = 'Fixture Bank';
  process.env.BANK_ACCOUNT_NAME = 'Fixture Store';
  process.env.BANK_ACCOUNT_NUMBER = 'TEST-ONLY';
  const bankQuote = await (
    await send('/shop/quote', { items }, signedIn)
  ).json();
  const bankOrder = await (
    await status(
      send(
        '/shop/orders',
        {
          ...payload,
          quoteToken: bankQuote.quoteToken,
          paymentMethod: 'BANK_TRANSFER',
        },
        signedIn,
        randomUUID(),
      ),
      201,
    )
  ).json();
  check(
    bankOrder.paymentStatus === 'UNPAID' &&
      bankOrder.paymentMethod === 'BANK_TRANSFER',
    'Bank transfers require manual confirmation',
  );
  await status(send('/shop/logout', {}, signedIn), 201);
  await status(send('/shop/orders', undefined, signedIn), 401);
  console.log(`Storefront shopping HTTP checks passed: ${checks}`);
} finally {
  await app.close();
}
