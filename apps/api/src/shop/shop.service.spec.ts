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
        discount: '0.00',
        shipping: '60.00',
        paymentOption: 'COD',
        payableNow: '0.00',
        amountDueOnDelivery: '560.00',
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
        findFirst: vi.fn().mockResolvedValue({
          id: 'order-one',
          grandTotal: '560.00',
          manualPayments: [],
        }),
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
      { capture: vi.fn(), details: vi.fn().mockResolvedValue(null) } as never,
    );
    const dto = {
      items,
      paymentMethod: 'COD',
      quoteToken: signed(),
      customerName: 'Shopper',
      paymentOption: 'COD',
      shippingAddress: { city: 'Dhaka' },
    } as ShopCheckoutDto;
    vi.spyOn(service, 'quote').mockResolvedValue({
      subtotal: '500.00',
      discount: '0.00',
      shipping: '60.00',
      total: '560.00',
      payableNow: '0.00',
      amountDueOnDelivery: '560.00',
    } as never);
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
  it('rejects obsolete gateway payment plans before order creation', async () => {
    const { service, orders, dto } = fixture();
    dto.paymentMethod = 'BKASH' as never;
    dto.paymentOption = 'OPTION_B';
    await expect(
      service.checkout(dto, token, 'test-idempotency-key'),
    ).rejects.toThrow('Select an available payment plan');
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
      expect.objectContaining({
        sessionId: session.id,
        expectedSubtotal: '500.00',
        checkout: expect.objectContaining({ plan: 'COD' }),
      }),
    );
  });
  it('passes a manual submission into atomic order creation without a gateway discount', async () => {
    const { service, orders, dto } = fixture();
    dto.paymentOption = 'FULL_PAYMENT';
    dto.paymentMethodId = 'method-one';
    dto.senderInfo = '01711111111';
    dto.reference = 'TX123';
    dto.quoteToken = signed({ paymentOption: 'FULL_PAYMENT' });
    await service.checkout(dto, token, 'test-manual-checkout');
    expect(orders.create).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentMethod: 'MANUAL',
        paymentOption: 'FULL_PAYMENT',
        onlineDiscount: undefined,
      }),
      expect.any(String),
      session.id,
      expect.objectContaining({
        checkout: expect.objectContaining({
          plan: 'FULL_PAYMENT',
          paymentMethodId: 'method-one',
          senderInfo: '01711111111',
          reference: 'TX123',
        }),
      }),
    );
  });
  it('rejects changing the signed payment plan and changed server totals', async () => {
    const { service, orders, dto } = fixture();
    dto.paymentOption = 'FULL_PAYMENT';
    await expect(
      service.checkout(dto, token, 'test-manual-checkout'),
    ).rejects.toThrow('Payment plan or coupon changed');
    dto.paymentOption = 'COD';
    vi.mocked(service.quote).mockResolvedValue({
      subtotal: '501.00',
      discount: '0.00',
      shipping: '60.00',
      total: '561.00',
    } as never);
    await expect(
      service.checkout(dto, token, 'test-manual-checkout'),
    ).rejects.toThrow('Prices or delivery changed');
    vi.mocked(service.quote).mockResolvedValue({
      subtotal: '500.00',
      discount: '0.00',
      shipping: '60.00',
      total: '560.00',
      payableNow: '1.00',
      amountDueOnDelivery: '559.00',
    } as never);
    await expect(
      service.checkout(dto, token, 'test-manual-checkout'),
    ).rejects.toThrow('Prices or delivery changed');
    expect(orders.create).not.toHaveBeenCalled();
  });
});
