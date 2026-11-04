import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma } from '../generated/prisma/client.js';
import { CheckoutPaymentsService } from './checkout-payments.service.js';
import { CheckoutPaymentsController } from './checkout-payments.controller.js';
import { PaymentMethodDto } from './checkout-payments.dto.js';
import {
  ManualPaymentHandler,
  paymentHandlers,
  validMethod,
} from './manual-payment-handler.js';
import { OrdersService } from '../orders/orders.service.js';
import { defaultPlanSettings } from './plan-pricing.js';

const D = Prisma.Decimal;
const account = { accountNumber: '01700000000', accountType: 'Merchant' };
const method = {
  id: 'method-one',
  type: 'mobile_banking',
  name: 'bKash',
  details: account,
  logo: null,
  instruction: '<p>Use Payment</p>',
  isEnabled: true,
  sortOrder: 0,
  deletedAt: null,
};
function fixture(plan = 'FULL_PAYMENT') {
  const order: any = {
    id: 'order-one',
    version: 1,
    status: 'PENDING',
    paymentStatus: 'UNPAID',
    grandTotal: new D(1100),
    paidTotal: new D(0),
    refundedTotal: new D(0),
  };
  const claim: any = {
    id: 'claim-one',
    orderId: order.id,
    order,
    plan,
    paymentMethodId: method.id,
    methodSnapshot: method,
    amountDueNow: new D(plan === 'FULL_PAYMENT' ? 1100 : 100),
    amountDueOnDelivery: new D(plan === 'FULL_PAYMENT' ? 0 : 1000),
    status: 'awaiting_verification',
  };
  const tx: any = {
    manualOrderPayment: {
      findUnique: vi.fn(async () => claim),
      update: vi.fn(async ({ data }) => Object.assign(claim, data)),
      create: vi.fn(async ({ data }) => data),
    },
    order: {
      findFirst: vi.fn(async () => ({ ...order, manualPayments: [claim] })),
      update: vi.fn(async ({ data }) =>
        Object.assign(order, { ...data, version: order.version + 1 }),
      ),
    },
    orderPaymentTransaction: { create: vi.fn() },
    orderEvent: { create: vi.fn() },
    paymentMethod: {
      findMany: vi.fn().mockResolvedValue([method, { ...method, details: {} }]),
      update: vi.fn(),
      create: vi.fn(),
    },
  };
  const db: any = { ...tx, $transaction: vi.fn((fn) => fn(tx)) };
  return { service: new CheckoutPaymentsService(db), order, claim, tx, db };
}
describe('Manual payment lifecycle and account boundaries', () => {
  it.each([
    ['FULL_PAYMENT', 'PAID', '1100'],
    ['PARTIAL_ADVANCE', 'PARTIALLY_PAID', '100'],
  ])(
    'confirms %s once with reviewer attribution and ledger evidence',
    async (plan, status, paid) => {
      const { service, claim, order, tx } = fixture(plan);
      await service.review(
        claim.id,
        { action: 'confirm', version: 1 },
        'admin-one',
      );
      expect(order.paymentStatus).toBe(status);
      expect(order.paidTotal.toString()).toBe(paid);
      expect(order.status).toBe('CONFIRMED');
      expect(claim.status).toBe('confirmed');
      expect(claim.verifiedBy).toBe('admin-one');
      expect(claim.verifiedAt).toBeInstanceOf(Date);
      expect(tx.orderPaymentTransaction.create).toHaveBeenCalledTimes(1);
      await expect(
        service.review(
          claim.id,
          { action: 'confirm', version: 2 },
          'admin-one',
        ),
      ).rejects.toThrow('already been reviewed');
      expect(tx.orderPaymentTransaction.create).toHaveBeenCalledTimes(1);
    },
  );
  it('rejects with a required customer-safe reason, without credit or ledger insertion', async () => {
    const { service, claim, order, tx } = fixture();
    await expect(
      service.review(claim.id, { action: 'reject', version: 1 }, 'admin'),
    ).rejects.toThrow('reason');
    await service.review(
      claim.id,
      { action: 'reject', version: 1, reason: 'No receipt found' },
      'admin',
    );
    expect(order.paidTotal.isZero()).toBe(true);
    expect(order.paymentStatus).toBe('UNPAID');
    expect(claim.rejectReason).toBe('No receipt found');
    expect(tx.orderPaymentTransaction.create).not.toHaveBeenCalled();
  });
  it('rejects stale review versions and closed orders', async () => {
    const { service, claim, order, tx } = fixture();
    await expect(
      service.review(claim.id, { action: 'confirm', version: 0 }, 'admin'),
    ).rejects.toThrow('Order changed');
    order.status = 'CANCELLED';
    await expect(
      service.review(claim.id, { action: 'confirm', version: 1 }, 'admin'),
    ).rejects.toThrow('closed');
    expect(tx.orderPaymentTransaction.create).not.toHaveBeenCalled();
  });
  it('resubmits rejection as a new pending record with the original recipient snapshot and no credit', async () => {
    const { service, claim, order, tx } = fixture();
    claim.status = 'rejected';
    await service.resubmit(
      order.id,
      { customerId: 'owner' },
      '01711111111',
      'tx-NEW 123',
      'customer',
    );
    expect(tx.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: order.id, customerId: 'owner' } }),
    );
    expect(tx.manualOrderPayment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reference: 'TXNEW123',
        methodSnapshot: method,
        amountDueNow: claim.amountDueNow,
      }),
    });
    expect(tx.orderPaymentTransaction.create).not.toHaveBeenCalled();
    expect(order.paidTotal.isZero()).toBe(true);
  });
  it('blocks a second submission while pending and reports duplicate references clearly', async () => {
    const { service, claim, order, tx } = fixture();
    await expect(
      service.resubmit(order.id, {}, '01711111111', 'TX123', 'customer'),
    ).rejects.toThrow('Only rejected');
    claim.status = 'rejected';
    tx.manualOrderPayment.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.resubmit(order.id, {}, '01711111111', 'TX123', 'customer'),
    ).rejects.toThrow('already been submitted');
  });
  it('does not expose incomplete accounts at checkout and soft-deletes used methods', async () => {
    const { service, tx } = fixture();
    expect(await service.methods(true)).toEqual([method]);
    await service.deleteMethod(method.id);
    expect(tx.paymentMethod.update).toHaveBeenCalledWith({
      where: { id: method.id },
      data: { deletedAt: expect.any(Date), isEnabled: false },
    });
  });
  it('sanitizes account instructions and prevents gateway types at validation and handler boundaries', async () => {
    const { service, tx } = fixture();
    await service.saveMethod({
      ...method,
      type: 'mobile_banking',
      instruction: '<p>Pay here</p><script>alert(1)</script>',
    });
    expect(
      tx.paymentMethod.create.mock.calls[0][0].data.instruction,
    ).not.toContain('<script');
    const dto = plainToInstance(PaymentMethodDto, {
      ...method,
      type: 'gateway',
    });
    expect((await validate(dto)).some((e) => e.property === 'type')).toBe(true);
    expect(paymentHandlers.has('gateway')).toBe(false);
    expect(validMethod('gateway', {})).toBe(false);
    expect(Reflect.getMetadata('roles', CheckoutPaymentsController)).toEqual([
      'SUPER_ADMIN',
    ]);
  });
  it('validates account types and sender identifiers by category, and canonicalizes references', () => {
    const mobile = new ManualPaymentHandler('mobile_banking');
    expect(mobile.validate(account, '01711111111', 'tx-12 3').reference).toBe(
      'TX123',
    );
    expect(() => mobile.validate(account, 'someone', 'TX123')).toThrow(
      'sender mobile',
    );
    expect(
      validMethod('mobile_banking', { ...account, accountType: 'invalid' }),
    ).toBe(false);
    const bank = new ManualPaymentHandler('bank');
    expect(() =>
      bank.validate({ accountNumber: '123' }, 'Person', 'BANK123'),
    ).toThrow('incomplete');
  });
});

describe('Atomic checkout order and manual submission', () => {
  function checkoutFixture() {
    const tx: any = {
      $queryRaw: vi.fn().mockResolvedValue([{ count: 0n }]),
      orderIdempotencyKey: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
      },
      product: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'product',
          type: 'SIMPLE',
          currency: 'BDT',
          price: new D(1000),
          salePrice: null,
          trackInventory: false,
          sku: 'SKU',
          name: 'Product',
        }),
      },
      paymentSettings: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ ...defaultPlanSettings, codEnabled: true }),
      },
      paymentMethod: { findUnique: vi.fn().mockResolvedValue(method) },
      paymentGatewayConfig: { findUnique: vi.fn().mockResolvedValue(null) },
      orderPaymentTransaction: { create: vi.fn() },
      manualOrderPayment: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      order: {
        create: vi.fn(async ({ data }) => ({
          id: 'created-order',
          items: data.items.create.map((item: any) => ({
            ...item,
            variantId: null,
          })),
        })),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'created-order' }),
      },
      orderEvent: { create: vi.fn() },
      shopperOrderAccess: { create: vi.fn() },
    };
    const db: any = { ...tx, $transaction: vi.fn((fn) => fn(tx)) };
    const dto: any = {
      customerName: 'Customer',
      customerPhone: '01711111111',
      paymentMethod: 'MANUAL',
      paymentOption: 'FULL_PAYMENT',
      items: [{ productId: 'product', quantity: 1 }],
      shippingAddress: {
        city: 'Dhaka',
        recipientName: 'Customer',
        phone: '01711111111',
        line1: 'Address',
      },
    };
    const input: any = {
      sessionId: 'session',
      expectedSubtotal: '1000',
      checkout: {
        plan: 'FULL_PAYMENT',
        paymentMethodId: method.id,
        senderInfo: '01711111111',
        reference: 'TX123',
        expectedTotal: '1100',
        expectedNow: '1100',
      },
    };
    return { tx, db, dto, input, service: new OrdersService(db) };
  }
  it('creates an unpaid order and its pending snapshot in the same serializable transaction', async () => {
    vi.stubEnv('SHIPPING_INSIDE_DHAKA', '100');
    vi.stubEnv('SHIPPING_FREE_ABOVE', '5000');
    try {
      const { service, tx, db, dto, input } = checkoutFixture();
      await service.create(dto, 'checkout-idempotency-key', 'customer', input);
      expect(db.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ isolationLevel: 'Serializable' }),
      );
      expect(tx.order.create.mock.calls[0][0].data).toMatchObject({
        paymentPlan: 'FULL_PAYMENT',
        prepaidDiscount: new D(0),
        grandTotal: new D(1100),
      });
      expect(tx.order.create.mock.calls[0][0].data).not.toHaveProperty(
        'paidTotal',
      );
      expect(tx.manualOrderPayment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reference: 'TX123',
          amountDueNow: new D(1100),
          methodSnapshot: expect.objectContaining({
            name: 'bKash',
            details: account,
          }),
        }),
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it.each(['BKASH', 'SSLCOMMERZ'])(
    'atomically creates a %s gateway intent without a manual reference',
    async (gateway) => {
      vi.stubEnv('SHIPPING_INSIDE_DHAKA', '100');
      vi.stubEnv('SHIPPING_FREE_ABOVE', '0');
      try {
        const { service, tx, dto, input } = checkoutFixture();
        tx.paymentGatewayConfig.findUnique.mockResolvedValue({
          provider: gateway,
          isEnabled: true,
          config: {
            appKey: 'key',
            appSecret: 'secret',
            username: 'user',
            password: 'password',
            storeId: 'store',
            storePassword: 'password',
          },
        });
        dto.paymentMethod = gateway;
        dto.paymentOption = 'PARTIAL_ADVANCE';
        input.checkout = {
          plan: 'PARTIAL_ADVANCE',
          gateway,
          expectedTotal: '1100',
          expectedNow: '100',
        };
        await service.create(
          dto,
          'gateway-checkout-idempotency',
          'customer',
          input,
        );
        expect(tx.manualOrderPayment.create).not.toHaveBeenCalled();
        expect(tx.orderPaymentTransaction.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            provider: gateway,
            amount: new D(100),
            status: 'PENDING',
            metadata: { checkoutIntent: true, paymentPlan: 'PARTIAL_ADVANCE' },
          }),
        });
        expect(tx.order.create.mock.calls[0][0].data).toMatchObject({
          paymentMethod: gateway,
          paymentPlan: 'PARTIAL_ADVANCE',
        });
        tx.paymentGatewayConfig.findUnique.mockResolvedValue({
          provider: gateway,
          isEnabled: false,
          config: {},
        });
        await expect(
          service.create(dto, 'disabled-gateway-checkout', 'customer', input),
        ).rejects.toThrow('gateway is unavailable');
      } finally {
        vi.unstubAllEnvs();
      }
    },
  );
  it('blocks disabled methods and duplicate references before inserting an order', async () => {
    vi.stubEnv('SHIPPING_INSIDE_DHAKA', '100');
    vi.stubEnv('SHIPPING_FREE_ABOVE', '5000');
    try {
      const { service, tx, dto, input } = checkoutFixture();
      tx.paymentMethod.findUnique.mockResolvedValue({
        ...method,
        isEnabled: false,
      });
      await expect(
        service.create(dto, 'checkout-idempotency-key', 'customer', input),
      ).rejects.toThrow('method is unavailable');
      tx.paymentMethod.findUnique.mockResolvedValue(method);
      tx.manualOrderPayment.findUnique.mockResolvedValue({
        id: 'other-order-claim',
      });
      await expect(
        service.create(dto, 'checkout-idempotency-key', 'customer', input),
      ).rejects.toThrow('already been submitted');
      expect(tx.order.create).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it('does not request a zero-value transfer when discounts cover a free-delivery order', async () => {
    vi.stubEnv('SHIPPING_INSIDE_DHAKA', '0');
    try {
      const { service, tx, dto, input } = checkoutFixture();
      tx.paymentSettings.findUnique.mockResolvedValue({
        ...defaultPlanSettings,
        discountType: 'fixed',
        discountValue: 1000,
      });
      input.checkout = {
        plan: 'FULL_PAYMENT',
        expectedTotal: '0',
        expectedNow: '0',
      };
      await service.create(
        dto,
        'zero-order-idempotency-key',
        'customer',
        input,
      );
      expect(tx.manualOrderPayment.create).not.toHaveBeenCalled();
      expect(tx.order.create.mock.calls[0][0].data).toMatchObject({
        paymentStatus: 'PAID',
        grandTotal: new D(0),
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it('creates COD without a manual payment and rejects attempts to attach a transfer to COD', async () => {
    vi.stubEnv('SHIPPING_INSIDE_DHAKA', '100');
    vi.stubEnv('SHIPPING_FREE_ABOVE', '5000');
    try {
      const { service, tx, dto, input } = checkoutFixture();
      dto.paymentMethod = 'COD';
      input.checkout = { plan: 'COD', expectedTotal: '1100', expectedNow: '0' };
      await service.create(dto, 'checkout-idempotency-key', 'customer', input);
      expect(tx.manualOrderPayment.create).not.toHaveBeenCalled();
      input.checkout.reference = 'TX123';
      await expect(
        service.create(
          dto,
          'checkout-other-idempotency-key',
          'customer',
          input,
        ),
      ).rejects.toThrow('does not need');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
