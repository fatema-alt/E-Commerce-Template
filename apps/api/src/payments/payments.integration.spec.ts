import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import { PrismaClient, Prisma } from '../generated/prisma/client.js';
import { BkashAdapter } from './adapters/bkash.adapter.js';
import { SslCommerzAdapter } from './adapters/sslcommerz.adapter.js';
import { PaymentsService } from './payments.service.js';
import { OnlinePaymentMethod } from './payments.dto.js';

describe.skipIf(!process.env.ORDERS_TEST_DATABASE_URL)(
  'Payments Concurrency and Idempotency with isolated PostgreSQL',
  { timeout: 30000 },
  () => {
    let db: PrismaClient;
    let service: PaymentsService;
    let bkashAdapter: BkashAdapter;
    let sslAdapter: SslCommerzAdapter;

    beforeAll(async () => {
      const url = new URL(process.env.ORDERS_TEST_DATABASE_URL!);
      if (!/^\/commerce_orders_validation_[a-zA-Z0-9_]+$/.test(url.pathname)) {
        throw new Error('Isolated orders database required for integration tests');
      }
      db = new PrismaClient({ datasourceUrl: url.toString() });
      await db.$connect();

      // Enable simulation for testing adapter in this non-production test environment
      process.env.ALLOW_SIMULATED_PAYMENTS = 'true';
      bkashAdapter = new BkashAdapter();
      sslAdapter = new SslCommerzAdapter();
      service = new PaymentsService(db as never, bkashAdapter, sslAdapter);
    });

    afterAll(async () => {
      delete process.env.ALLOW_SIMULATED_PAYMENTS;
      await db?.$disconnect();
    });

    it('handles two simultaneous callbacks on real PostgreSQL without double crediting (row lock & idempotency)', async () => {
      const orderId = randomUUID();
      const orderNumber = `ORD-CONCUR-${randomUUID().slice(0, 8)}`;
      const simPaymentId = `sim_bkash_concur_${randomUUID().slice(0, 10)}`;

      // Create test order in PostgreSQL
      await db.order.create({
        data: {
          id: orderId,
          orderNumber,
          customerName: 'Real DB Concurrency Test',
          customerPhone: '01700000000',
          currency: 'BDT',
          subtotal: new Prisma.Decimal('900.00'),
          shippingTotal: new Prisma.Decimal('100.00'),
          grandTotal: new Prisma.Decimal('1000.00'),
          paidTotal: new Prisma.Decimal('0.00'),
          refundedTotal: new Prisma.Decimal('0.00'),
          paymentMethod: 'ONLINE',
          paymentOption: 'OPTION_B',
          status: 'PENDING',
          paymentStatus: 'UNPAID',
        },
      });

      // Create initial PENDING transaction
      await db.orderPaymentTransaction.create({
        data: {
          orderId,
          type: 'PAYMENT',
          status: 'PENDING',
          provider: 'BKASH',
          providerReference: simPaymentId,
          idempotencyKey: `pay:BKASH:${orderId}:init`,
          amount: new Prisma.Decimal('1000.00'),
          currency: 'BDT',
          metadata: {
            paymentOption: 'OPTION_B',
            storefrontOrigin: 'http://localhost:3000',
          },
        },
      });

      // Fire two callbacks simultaneously against real PostgreSQL
      const [res1, res2] = await Promise.all([
        service.processCallback(
          OnlinePaymentMethod.BKASH,
          { orderId },
          { paymentID: simPaymentId, status: 'success', amount: 1000 },
        ),
        service.processCallback(
          OnlinePaymentMethod.BKASH,
          { orderId },
          { paymentID: simPaymentId, status: 'success', amount: 1000 },
        ),
      ]);

      expect(res1.redirectUrl).toMatch(
        new RegExp(`/orders/${orderId}\\?payment=(success|already_paid)`),
      );
      expect(res2.redirectUrl).toMatch(
        new RegExp(`/orders/${orderId}\\?payment=(success|already_paid)`),
      );

      // Verify actual data in PostgreSQL
      const updatedOrder = await db.order.findUniqueOrThrow({
        where: { id: orderId },
      });

      // EXACTLY one credit of 1000.00 (NOT 2000.00)
      expect(updatedOrder.paidTotal.toFixed(2)).toBe('1000.00');
      expect(updatedOrder.paymentStatus).toBe('PAID');
      expect(updatedOrder.status).toBe('CONFIRMED');

      // Transactions check: exactly one SUCCEEDED transaction
      const transactions = await db.orderPaymentTransaction.findMany({
        where: { orderId },
      });
      expect(transactions.length).toBe(1);
      expect(transactions[0].status).toBe('SUCCEEDED');

      // Audit events check: exactly one PAYMENT_CONFIRMED event
      const events = await db.orderEvent.findMany({
        where: { orderId, action: 'PAYMENT_CONFIRMED' },
      });
      expect(events.length).toBe(1);

      // Third callback (duplicate after both completed)
      const res3 = await service.processCallback(
        OnlinePaymentMethod.BKASH,
        { orderId },
        { paymentID: simPaymentId, status: 'success', amount: 1000 },
      );
      expect(res3.redirectUrl).toMatch(
        new RegExp(`/orders/${orderId}\\?payment=(already_paid|success)`),
      );

      const orderAfterDuplicate = await db.order.findUniqueOrThrow({
        where: { id: orderId },
      });
      expect(orderAfterDuplicate.paidTotal.toFixed(2)).toBe('1000.00');
    });

    it('credits only delivery charge for Option A partial payment on real PostgreSQL', async () => {
      const orderId = randomUUID();
      const orderNumber = `ORD-PART-${randomUUID().slice(0, 8)}`;
      const simPaymentId = `sim_bkash_part_${randomUUID().slice(0, 10)}`;

      await db.order.create({
        data: {
          id: orderId,
          orderNumber,
          customerName: 'Real DB Partial Test',
          customerPhone: '01800000000',
          currency: 'BDT',
          subtotal: new Prisma.Decimal('1850.00'),
          shippingTotal: new Prisma.Decimal('150.00'),
          grandTotal: new Prisma.Decimal('2000.00'),
          paidTotal: new Prisma.Decimal('0.00'),
          refundedTotal: new Prisma.Decimal('0.00'),
          paymentMethod: 'ONLINE',
          paymentOption: 'OPTION_A',
          status: 'PENDING',
          paymentStatus: 'UNPAID',
        },
      });

      await db.orderPaymentTransaction.create({
        data: {
          orderId,
          type: 'PAYMENT',
          status: 'PENDING',
          provider: 'BKASH',
          providerReference: simPaymentId,
          idempotencyKey: `pay:BKASH:${orderId}:init_part`,
          amount: new Prisma.Decimal('150.00'),
          currency: 'BDT',
          metadata: {
            paymentOption: 'OPTION_A',
            storefrontOrigin: 'http://localhost:3000',
          },
        },
      });

      const res = await service.processCallback(
        OnlinePaymentMethod.BKASH,
        { orderId },
        { paymentID: simPaymentId, status: 'success', amount: 150 },
      );

      expect(res.redirectUrl).toContain(`/orders/${orderId}?payment=success`);

      const order = await db.order.findUniqueOrThrow({
        where: { id: orderId },
      });

      expect(order.paidTotal.toFixed(2)).toBe('150.00');
      expect(order.paymentStatus).toBe('PARTIALLY_PAID');
      expect(order.status).toBe('CONFIRMED');
    });
  },
);
