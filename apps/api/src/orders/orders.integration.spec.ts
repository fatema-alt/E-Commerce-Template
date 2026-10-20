import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { PrismaClient, Prisma } from '../generated/prisma/client.js';
import { OrderOperationsService } from './order-operations.service.js';
import { OrderReportsService } from './order-reports.service.js';
import { OrdersController } from './orders.controller.js';
import { AdminGuard } from '../auth/auth.guard.js';
import type { AuthService } from '../auth/auth.service.js';

describe.skipIf(!process.env.ORDERS_TEST_DATABASE_URL)(
  'Orders with isolated PostgreSQL',
  { timeout: 20000 },
  () => {
    let db: PrismaClient,
      service: OrderOperationsService,
      reports: OrderReportsService;
    const actor = { id: randomUUID(), role: 'SUPER_ADMIN' };
    const suffix = randomUUID();
    let categoryId: string;
    beforeAll(async () => {
      const url = new URL(process.env.ORDERS_TEST_DATABASE_URL!);
      if (!/^\/commerce_orders_validation_[a-zA-Z0-9_]+$/.test(url.pathname))
        throw new Error('Isolated orders database required');
      db = new PrismaClient({ datasourceUrl: url.toString() });
      await db.$connect();
      service = new OrderOperationsService(db as never);
      reports = new OrderReportsService(db as never);
      categoryId = (
        await db.category.create({
          data: { name: 'Orders test', slug: 'orders-test-' + suffix },
        })
      ).id;
    });
    afterAll(async () => {
      await db?.$disconnect();
    });
    it('rejects edits to order snapshots and final audit records at the database boundary', async () => {
      const { order } = await fixture();
      await expect(
        db.order.update({
          where: { id: order.id },
          data: { customerName: 'Rewritten guest' },
        }),
      ).rejects.toThrow('immutable');
      await expect(
        db.orderItem.update({
          where: { id: order.items[0].id },
          data: { quantity: 100 },
        }),
      ).rejects.toThrow('immutable');
      const event = await db.orderEvent.findFirstOrThrow({
        where: { orderId: order.id },
      });
      await expect(
        db.orderEvent.delete({ where: { id: event.id } }),
      ).rejects.toThrow('immutable');
      await payment(order.id, '10');
      const transaction = await db.orderPaymentTransaction.findFirstOrThrow({
        where: { orderId: order.id },
      });
      await expect(
        db.orderPaymentTransaction.update({
          where: { id: transaction.id },
          data: { amount: '999' },
        }),
      ).rejects.toThrow('immutable');
    });
    async function fixture(
      method: 'COD' | 'BANK_TRANSFER' = 'BANK_TRANSFER',
      quantity = 3,
      stock = 10,
    ) {
      const sku = randomUUID();
      const product = await db.product.create({
        data: {
          name: 'Snapshot ' + sku,
          slug: sku,
          sku,
          categoryId,
          price: '100.01',
          status: 'ACTIVE',
          inventory: { create: { quantity: stock } },
        },
        include: { inventory: true },
      });
      const dto = {
        customerName: '=TEST ' + suffix,
        customerPhone: '01700000000',
        paymentMethod: method,
        items: [{ productId: product.id, quantity }],
        shippingAddress: {
          recipientName: 'Guest',
          phone: '01700000000',
          line1: 'Test address',
          city: 'Dhaka',
        },
      };
      const order = await service.create(dto, randomUUID(), actor.id);
      return { product, order, dto };
    }
    const current = (id: string) => service.detail(id);
    async function status(
      id: string,
      next: 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED',
    ) {
      const o = await current(id);
      await service.changeStatus(
        id,
        { version: o.version, status: next },
        randomUUID(),
        actor,
      );
    }
    async function deliver(id: string) {
      await status(id, 'CONFIRMED');
      await status(id, 'PROCESSING');
      const o = await current(id);
      await service.bookManualShipment(
        id,
        {
          version: o.version,
          provider: 'test-courier',
          trackingNumber: randomUUID(),
          shippingCost: 20,
          parcelWeightKg: 1,
        },
        randomUUID(),
        actor,
      );
      await status(id, 'SHIPPED');
      await status(id, 'DELIVERED');
      return current(id);
    }
    async function payment(
      id: string,
      amount: string,
      kind:
        | 'MANUAL_VERIFIED'
        | 'COD_COLLECTION'
        | 'COD_SETTLEMENT'
        | 'REFUND_RECORDED' = 'MANUAL_VERIFIED',
      extra: object = {},
    ) {
      const o = await current(id);
      await service.recordPayment(
        id,
        {
          version: o.version,
          kind,
          amount,
          provider: 'test-bank',
          reference: randomUUID(),
          evidence: 'Independently checked bank statement',
          ...extra,
        },
        randomUUID(),
        actor,
      );
      return current(id);
    }
    async function request(id: string, quantity: number) {
      const o = await current(id);
      await service.requestReturn(
        id,
        {
          version: o.version,
          reason: 'Customer return request',
          items: [{ orderItemId: o.items[0].id, quantity }],
        },
        randomUUID(),
        actor,
      );
      return current(id);
    }
    async function inspect(id: string, qty: number, sellable: number) {
      let o = await current(id);
      let r = o.returns.at(-1)!;
      await service.decideReturn(
        id,
        r.id,
        {
          version: o.version,
          approved: true,
          note: 'Return approval reviewed',
        },
        randomUUID(),
        actor,
      );
      o = await current(id);
      r = o.returns.at(-1)!;
      await service.receiveReturn(
        id,
        r.id,
        {
          version: o.version,
          note: 'Goods physically inspected',
          items: [
            {
              orderItemId: o.items[0].id,
              receivedQuantity: qty,
              sellableQuantity: sellable,
            },
          ],
        },
        randomUUID(),
        actor,
      );
      return current(id);
    }

    it('creates immutable guest snapshots and retries creation without reserving twice', async () => {
      const { order, product, dto } = await fixture();
      const key = randomUUID();
      const a = await service.create(dto, key, actor.id),
        b = await service.create(dto, key, actor.id);
      expect(a!.id).toBe(b!.id);
      expect(order.customerId).toBeNull();
      await db.product.update({
        where: { id: product.id },
        data: { name: 'Changed catalog', price: '900' },
      });
      const snapshot = await current(order.id);
      expect(snapshot.items[0].unitPrice.toString()).toBe('100.01');
      expect(snapshot.items[0].nameSnapshot).toContain('Snapshot');
      const inv = await db.inventory.findUniqueOrThrow({
        where: { id: product.inventory!.id },
      });
      expect(inv.reserved).toBe(6);
      await expect(
        service.create({ ...dto, customerName: 'different' }, key, actor.id),
      ).rejects.toThrow('different');
    });
    it('prevents overselling during concurrent reservations', async () => {
      const { dto, product } = await fixture('COD', 1, 2);
      const attempts = await Promise.allSettled([
        service.create(dto, randomUUID(), actor.id),
        service.create(dto, randomUUID(), actor.id),
      ]);
      expect(attempts.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const inv = await db.inventory.findUniqueOrThrow({
        where: { id: product.inventory!.id },
      });
      expect(inv.reserved).toBe(2);
      expect(inv.quantity).toBe(2);
    });
    it('rejects invalid/stale transitions and concurrent duplicate updates', async () => {
      const { order } = await fixture();
      await expect(
        service.changeStatus(
          order.id,
          { version: 0, status: 'DELIVERED' },
          randomUUID(),
          actor,
        ),
      ).rejects.toThrow('Cannot transition');
      const results = await Promise.allSettled([
        service.changeStatus(
          order.id,
          { version: 0, status: 'CONFIRMED' },
          randomUUID(),
          actor,
        ),
        service.changeStatus(
          order.id,
          { version: 0, status: 'CONFIRMED' },
          randomUUID(),
          actor,
        ),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect((await current(order.id)).version).toBe(1);
      await expect(
        service.addNote(
          order.id,
          { version: 0, body: 'Stale note' },
          randomUUID(),
          actor,
        ),
      ).rejects.toThrow('refresh');
    });
    it('returns the committed response for a duplicate mutation key', async () => {
      const { order } = await fixture();
      const key = randomUUID(),
        dto = { version: 0, status: 'CONFIRMED' as const };
      const a = await service.changeStatus(order.id, dto, key, actor);
      const b = await service.changeStatus(order.id, dto, key, actor);
      expect(a).toEqual(b);
      expect(
        (await current(order.id)).events.filter(
          (e) => e.action === 'ORDER_STATUS_CHANGED',
        ),
      ).toHaveLength(1);
      await expect(
        service.addNote(
          order.id,
          { version: 1, body: 'Other operation' },
          key,
          actor,
        ),
      ).rejects.toThrow('different');
    });
    it('requires shipment before dispatch, consumes stock exactly once, then confirms delivery', async () => {
      const { order, product } = await fixture();
      await status(order.id, 'CONFIRMED');
      await status(order.id, 'PROCESSING');
      await expect(
        service.changeStatus(
          order.id,
          { version: 2, status: 'SHIPPED' },
          randomUUID(),
          actor,
        ),
      ).rejects.toThrow('shipment');
      await service.bookManualShipment(
        order.id,
        { version: 2, provider: 'manual-test', trackingNumber: randomUUID() },
        randomUUID(),
        actor,
      );
      let o = await current(order.id);
      const shipment = o.shipments[0];
      await expect(
        service.updateShipment(
          order.id,
          shipment.id,
          {
            version: o.version,
            status: 'DELIVERED',
            note: 'Premature delivery',
          },
          randomUUID(),
          actor,
        ),
      ).rejects.toThrow();
      await service.updateShipment(
        order.id,
        shipment.id,
        {
          version: o.version,
          status: 'IN_TRANSIT',
          note: 'Courier picked up parcel',
        },
        randomUUID(),
        actor,
      );
      o = await current(order.id);
      expect(o.status).toBe('SHIPPED');
      const stock = await db.inventory.findUniqueOrThrow({
        where: { id: product.inventory!.id },
      });
      expect(stock.quantity).toBe(7);
      expect(stock.reserved).toBe(0);
      await service.updateShipment(
        order.id,
        shipment.id,
        {
          version: o.version,
          status: 'FAILED',
          note: 'Customer unavailable today',
        },
        randomUUID(),
        actor,
      );
      o = await current(order.id);
      await service.updateShipment(
        order.id,
        shipment.id,
        {
          version: o.version,
          status: 'IN_TRANSIT',
          note: 'Retry delivery arranged',
        },
        randomUUID(),
        actor,
      );
      await status(order.id, 'DELIVERED');
      expect((await current(order.id)).shipments[0].status).toBe('DELIVERED');
      expect(
        await db.inventoryMovement.count({
          where: { referenceId: order.id, type: 'SALE' },
        }),
      ).toBe(1);
      await expect(
        service.cancel(
          order.id,
          { version: (await current(order.id)).version },
          randomUUID(),
          actor,
        ),
      ).rejects.toThrow('dispatched');
    });
    it('cancels paid orders, releases reservations and records partial/full refunds separately', async () => {
      const { order, product } = await fixture();
      await payment(order.id, '300.03');
      let o = await current(order.id);
      await service.cancel(o.id, { version: o.version }, randomUUID(), actor);
      o = await current(o.id);
      expect(o.paidTotal.toString()).toBe('300.03');
      expect(o.refundedTotal.toString()).toBe('0');
      expect(o.refundableBalance).toBe('300.03');
      const stock = await db.inventory.findUniqueOrThrow({
        where: { id: product.inventory!.id },
      });
      expect(stock.quantity).toBe(10);
      expect(stock.reserved).toBe(0);
      o = await payment(o.id, '100.01', 'REFUND_RECORDED');
      expect(o.paymentStatus).toBe('PARTIALLY_REFUNDED');
      o = await payment(o.id, '200.02', 'REFUND_RECORDED');
      expect(o.paymentStatus).toBe('REFUNDED');
      const cancelledReport = await reports.report({ q: o.orderNumber });
      expect(cancelledReport.netSales).toBe('0.00');
      expect(cancelledReport.refundTotal).toBe('300.03');
      await expect(payment(o.id, '0.01', 'REFUND_RECORDED')).rejects.toThrow(
        'exceeds',
      );
    });
    it('rejects unapproved receiving and over-return quantities; supports rejection', async () => {
      const { order } = await fixture();
      await deliver(order.id);
      await expect(request(order.id, 4)).rejects.toThrow('quantity');
      let o = await request(order.id, 1);
      const r = o.returns[0];
      await expect(
        service.receiveReturn(
          o.id,
          r.id,
          {
            version: o.version,
            note: 'Not approved goods',
            items: [
              {
                orderItemId: o.items[0].id,
                receivedQuantity: 1,
                sellableQuantity: 1,
              },
            ],
          },
          randomUUID(),
          actor,
        ),
      ).rejects.toThrow('approved');
      await service.decideReturn(
        o.id,
        r.id,
        { version: o.version, approved: false, note: 'Outside return policy' },
        randomUUID(),
        actor,
      );
      o = await current(o.id);
      expect(o.status).toBe('DELIVERED');
      expect(o.returns[0].status).toBe('REJECTED');
    });
    it('handles partial and full returns, only restocks inspected sellable quantities, rejects duplicate receiving', async () => {
      const { order, product } = await fixture();
      await payment(order.id, '300.03');
      await deliver(order.id);
      await request(order.id, 2);
      let o = await inspect(order.id, 2, 1);
      expect(o.status).toBe('DELIVERED');
      expect(o.refundableBalance).toBe('200.02');
      const r = o.returns[0];
      expect(r.items[0].restockedQuantity).toBe(1);
      await expect(
        service.receiveReturn(
          o.id,
          r.id,
          {
            version: o.version,
            note: 'Duplicate receipt attempt',
            items: [
              {
                orderItemId: o.items[0].id,
                receivedQuantity: 2,
                sellableQuantity: 2,
              },
            ],
          },
          randomUUID(),
          actor,
        ),
      ).rejects.toThrow('previously');
      await expect(payment(o.id, '200.03', 'REFUND_RECORDED')).rejects.toThrow(
        'exceeds',
      );
      await payment(o.id, '200.02', 'REFUND_RECORDED');
      await request(o.id, 1);
      o = await inspect(o.id, 1, 1);
      expect(o.status).toBe('RETURNED');
      expect(o.refundableBalance).toBe('100.01');
      const stock = await db.inventory.findUniqueOrThrow({
        where: { id: product.inventory!.id },
      });
      expect(stock.quantity).toBe(9);
      o = await payment(o.id, '100.01', 'REFUND_RECORDED');
      expect(o.paymentStatus).toBe('REFUNDED');
    });
    it('requires evidence, prevents duplicate references, overpayments and refunds without eligibility', async () => {
      const { order } = await fixture();
      const reference = randomUUID();
      const dto = {
        version: 0,
        kind: 'MANUAL_VERIFIED' as const,
        amount: '100.01',
        provider: 'BANK',
        reference,
        evidence: 'Independently checked statement',
      };
      await service.recordPayment(order.id, dto, randomUUID(), actor);
      await expect(
        service.recordPayment(
          order.id,
          { ...dto, version: 1, provider: 'bank' },
          randomUUID(),
          actor,
        ),
      ).rejects.toThrow('duplicate');
      await expect(payment(order.id, '201')).rejects.toThrow('exceeds');
      await expect(payment(order.id, '10', 'REFUND_RECORDED')).rejects.toThrow(
        'eligible',
      );
      const o = await current(order.id);
      expect(o.payments).toHaveLength(1);
      expect(o.payments[0].metadata).toMatchObject({
        verification: 'ADMIN_MANUAL_EVIDENCE',
        externalTransferExecuted: false,
      });
    });
    it('reconciles COD with fees without double counting customer payment', async () => {
      const { order } = await fixture('COD');
      let o = await deliver(order.id);
      const shipmentId = o.shipments[0].id;
      o = await payment(o.id, '300.03', 'COD_COLLECTION', { shipmentId });
      await expect(
        payment(o.id, '300.03', 'COD_SETTLEMENT', { shipmentId, fee: '10' }),
      ).rejects.toThrow('exceed');
      o = await payment(o.id, '290.03', 'COD_SETTLEMENT', {
        shipmentId,
        fee: '10',
      });
      expect(o.paidTotal.toString()).toBe('300.03');
      expect(o.shipments[0].codSettled.toString()).toBe('290.03');
      const report = await reports.report({ q: o.orderNumber });
      expect(report.paidTotal).toBe('300.03');
      expect(report.codOutstanding).toBe('0.00');
      expect(report.courierFees).toBe('10.00');
    });
    it('validates return windows, quantities and inspection sellability', async () => {
      const { order } = await fixture();
      let o = await deliver(order.id);
      await db.order.update({
        where: { id: o.id },
        data: { deliveredAt: new Date(Date.now() - 15 * 86400000) },
      });
      await expect(request(o.id, 1)).rejects.toThrow('window');
      await db.order.update({
        where: { id: o.id },
        data: { deliveredAt: new Date() },
      });
      await request(o.id, 1);
      o = await current(o.id);
      await service.decideReturn(
        o.id,
        o.returns[0].id,
        { version: o.version, approved: true, note: 'Accept return request' },
        randomUUID(),
        actor,
      );
      o = await current(o.id);
      await expect(
        service.receiveReturn(
          o.id,
          o.returns[0].id,
          {
            version: o.version,
            note: 'Invalid inspection count',
            items: [
              {
                orderItemId: o.items[0].id,
                receivedQuantity: 1,
                sellableQuantity: 2,
              },
            ],
          },
          randomUUID(),
          actor,
        ),
      ).rejects.toThrow('Invalid');
    });
    it('filters, sorts and paginates server-side; reports zero rows; exports safe CSV with matching filters', async () => {
      const { order } = await fixture();
      const list = await service.list({
        q: order.orderNumber,
        limit: '1',
        sort: 'total_desc',
      });
      expect(list.total).toBe(1);
      expect(list.items[0].id).toBe(order.id);
      expect(
        (await service.list({ q: order.orderNumber, page: '2', limit: '1' }))
          .items,
      ).toHaveLength(0);
      for (const filters of [
        { page: '0' },
        { limit: '101' },
        { sort: 'bad' },
        { status: 'bad' },
        { from: '2026-02-30' },
        { from: '2026-12-01', to: '2026-01-01' },
      ])
        await expect(service.list(filters)).rejects.toThrow();
      const csv = await reports.exportCsv({ q: order.orderNumber }, actor.id);
      expect(csv).toContain(`"'=TEST ${suffix}"`);
      expect(csv.split('\r\n')).toHaveLength(2);
      const report = await reports.report({ q: order.orderNumber }, 'monthly');
      expect(report.totalOrders).toBe(1);
      expect(report.grossSales).toBe('300.03');
      expect(
        (await reports.report({ q: 'not-found-' + suffix })).grossSales,
      ).toBe('0.00');
    });
    it('keeps date boundaries, literal search, filtering, sorting and report totals consistent', async () => {
      const q = 'boundary-' + suffix;
      for (const [stamp, amount] of [
        ['2026-10-17T17:59:59.999Z', '10'],
        ['2026-10-17T18:00:00.000Z', '20'],
        ['2026-10-18T17:59:59.999Z', '30'],
        ['2026-10-18T18:00:00.000Z', '40'],
      ]) {
        await db.order.create({
          data: {
            orderNumber: randomUUID(),
            customerName: q,
            customerPhone: '01700000000',
            paymentMethod: 'COD',
            subtotal: amount,
            grandTotal: amount,
            createdAt: new Date(stamp),
          },
        });
      }
      const filters = {
        q,
        from: '2026-10-18',
        to: '2026-10-18',
        status: 'PENDING',
        paymentStatus: 'UNPAID',
        paymentMethod: 'COD',
        sort: 'total_desc',
      };
      const first = await service.list({ ...filters, limit: '1' }),
        second = await service.list({ ...filters, limit: '1', page: '2' });
      expect(first.total).toBe(2);
      expect(first.items[0].grandTotal.toString()).toBe('30');
      expect(second.items[0].grandTotal.toString()).toBe('20');
      const report = await reports.report(filters);
      expect(report.totalOrders).toBe(2);
      expect(report.grossSales).toBe('50.00');
      expect(report.summaries[0].period).toBe('2026-10-18');
      expect((await service.list({ q: '%' })).total).toBe(
        (await reports.report({ q: '%' })).totalOrders,
      );
      expect((await service.list({ q: '%' })).total).toBe(0);
      expect(
        (await reports.exportCsv(filters, actor.id)).split('\r\n'),
      ).toHaveLength(3);
    });
    it('enforces actual controller role metadata for staff, operations, finance and export', async () => {
      const reflector = new Reflector();
      for (const role of ['STAFF', 'ADMIN', 'SUPER_ADMIN']) {
        const guard = new AdminGuard(reflector, {
          session: async () => ({ ...actor, role }),
        } as unknown as AuthService);
        for (const name of [
          'changeStatus',
          'addNote',
          'cancel',
          'bookManualShipment',
          'updateShipment',
          'requestReturn',
          'decideReturn',
          'receiveReturn',
          'recordPayment',
          'export',
        ] as const) {
          const context = {
            switchToHttp: () => ({
              getRequest: () => ({
                method: name === 'export' ? 'GET' : 'POST',
                headers: {
                  cookie: 'commerce_admin_session=test',
                  'x-commerce-admin': '1',
                },
              }),
            }),
            getHandler: () => OrdersController.prototype[name],
            getClass: () => OrdersController,
          } as unknown as ExecutionContext;
          if (
            role === 'STAFF' ||
            (role === 'ADMIN' && name === 'recordPayment')
          )
            await expect(guard.canActivate(context)).rejects.toThrow();
          else await expect(guard.canActivate(context)).resolves.toBe(true);
        }
      }
    });
  },
);
