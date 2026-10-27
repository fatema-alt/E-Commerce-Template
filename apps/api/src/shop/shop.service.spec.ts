import { createHmac } from 'node:crypto';
import { ShopService } from './shop.service.js';
import type { ShopCheckoutDto } from './shop.dto.js';

describe('Storefront order access and checkout boundaries', () => {
  const token = 'a'.repeat(64);
  const session = {
    id: 'session-one',
    customerId: null,
    expiresAt: new Date(Date.now() + 60000),
  };
  const secret = 'isolated-checkout-test-secret-32-characters';
  const items = [{ productId: 'product-one', quantity: 1 }];
  let originalSecret: string | undefined;
  beforeEach(() => {
    originalSecret = process.env.STOREFRONT_CHECKOUT_SECRET;
    process.env.STOREFRONT_CHECKOUT_SECRET = secret;
  });
  afterEach(() => {
    if (originalSecret === undefined)
      delete process.env.STOREFRONT_CHECKOUT_SECRET;
    else process.env.STOREFRONT_CHECKOUT_SECRET = originalSecret;
  });
  function signed(overrides: Record<string, unknown> = {}) {
    const payload = Buffer.from(
      JSON.stringify({
        sessionId: session.id,
        items,
        subtotal: '500.00',
        expires: Date.now() + 60000,
        ...overrides,
      }),
    ).toString('base64url');
    return (
      payload + '.' + createHmac('sha256', secret).update(payload).digest('hex')
    );
  }
  function fixture() {
    const db = {
      shopperSession: { findUnique: vi.fn().mockResolvedValue(session) },
      order: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: 'order-one', grandTotal: '560.00' }),
      },
    };
    const orders = { create: vi.fn().mockResolvedValue({ id: 'order-one' }) };
    const payments = {
      getMethods: vi.fn().mockResolvedValue({
        methods: [
          { id: 'COD', enabled: true },
          { id: 'BKASH', enabled: false },
        ],
        bank: null,
      }),
    };
    const service = new ShopService(
      db as never,
      orders as never,
      payments as never,
      {} as never,
    );
    const dto = {
      items,
      paymentMethod: 'COD',
      quoteToken: signed(),
      customerName: 'Shopper',
    } as ShopCheckoutDto;
    return { db, orders, payments, service, dto };
  }
  it('rejects order reads without a valid shopper session before querying orders', async () => {
    const { service, db } = fixture();
    await expect(service.order('private-order')).rejects.toThrow();
    expect(db.order.findFirst).not.toHaveBeenCalled();
  });
  it('scopes guest order reads to browser session access and keeps snapshot selections', async () => {
    const { service, db } = fixture();
    await service.order('order-one', token);
    expect(db.order.findFirst.mock.calls[0]?.[0]).toMatchObject({
      where: {
        id: 'order-one',
        OR: [{ shopperAccess: { sessionId: session.id } }],
      },
      select: {
        subtotal: true,
        customerPhone: true,
        items: {
          select: { unitPrice: true, lineTotal: true, variantSnapshot: true },
        },
      },
    });
  });
  it('scopes signed-in order reads to the customer or current browser session', async () => {
    const { service, db } = fixture();
    db.shopperSession.findUnique.mockResolvedValue({
      ...session,
      customerId: 'customer-one',
    } as never);
    await service.order('order-one', token);
    expect(db.order.findFirst.mock.calls[0]?.[0].where.OR).toEqual([
      { shopperAccess: { sessionId: session.id } },
      { customerId: 'customer-one' },
    ]);
  });
  it('returns not found for an order outside the shopper scope', async () => {
    const { service, db } = fixture();
    db.order.findFirst.mockResolvedValue(null as never);
    await expect(
      service.order('another-customer-order', token),
    ).rejects.toThrow('Order not found');
  });
  it('rejects a disabled gateway before order creation', async () => {
    const { service, orders, dto } = fixture();
    dto.paymentMethod = 'BKASH';
    await expect(
      service.checkout(dto, token, 'test-idempotency-key'),
    ).rejects.toThrow('currently unavailable');
    expect(orders.create).not.toHaveBeenCalled();
  });
  it.each([
    { expires: 1 },
    { sessionId: 'another-session' },
    { items: [{ productId: 'product-one', quantity: 99 }] },
  ])('rejects expired or mismatched signed quotes %j', async (override) => {
    const { service, orders, dto } = fixture();
    dto.quoteToken = signed(override);
    await expect(
      service.checkout(dto, token, 'test-idempotency-key'),
    ).rejects.toThrow('cart changed or quote expired');
    expect(orders.create).not.toHaveBeenCalled();
  });
  it('rejects tampered quote signatures', async () => {
    const { service, orders, dto } = fixture();
    dto.quoteToken += '00';
    await expect(
      service.checkout(dto, token, 'test-idempotency-key'),
    ).rejects.toThrow('Invalid checkout quote');
    expect(orders.create).not.toHaveBeenCalled();
  });
  it('passes the scoped idempotency key and signed subtotal to server order creation', async () => {
    const { service, orders, dto } = fixture();
    await service.checkout(dto, token, 'test-idempotency-key');
    expect(orders.create).toHaveBeenCalledWith(
      expect.objectContaining({ items, paymentMethod: 'COD' }),
      'shop:session-one:test-idempotency-key',
      session.id,
      { sessionId: session.id, expectedSubtotal: '500.00' },
    );
  });
});
