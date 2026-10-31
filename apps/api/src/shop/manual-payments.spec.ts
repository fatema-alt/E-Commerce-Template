import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ManualPaymentsService } from './manual-payments.service.js';
import { ManualPaymentSubmissionDto, ShopCheckoutDto } from './shop.dto.js';
import { manualTransfer } from '../payments/manual-payment.config.js';
import { PaymentsService } from '../payments/payments.service.js';
import { OrderOperationsService } from '../orders/order-operations.service.js';
import { OrdersController } from '../orders/orders.controller.js';
import { AdminPaymentsController } from '../payments/admin-payments.controller.js';
import { Prisma } from '../generated/prisma/client.js';

const account = {
  accountName: 'Test recipient',
  accountNumber: '01700000000',
  accountType: 'personal',
  instructions: 'Check recipient before sending.',
};
const orderId = '00000000-0000-4000-8000-000000000001';
const claim = {
  id: 'claim-1',
  orderId,
  provider: 'manual_bkash',
  providerReference: 'TX123',
  status: 'PENDING',
  amount: new Prisma.Decimal(110),
  metadata: { verification: 'CUSTOMER_CLAIM_PENDING', sender: '01711111111' },
};
const order = {
  id: orderId,
  paymentOption: 'MANUAL_BKASH',
  paymentMethod: 'MANUAL',
  status: 'PENDING',
  paymentStatus: 'UNPAID',
  grandTotal: new Prisma.Decimal(110),
  paidTotal: new Prisma.Decimal(0),
  shippingTotal: new Prisma.Decimal(10),
  refundedTotal: new Prisma.Decimal(0),
  currency: 'BDT',
  shipments: [],
  payments: [claim],
};
function fixture() {
  const tx: any = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    order: {
      findFirst: vi.fn().mockResolvedValue(order),
      update: vi.fn().mockResolvedValue(order),
    },
    orderEvent: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ after: { ...account, id: 'MANUAL_BKASH' } }),
      create: vi.fn(),
    },
    orderPaymentTransaction: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(claim),
      update: vi.fn().mockResolvedValue(claim),
      findMany: vi.fn().mockResolvedValue([claim]),
    },
  };
  const db: any = { ...tx, $transaction: vi.fn((fn: any) => fn(tx)) };
  return { tx, db, service: new ManualPaymentsService(db) };
}

describe('Manual payment recipient configuration', () => {
  it('requires real configured account details and restricts account types', () => {
    expect(manualTransfer('MANUAL_BKASH', {})).toBeNull();
    expect(
      manualTransfer('MANUAL_NAGAD', { ...account, accountNumber: '1234' }),
    ).toBeNull();
    expect(
      manualTransfer('MANUAL_BKASH', { ...account, accountType: 'fake' }),
    ).toBeNull();
    expect(manualTransfer('BANK_TRANSFER', account)).toBeNull();
    expect(manualTransfer('MANUAL_NAGAD', account)?.label).toBe(
      'Nagad (manual)',
    );
    expect(
      manualTransfer('BANK_TRANSFER', { ...account, name: 'Example bank' })
        ?.bankName,
    ).toBe('Example bank');
  });
  it('only exposes enabled and complete manual channels; API gateways remain off', async () => {
    const rows = [
      { provider: 'MANUAL_BKASH', isEnabled: true, config: account },
      { provider: 'MANUAL_NAGAD', isEnabled: false, config: account },
    ];
    const db: any = {
      paymentGatewayConfig: {
        findMany: vi.fn().mockResolvedValue(rows),
        findUnique: vi.fn(({ where }) =>
          Promise.resolve(rows.find((row) => row.provider === where.provider)),
        ),
      },
    };
    const adapter: any = { isEnabled: () => false, isSimulated: () => false };
    const result = await new PaymentsService(db, adapter, adapter).getMethods();
    expect(result.manualTransfers.map((item) => item.id)).toEqual([
      'MANUAL_BKASH',
    ]);
    expect(result.options.optionBEnabled).toBe(true);
    expect(
      result.methods.find((item) => item.id === 'SSLCOMMERZ')?.enabled,
    ).toBe(false);
  });
  it('refuses enabling an incomplete account', async () => {
    const { db } = fixture();
    db.paymentGatewayConfig = {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
    };
    await expect(
      new PaymentsService(db, {} as any, {} as any).updateAdminSetting(
        'MANUAL_BKASH',
        { isEnabled: true, config: {} },
        'owner',
      ),
    ).rejects.toThrow('Set a valid recipient');
    expect(db.paymentGatewayConfig.upsert).not.toHaveBeenCalled();
  });
});

describe('Shopper manual transfer claims', () => {
  it('records server-calculated outstanding amount without marking an order paid', async () => {
    const { service, tx } = fixture();
    await service.submit(
      orderId,
      { customerId: 'owner' },
      { sender: '01711111111', reference: 'tx-123' },
      'session',
    );
    expect(tx.order.findFirst).toHaveBeenCalledWith({
      where: { id: orderId, customerId: 'owner' },
    });
    // Prisma's Order.id is String/TEXT, not @db.Uuid. Keep a parameterized TEXT comparison.
    expect(tx.$queryRaw.mock.calls[0][0].join('?')).toBe('SELECT id FROM orders WHERE id = ? FOR UPDATE');
    expect(tx.$queryRaw.mock.calls[0][1]).toBe(orderId);
    expect(
      tx.orderPaymentTransaction.create.mock.calls[0][0].data,
    ).toMatchObject({
      status: 'PENDING',
      providerReference: 'TX123',
      amount: order.grandTotal,
      metadata: { verification: 'CUSTOMER_CLAIM_PENDING' },
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: orderId },
      data: { version: { increment: 1 } },
    });
  });
  it('does not reveal or mutate orders outside the shopper scope', async () => {
    const { service, tx } = fixture();
    tx.order.findFirst.mockResolvedValue(null);
    await expect(
      service.submit(
        orderId,
        { customerId: 'someone-else' },
        { sender: '123', reference: 'TX123' },
        'session',
      ),
    ).rejects.toThrow('Order not found');
    expect(tx.orderPaymentTransaction.create).not.toHaveBeenCalled();
  });
  it('Option A claims only shipping, then refuses further advance claims after verification', async () => {
    const { service, tx } = fixture();
    tx.order.findFirst.mockResolvedValue({ ...order, paymentOption: 'OPTION_A', paymentMethod: 'COD' });
    await service.submit(orderId, {}, { sender: '01711111111', reference: 'ADVANCE1' }, 'session');
    expect(tx.orderPaymentTransaction.create.mock.calls[0][0].data.amount.toFixed(2)).toBe('10.00');
    tx.order.findFirst.mockResolvedValue({ ...order, paymentOption: 'OPTION_A', paymentMethod: 'COD', paidTotal: new Prisma.Decimal(10) });
    await expect(service.submit(orderId, {}, { sender: '01711111111', reference: 'ADVANCE2' }, 'session')).rejects.toThrow('No payment is due');
  });
  it('repeated same-order reference is idempotent; cross-order reuse is refused', async () => {
    const { service, tx } = fixture();
    tx.orderPaymentTransaction.findUnique.mockResolvedValue(claim);
    expect(
      await service.submit(
        orderId,
        {},
        { sender: '123', reference: 'TX123' },
        'session',
      ),
    ).toEqual({ ok: true, status: 'PENDING' });
    tx.orderPaymentTransaction.findUnique.mockResolvedValue({
      ...claim,
      orderId: 'another',
    });
    await expect(
      service.submit(
        orderId,
        {},
        { sender: '123', reference: 'TX123' },
        'session',
      ),
    ).rejects.toThrow('already been submitted');
    expect(tx.orderPaymentTransaction.create).not.toHaveBeenCalled();
  });
  it('refuses another claim while pending and refuses closed or fully paid orders', async () => {
    const { service, tx } = fixture();
    tx.orderPaymentTransaction.findFirst.mockResolvedValue(claim);
    await expect(
      service.submit(
        orderId,
        {},
        { sender: '123', reference: 'TX456' },
        'session',
      ),
    ).rejects.toThrow('awaiting verification');
    tx.orderPaymentTransaction.findFirst.mockResolvedValue(null);
    tx.order.findFirst.mockResolvedValue({ ...order, status: 'CANCELLED' });
    await expect(
      service.submit(
        orderId,
        {},
        { sender: '123', reference: 'TX456' },
        'session',
      ),
    ).rejects.toThrow('closed');
    tx.order.findFirst.mockResolvedValue({
      ...order,
      paidTotal: order.grandTotal,
    });
    await expect(
      service.submit(
        orderId,
        {},
        { sender: '123', reference: 'TX456' },
        'session',
      ),
    ).rejects.toThrow('No payment is due');
  });
  it('snapshots recipient once and exposes no internal verification evidence', async () => {
    const { service, tx } = fixture();
    await service.capture(
      orderId,
      manualTransfer('MANUAL_BKASH', account)!,
      'session',
    );
    expect(tx.orderEvent.create).not.toHaveBeenCalled();
    tx.orderPaymentTransaction.findMany.mockResolvedValue([
      {
        ...claim,
        amount: new Prisma.Decimal(110),
        createdAt: new Date(),
        metadata: {
          evidence: 'private internal note',
          sender: '123',
          rejectionReason: 'Reference not found',
        },
        status: 'FAILED',
      },
    ]);
    const details = await service.details(orderId);
    expect(details?.submissions[0].rejectionReason).toBe('Reference not found');
    expect(JSON.stringify(details)).not.toContain('private internal note');
    expect(JSON.stringify(details)).not.toContain('sender');
  });
  it('validates reference format and accepts the manual checkout method', async () => {
    const invalid = plainToInstance(ManualPaymentSubmissionDto, {
      reference: '<script>',
      sender: 'a',
    });
    expect((await validate(invalid)).length).toBe(2);
    const valid = plainToInstance(ManualPaymentSubmissionDto, {
      reference: 'TX123',
      sender: '01711111111',
    });
    expect(await validate(valid)).toEqual([]);
    const errors = await validate(
      plainToInstance(ShopCheckoutDto, {
        paymentMethod: 'MANUAL',
        paymentOption: 'MANUAL_NAGAD',
      }),
    );
    expect(
      errors.filter((error) =>
        ['paymentMethod', 'paymentOption'].includes(error.property),
      ),
    ).toEqual([]);
  });
});

describe('Admin manual transfer review', () => {
  function operations(snapshot = order) {
    const { tx } = fixture();
    const service = new OrderOperationsService({} as any);
    vi.spyOn(service as any, 'mutate').mockImplementation((...args: any[]) =>
      args[5](tx, snapshot),
    );
    return { service, tx };
  }
  it('approves the existing pending claim exactly once rather than inserting a duplicate', async () => {
    const { service, tx } = operations();
    await service.recordPayment(
      orderId,
      {
        version: 1,
        kind: 'MANUAL_VERIFIED',
        amount: '110',
        provider: 'manual_bkash',
        reference: 'tx-123',
        evidence: 'Verified receipt in account',
      },
      'operation-key',
      { id: 'admin', role: 'SUPER_ADMIN' } as any,
    );
    expect(tx.orderPaymentTransaction.update.mock.calls[0][0]).toMatchObject({
      where: { id: claim.id },
      data: { status: 'SUCCEEDED' },
    });
    expect(tx.orderPaymentTransaction.create).not.toHaveBeenCalled();
    expect(tx.order.update.mock.calls[0][0].data.paymentStatus).toBe('PAID');
    expect(tx.order.update.mock.calls[0][0].data.paidTotal.toFixed(2)).toBe(
      '110.00',
    );
  });
  it('rejects mismatched amounts and previously reviewed references', async () => {
    const { service } = operations();
    await expect(
      service.recordPayment(
        orderId,
        {
          version: 1,
          kind: 'MANUAL_VERIFIED',
          amount: '100',
          provider: 'manual_bkash',
          reference: 'TX123',
          evidence: 'Verified receipt in account',
        },
        'key',
        { id: 'admin' } as any,
      ),
    ).rejects.toThrow('amount does not match');
  });
  it('rejection preserves accounting and provides a customer-safe reason', async () => {
    const { service, tx } = operations();
    await service.rejectManualPayment(
      orderId,
      claim.id,
      { version: 1, note: 'No matching transfer found' },
      'operation-key',
      { id: 'admin' } as any,
    );
    expect(
      tx.orderPaymentTransaction.update.mock.calls[0][0].data,
    ).toMatchObject({
      status: 'FAILED',
      metadata: { rejectionReason: 'No matching transfer found' },
    });
    expect(tx.order.update).not.toHaveBeenCalled();
  });
  it('restricts approval and rejection routes to SUPER_ADMIN', () => {
    expect(Reflect.getMetadata('roles', AdminPaymentsController)).toEqual([
      'SUPER_ADMIN',
    ]);
    for (const method of ['recordPayment', 'rejectManualPayment'] as const)
      expect(
        Reflect.getMetadata('roles', OrdersController.prototype[method]),
      ).toEqual(['SUPER_ADMIN']);
  });
  it('does not credit a previously approved claim again', async () => {
    const { service, tx } = operations({
      ...order,
      payments: [{ ...claim, status: 'SUCCEEDED' }],
    });
    await expect(
      service.recordPayment(
        orderId,
        {
          version: 2,
          kind: 'MANUAL_VERIFIED',
          amount: '110',
          provider: 'manual_bkash',
          reference: 'TX123',
          evidence: 'Receipt checked independently',
        },
        'new-key',
        { id: 'admin' } as any,
      ),
    ).rejects.toThrow('no longer pending');
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.orderPaymentTransaction.update).not.toHaveBeenCalled();
  });
  it('verifies the delivery advance as PARTIALLY_PAID and collects only the product balance as COD', async () => {
    const advance = { ...order, paymentOption: 'OPTION_A', paymentMethod: 'COD', payments: [{ ...claim, amount: new Prisma.Decimal(10) }] };
    const { service, tx } = operations(advance);
    await service.recordPayment(orderId, { version: 1, kind: 'MANUAL_VERIFIED', amount: '10', provider: 'manual_bkash', reference: 'TX123', evidence: 'Receipt checked in account' }, 'advance-key', { id: 'admin' } as any);
    expect(tx.order.update.mock.calls[0][0].data.paymentStatus).toBe('PARTIALLY_PAID');
    expect(tx.order.update.mock.calls[0][0].data.paidTotal.toFixed(2)).toBe('10.00');
    const final = operations({ ...advance, paidTotal: new Prisma.Decimal(10), shipments: [{ id: 'shipment', status: 'DELIVERED' }] } as any);
    final.tx.orderShipment = { update: vi.fn() };
    await final.service.recordPayment(orderId, { version: 2, kind: 'COD_COLLECTION', amount: '100', provider: 'courier', reference: 'COD123', evidence: 'Delivery collection verified', shipmentId: 'shipment' }, 'cod-collection-key', { id: 'admin' } as any);
    expect(final.tx.order.update.mock.calls[0][0].data.paymentStatus).toBe('PAID');
    expect(final.tx.order.update.mock.calls[0][0].data.paidTotal.toFixed(2)).toBe('110.00');
  });
  it('blocks booking an advance COD shipment before its delivery payment is verified', async () => {
    const { service } = operations({ ...order, paymentOption: 'OPTION_A', paymentMethod: 'COD', status: 'CONFIRMED' });
    await expect(service.bookManualShipment(orderId, { version: 1, provider: 'courier', trackingNumber: 'TRACK123' } as any, 'shipment-key', { id: 'admin' } as any)).rejects.toThrow('Verify the advance delivery payment');
  });
});
