import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { OrderOperationsService } from './order-operations.service.js';

const D = Prisma.Decimal;
function fixture(overrides: Record<string, unknown> = {}) {
  const order = {
    id: 'order-one',
    customerPhone: '01711111111',
    status: 'PENDING',
    paymentMethod: 'COD',
    paymentStatus: 'UNPAID',
    paymentPlan: 'COD',
    paymentOption: 'COD',
    grandTotal: new D(1100),
    paidTotal: new D(0),
    refundedTotal: new D(0),
    shippingTotal: new D(100),
    manualPayments: [],
    returns: [],
    ...overrides,
  };
  const db = {
    order: {
      findUnique: vi.fn().mockResolvedValue(order),
      groupBy: vi.fn().mockResolvedValue([
        { status: 'PENDING', _count: { _all: 2 } },
        { status: 'DELIVERED', _count: { _all: 4 } },
        { status: 'CANCELLED', _count: { _all: 1 } },
        { status: 'RETURNED', _count: { _all: 1 } },
      ]),
    },
  };
  return { db, service: new OrderOperationsService(db as never) };
}
describe('Admin order detail summaries', () => {
  it('keeps the outstanding legacy delivery advance visible', async () => {
    const result = await fixture({
      paymentOption: 'OPTION_A',
      paymentPlan: 'PARTIAL_ADVANCE',
    }).service.detail('order-one');
    expect(result.amountDueNow).toBe('100.00');
    expect(result.amountDueOnDelivery).toBe('1000.00');
  });
  it('counts actual phone history including cancelled and returned orders separately', async () => {
    const { db, service } = fixture();
    const result = await service.detail('order-one');
    expect(result.customerHistory).toEqual({
      total: 8,
      delivered: 4,
      cancelled: 1,
      returned: 1,
    });
    expect(db.order.groupBy.mock.calls[0][0].where).toEqual({
      customerPhone: '01711111111',
    });
  });
  it('shows zero due now and the outstanding COD amount for an unpaid COD order', async () => {
    const result = await fixture().service.detail('order-one');
    expect(result.amountDueNow).toBe('0.00');
    expect(result.amountDueOnDelivery).toBe('1100.00');
    expect(result.outstandingBalance).toBe('1100.00');
  });
  it('shows a submitted advance as due, without crediting it as paid', async () => {
    const result = await fixture({
      paymentPlan: 'PARTIAL_ADVANCE',
      paymentOption: 'PARTIAL_ADVANCE',
      manualPayments: [
        {
          status: 'awaiting_verification',
          amountDueNow: new D(100),
          amountDueOnDelivery: new D(1000),
        },
      ],
    }).service.detail('order-one');
    expect(result.amountDueNow).toBe('100.00');
    expect(result.amountDueOnDelivery).toBe('1000.00');
    expect(result.paymentStatus).toBe('UNPAID');
    expect(result.paidTotal.toFixed(2)).toBe('0.00');
  });
  it('reduces the delivery balance after COD collection and never requests the verified advance again', async () => {
    const result = await fixture({
      paymentPlan: 'PARTIAL_ADVANCE',
      paymentStatus: 'PARTIALLY_PAID',
      paidTotal: new D(600),
      manualPayments: [
        {
          status: 'confirmed',
          amountDueNow: new D(100),
          amountDueOnDelivery: new D(1000),
        },
      ],
    }).service.detail('order-one');
    expect(result.amountDueNow).toBe('0.00');
    expect(result.amountDueOnDelivery).toBe('500.00');
  });
  it('returns not found without querying unrelated phone history', async () => {
    const { db, service } = fixture();
    db.order.findUnique.mockResolvedValue(null);
    await expect(service.detail('missing')).rejects.toThrow('Order not found');
    expect(db.order.groupBy).not.toHaveBeenCalled();
  });
});
