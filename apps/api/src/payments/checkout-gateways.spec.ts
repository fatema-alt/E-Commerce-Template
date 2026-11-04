import { afterEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { CheckoutPaymentsService } from './checkout-payments.service.js';
import { PaymentsService } from './payments.service.js';
import { OnlinePaymentMethod } from './payments.dto.js';
import { ShopController } from '../shop/shop.controller.js';

const config = {
  appKey: 'merchant-key',
  appSecret: 'merchant-secret',
  username: 'merchant',
  password: 'merchant-password',
};
const row = { provider: 'BKASH', isEnabled: true, isSandbox: true, config };
const D = Prisma.Decimal;
afterEach(() => vi.unstubAllEnvs());

function fixture(plan = 'PARTIAL_ADVANCE') {
  const intent = {
    id: 'intent',
    provider: 'BKASH',
    status: 'PENDING',
    providerReference: null,
    amount: new D(plan === 'FULL_PAYMENT' ? 1100 : 100),
    metadata: { checkoutIntent: true },
  };
  const order = {
    id: 'order',
    orderNumber: 'ORD-1',
    paymentPlan: plan,
    paymentOption: plan,
    paymentMethod: 'BKASH',
    paymentStatus: 'UNPAID',
    status: 'PENDING',
    grandTotal: new D(1100),
    paidTotal: new D(0),
    refundedTotal: new D(0),
    currency: 'BDT',
    customerName: 'Customer',
    customerPhone: '01700000000',
    payments: [intent],
  };
  const db = {
    $executeRaw: vi.fn(),
    paymentGatewayConfig: {
      findMany: vi.fn().mockResolvedValue([row]),
      findUnique: vi.fn().mockResolvedValue(row),
      upsert: vi.fn(),
    },
    order: { findUnique: vi.fn().mockResolvedValue(order), update: vi.fn() },
    orderPaymentTransaction: { update: vi.fn(), create: vi.fn() },
  };
  const adapter = {
    setConfig: vi.fn(),
    isEnabled: vi.fn().mockReturnValue(true),
    initiatePayment: vi.fn().mockResolvedValue({
      redirectUrl: 'https://gateway.example/pay',
      transactionReference: 'gateway-reference',
      metadata: {},
    }),
  };
  const service = new PaymentsService(
    { ...db, $transaction: vi.fn(async (work) => work(db)) } as never,
    adapter as never,
    adapter as never,
  );
  return { service, db, adapter, order, intent };
}

describe('Admin-controlled checkout gateways', () => {
  it('exposes only explicitly enabled, configured gateways without credentials', async () => {
    vi.stubEnv('SSLCOMMERZ_STORE_ID', undefined);
    vi.stubEnv('SSLCOMMERZ_STORE_PASSWORD', undefined);
    const db = {
      paymentSettings: { findUnique: vi.fn().mockResolvedValue(null) },
      paymentMethod: { findMany: vi.fn().mockResolvedValue([]) },
      paymentGatewayConfig: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            row,
            { ...row, provider: 'SSLCOMMERZ', config: {} },
            { ...row, isEnabled: false },
          ]),
      },
    };
    const service = new CheckoutPaymentsService(db as never);
    const result = await service.publicConfig();
    expect(result.gateways).toEqual([{ id: 'BKASH', name: 'bKash' }]);
    expect(JSON.stringify(result)).not.toContain('merchant-secret');
    db.paymentGatewayConfig.findMany.mockResolvedValue([
      { ...row, isEnabled: false },
    ]);
    expect((await service.publicConfig()).gateways).toEqual([]);
  });

  it('refuses enabling incomplete credentials but allows saving a disabled draft', async () => {
    vi.stubEnv('BKASH_APP_SECRET', undefined);
    const { service, db } = fixture();
    db.paymentGatewayConfig.findUnique.mockResolvedValue(null as never);
    await expect(
      service.updateAdminSetting('BKASH', {
        isEnabled: true,
        config: { appKey: 'key' },
      }),
    ).rejects.toThrow('Complete the gateway API credentials');
    expect(db.paymentGatewayConfig.upsert).not.toHaveBeenCalled();
    db.paymentGatewayConfig.upsert.mockResolvedValue({
      provider: 'BKASH',
      isEnabled: false,
      isSandbox: true,
    });
    await service.updateAdminSetting('BKASH', {
      isEnabled: false,
      config: { appKey: 'key' },
    });
    expect(db.paymentGatewayConfig.upsert).toHaveBeenCalled();
  });

  it('preserves stored secrets when an admin leaves password fields blank', async () => {
    const { service, db } = fixture();
    db.paymentGatewayConfig.upsert.mockResolvedValue(row);
    await service.updateAdminSetting('BKASH', {
      isEnabled: true,
      config: { appSecret: '', password: '' },
    });
    expect(db.paymentGatewayConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ config }) }),
    );
  });

  it.each(['FULL_PAYMENT', 'PARTIAL_ADVANCE'])(
    'initiates %s using the persisted server amount',
    async (plan) => {
      const { service, db, adapter, intent } = fixture(plan);
      await service.initiate(
        'order',
        OnlinePaymentMethod.BKASH,
        'https://store.example',
        undefined,
        true,
      );
      expect(adapter.initiatePayment).toHaveBeenCalledWith(
        expect.objectContaining({ amount: Number(intent.amount) }),
      );
      expect(db.orderPaymentTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: intent.id },
          data: expect.objectContaining({
            amount: intent.amount,
            metadata: expect.objectContaining({ checkoutIntent: true }),
          }),
        }),
      );
      expect(db.orderPaymentTransaction.create).not.toHaveBeenCalled();
    },
  );

  it('rejects disabled gateways, manual orders and caller-supplied plan changes', async () => {
    const { service, db, order } = fixture();
    db.paymentGatewayConfig.findUnique.mockResolvedValue({
      ...row,
      isEnabled: false,
    });
    await expect(
      service.initiate(
        'order',
        OnlinePaymentMethod.BKASH,
        undefined,
        undefined,
        true,
      ),
    ).rejects.toThrow('unavailable');
    db.paymentGatewayConfig.findUnique.mockResolvedValue(row);
    await expect(
      service.initiate(
        'order',
        OnlinePaymentMethod.BKASH,
        undefined,
        'FULL_PAYMENT',
        true,
      ),
    ).rejects.toThrow('unavailable');
    order.payments = [];
    await expect(
      service.initiate(
        'order',
        OnlinePaymentMethod.BKASH,
        undefined,
        undefined,
        true,
      ),
    ).rejects.toThrow('unavailable');
  });

  it('requires the shopper-authorized endpoint and reuses a pending redirect', async () => {
    const { service, adapter, intent } = fixture();
    await expect(
      service.initiate('order', OnlinePaymentMethod.BKASH),
    ).rejects.toThrow('authenticated storefront');
    Object.assign(intent, {
      providerReference: 'gateway-reference',
      metadata: {
        checkoutIntent: true,
        initiateUrl: 'https://gateway.example/existing',
      },
    });
    const result = await service.initiate(
      'order',
      OnlinePaymentMethod.BKASH,
      undefined,
      undefined,
      true,
    );
    expect(result.redirectUrl).toBe('https://gateway.example/existing');
    expect(adapter.initiatePayment).not.toHaveBeenCalled();
  });

  it('checks shopper ownership before starting a gateway payment', async () => {
    const shop = {
      order: vi.fn().mockRejectedValue(new Error('Order not found')),
      throttle: vi.fn(),
    };
    const payments = { initiate: vi.fn() };
    const controller = new ShopController(shop as never, payments as never);
    await expect(
      controller.gatewayPayment(
        'other-order',
        { headers: {}, get: () => 'https://store.example' } as never,
        { gateway: 'BKASH' },
      ),
    ).rejects.toThrow('Order not found');
    expect(payments.initiate).not.toHaveBeenCalled();
  });
});

describe('Verified checkout gateway results', () => {
  function callbackFixture(provider = 'BKASH', plan = 'PARTIAL_ADVANCE') {
    const intent: any = {
      id: 'intent',
      provider,
      status: 'PENDING',
      providerReference: 'gateway-ref',
      amount: new D(plan === 'FULL_PAYMENT' ? 1100 : 100),
      metadata: { checkoutIntent: true },
    };
    const order: any = {
      id: 'order',
      orderNumber: 'ORD-1',
      paymentPlan: plan,
      paymentOption: plan,
      paymentMethod: provider,
      paymentStatus: 'UNPAID',
      status: 'PENDING',
      grandTotal: new D(1100),
      paidTotal: new D(0),
      refundedTotal: new D(0),
      currency: 'BDT',
      payments: [intent],
    };
    const verification = {
      success: true,
      transactionReference: 'gateway-ref',
      amount: Number(intent.amount),
      currency: 'BDT',
    };
    const db: any = {
      $executeRaw: vi.fn(),
      order: {
        findFirst: vi.fn().mockResolvedValue(order),
        findUniqueOrThrow: vi.fn().mockResolvedValue(order),
        update: vi.fn().mockImplementation(async ({ data }) => {
          if (data.paidTotal)
            order.paidTotal = order.paidTotal.plus(data.paidTotal.increment);
          else Object.assign(order, data);
          return order;
        }),
      },
      orderPaymentTransaction: {
        findFirst: vi.fn().mockResolvedValue(intent),
        update: vi
          .fn()
          .mockImplementation(async ({ data }) => Object.assign(intent, data)),
        create: vi.fn(),
      },
      orderEvent: { create: vi.fn() },
    };
    db.$transaction = vi.fn((fn) => fn(db));
    const adapter = { verifyPayment: vi.fn().mockResolvedValue(verification) };
    return {
      service: new PaymentsService(db, adapter as never, adapter as never),
      db,
      order,
      intent,
      verification,
    };
  }

  it.each(['BKASH', 'SSLCOMMERZ'] as const)(
    'credits a verified %s advance once and leaves the remainder for COD',
    async (provider) => {
      const { service, db, order } = callbackFixture(provider);
      await service.processCallback(provider, { orderId: 'order' }, {});
      expect(order.paidTotal.toFixed(2)).toBe('100.00');
      expect(order.paymentStatus).toBe('PARTIALLY_PAID');
      expect(order.paymentMethod).toBe('COD');
      expect(order.status).toBe('CONFIRMED');
      await service.processCallback(provider, { orderId: 'order' }, {});
      expect(order.paidTotal.toFixed(2)).toBe('100.00');
      expect(db.orderPaymentTransaction.create).not.toHaveBeenCalled();
    },
  );

  it('handles SSLCommerz IPN followed by a browser callback without double credit', async () => {
    const { service, order } = callbackFixture('SSLCOMMERZ');
    await service.processIpn('SSLCOMMERZ', {
      tran_id: 'ORD-1',
      val_id: 'validation-ref',
    });
    expect(order.paidTotal.toFixed(2)).toBe('100.00');
    expect(order.paymentMethod).toBe('COD');
    await service.processCallback('SSLCOMMERZ', { orderId: 'order' }, {});
    expect(order.paidTotal.toFixed(2)).toBe('100.00');
  });

  it('marks full payment PAID after verification', async () => {
    const { service, order } = callbackFixture('BKASH', 'FULL_PAYMENT');
    await service.processCallback('BKASH', { orderId: 'order' }, {});
    expect(order.paymentStatus).toBe('PAID');
    expect(order.paidTotal.toFixed(2)).toBe('1100.00');
  });

  it('does not credit an incorrect amount or an unknown provider reference', async () => {
    const { service, db, order, verification } = callbackFixture();
    verification.amount = 1100;
    const result = await service.processCallback(
      'BKASH',
      { orderId: 'order' },
      {},
    );
    expect(result.redirectUrl).toContain('Amount+mismatch');
    expect(order.paidTotal.isZero()).toBe(true);
    db.orderPaymentTransaction.findFirst.mockResolvedValue(null);
    await expect(
      service.processCallback('BKASH', { orderId: 'order' }, {}),
    ).rejects.toThrow('No matching');
    expect(order.paidTotal.isZero()).toBe(true);
  });
});
