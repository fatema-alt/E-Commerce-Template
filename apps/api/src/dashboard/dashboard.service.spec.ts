import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import {
  DashboardService,
  dashboardWindow,
  resolveTimeRange,
} from './dashboard.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('Dashboard calculations and boundary tests', () => {
  it('correctly shifts UTC times to Asia/Dhaka boundaries (order at 23:30 UTC belongs to next Dhaka day)', () => {
    // 2026-10-31T23:30:00Z is 2026-11-01T05:30:00+06:00 in Asia/Dhaka
    const testDate = new Date('2026-10-31T23:30:00Z');
    const range = resolveTimeRange('today', undefined, undefined, testDate);

    expect(range.month).toBe('2026-11');
    expect(range.days).toContain('2026-11-01');
    expect(range.days).not.toContain('2026-10-31');
  });

  it('zero-fills missing days across requested ranges (7d, 30d, 90d)', () => {
    const fixedNow = new Date('2026-11-01T12:00:00Z');

    const range7d = resolveTimeRange('7d', undefined, undefined, fixedNow);
    expect(range7d.days.length).toBe(7);
    expect(range7d.days[0]).toBe('2026-10-26');
    expect(range7d.days[6]).toBe('2026-11-01');

    const range30d = resolveTimeRange('30d', undefined, undefined, fixedNow);
    expect(range30d.days.length).toBe(30);

    const range90d = resolveTimeRange('90d', undefined, undefined, fixedNow);
    expect(range90d.days.length).toBe(90);
  });

  it('calculates previous period with exact matching duration', () => {
    const fixedNow = new Date('2026-11-01T12:00:00Z');
    const range = resolveTimeRange('7d', undefined, undefined, fixedNow);

    const currentDuration = range.end.getTime() - range.start.getTime();
    const prevDuration = range.prevEnd.getTime() - range.prevStart.getTime();

    expect(currentDuration).toBe(prevDuration);
    expect(range.prevEnd.getTime()).toBe(range.start.getTime());
  });

  it('maintains backwards compatibility for dashboardWindow helper', () => {
    const boundary = dashboardWindow(new Date('2026-10-31T18:00:00Z'));
    expect(boundary.month).toBe('2026-11');
    expect(boundary.start.toISOString()).toBe('2026-10-31T18:00:00.000Z');
    expect(boundary.days.length).toBe(7);
  });
});

describe('DashboardService business logic & role stripping', () => {
  let service: DashboardService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      $queryRaw: vi.fn(),
      order: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      orderEvent: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      productReview: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      orderPaymentTransaction: {
        count: vi.fn().mockResolvedValue(0),
      },
      dashboardTarget: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
      },
      dashboardLayout: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
      customer: {
        count: vi.fn().mockResolvedValue(0),
      },
      catalogAuditLog: {
        create: vi.fn(),
      },
    };

    service = new DashboardService(mockDb as PrismaService);
  });

  it('safely handles division-by-zero (AOV, refund rate, conversion, repeat rate return null, never NaN)', async () => {
    // Mock zero data across all tables
    mockDb.$queryRaw.mockImplementation((query: any) => {
      const qStr = query?.strings?.join(' ') ?? '';
      if (qStr.includes('COALESCE(SUM(net)')) {
        return Promise.resolve([
          {
            current_net: new Prisma.Decimal(0),
            current_gross: new Prisma.Decimal(0),
            current_refunds: new Prisma.Decimal(0),
            current_orders: BigInt(0),
            pending_orders: BigInt(0),
            confirmed_orders: BigInt(0),
            processing_orders: BigInt(0),
            shipped_orders: BigInt(0),
            delivered_orders: BigInt(0),
            cancelled_orders: BigInt(0),
            current_purchases: BigInt(0),
            prev_net: new Prisma.Decimal(0),
            prev_gross: new Prisma.Decimal(0),
            prev_refunds: new Prisma.Decimal(0),
            prev_orders: BigInt(0),
            prev_purchases: BigInt(0),
            month_net: new Prisma.Decimal(0),
          },
        ]);
      }
      if (qStr.includes('FROM inventories')) {
        return Promise.resolve([{ total: BigInt(0), low_stock: BigInt(0), out_of_stock: BigInt(0) }]);
      }
      if (qStr.includes('WITH buyers AS')) {
        return Promise.resolve([{ active: BigInt(0), returning: BigInt(0), buyers: BigInt(0), repeat: BigInt(0) }]);
      }
      return Promise.resolve([]);
    });

    const result = (await service.overview({ range: '7d', compare: 'prev_period' }, 'ADMIN')) as any;

    expect(result.totals.orders).toBe(0);
    expect(result.totals.aov).toBeNull();
    expect(result.totals.refundRate).toBeNull();
    expect(result.totals.conversionRate).toBeNull();
    expect(result.customers.repeatRate).toBeNull();
    expect(result.funnel.dropOffRates.viewToCart).toBeNull();
    expect(result.funnel.dropOffRates.cartToCheckout).toBeNull();
    expect(result.funnel.dropOffRates.checkoutToPurchase).toBeNull();
  });

  it('calculates net sales formula: gross - refunds - cancelled', async () => {
    mockDb.$queryRaw.mockImplementation((query: any) => {
      const qStr = query?.strings?.join(' ') ?? '';
      if (qStr.includes('COALESCE(SUM(net)')) {
        return Promise.resolve([
          {
            current_net: new Prisma.Decimal(8000), // 10000 gross - 2000 refunds
            current_gross: new Prisma.Decimal(10000),
            current_refunds: new Prisma.Decimal(2000),
            current_orders: BigInt(5),
            pending_orders: BigInt(1),
            confirmed_orders: BigInt(1),
            processing_orders: BigInt(1),
            shipped_orders: BigInt(1),
            delivered_orders: BigInt(1),
            cancelled_orders: BigInt(0),
            current_purchases: BigInt(5),
            prev_net: new Prisma.Decimal(4000),
            prev_gross: new Prisma.Decimal(4000),
            prev_refunds: new Prisma.Decimal(0),
            prev_orders: BigInt(2),
            prev_purchases: BigInt(2),
            month_net: new Prisma.Decimal(8000),
          },
        ]);
      }
      if (qStr.includes('FROM inventories')) {
        return Promise.resolve([{ total: BigInt(100), low_stock: BigInt(2), out_of_stock: BigInt(1) }]);
      }
      if (qStr.includes('WITH buyers AS')) {
        return Promise.resolve([{ active: BigInt(10), returning: BigInt(2), buyers: BigInt(5), repeat: BigInt(2) }]);
      }
      return Promise.resolve([]);
    });

    const result = (await service.overview({ range: '7d', compare: 'prev_period' }, 'ADMIN')) as any;

    expect(result.totals.sales).toBe('8000.00');
    expect(result.totals.orders).toBe(5);
    expect(result.totals.aov).toBe('1600.00'); // 8000 / 5
    expect(result.totals.refundRate).toBe(20); // 2000 / 10000 * 100
    expect(result.comparison.deltas.sales).toBe(100); // (8000 - 4000) / 4000 * 100
  });

  it('enforces role privacy: strips ALL revenue fields when role is STAFF', async () => {
    mockDb.$queryRaw.mockImplementation((query: any) => {
      const qStr = query?.strings?.join(' ') ?? '';
      if (qStr.includes('COALESCE(SUM(net)')) {
        return Promise.resolve([
          {
            current_net: new Prisma.Decimal(50000),
            current_gross: new Prisma.Decimal(55000),
            current_refunds: new Prisma.Decimal(5000),
            current_orders: BigInt(20),
            pending_orders: BigInt(5),
            confirmed_orders: BigInt(5),
            processing_orders: BigInt(5),
            shipped_orders: BigInt(3),
            delivered_orders: BigInt(2),
            cancelled_orders: BigInt(0),
            current_purchases: BigInt(20),
            prev_net: new Prisma.Decimal(30000),
            prev_gross: new Prisma.Decimal(30000),
            prev_refunds: new Prisma.Decimal(0),
            prev_orders: BigInt(10),
            prev_purchases: BigInt(10),
            month_net: new Prisma.Decimal(50000),
          },
        ]);
      }
      if (qStr.includes('SELECT to_char')) {
        return Promise.resolve([
          { day: '2026-11-01', revenue: new Prisma.Decimal(5000), orders: BigInt(2) },
        ]);
      }
      if (qStr.includes('FROM inventories')) {
        return Promise.resolve([{ total: BigInt(50), low_stock: BigInt(3), out_of_stock: BigInt(0) }]);
      }
      if (qStr.includes('WITH buyers AS')) {
        return Promise.resolve([{ active: BigInt(15), returning: BigInt(3), buyers: BigInt(10), repeat: BigInt(4) }]);
      }
      if (qStr.includes('COALESCE(c.name')) {
        return Promise.resolve([{ name: 'Electronics', amount: new Prisma.Decimal(30000) }]);
      }
      if (qStr.includes('skuSnapshot') || qStr.includes('order_items i')) {
        return Promise.resolve([
          {
            id: 'prod-1',
            name: 'Smartphone',
            sku: 'SP-1',
            image: null,
            units: BigInt(5),
            revenue: new Prisma.Decimal(25000),
          },
        ]);
      }
      if (qStr.includes('paymentMethod')) {
        return Promise.resolve([
          { method: 'BKASH', count: BigInt(10), amount: new Prisma.Decimal(25000) },
        ]);
      }
      if (qStr.includes('order_addresses a') || qStr.includes('district')) {
        return Promise.resolve([
          { district: 'Dhaka', orders: BigInt(12), revenue: new Prisma.Decimal(30000) },
        ]);
      }
      return Promise.resolve([]);
    });

    mockDb.order.findMany.mockResolvedValue([
      {
        id: 'ord-1',
        orderNumber: 'ORD-1001',
        customerName: 'Rahim',
        status: 'DELIVERED',
        paymentMethod: 'BKASH',
        paymentStatus: 'PAID',
        grandTotal: new Prisma.Decimal(2500),
        createdAt: new Date('2026-11-01T10:00:00Z'),
        _count: { items: 2 },
      },
    ]);

    const result = (await service.overview({ range: '7d', compare: 'prev_period' }, 'STAFF')) as any;

    // Totals revenue stripped
    expect(result.totals.sales).toBeNull();
    expect(result.totals.aov).toBeNull();
    expect(result.totals.refundRate).toBeNull();
    // Non-revenue totals retained
    expect(result.totals.orders).toBe(20);
    expect(result.totals.inventory).toBe(50);

    // Comparison revenue stripped
    expect(result.comparison.sales).toBeNull();
    expect(result.comparison.aov).toBeNull();
    expect(result.comparison.refundRate).toBeNull();
    expect(result.comparison.deltas.sales).toBeNull();
    expect(result.comparison.deltas.aov).toBeNull();
    expect(result.comparison.deltas.orders).toBe(100);

    // Revenue buckets stripped
    expect(result.revenue[0].revenue).toBeNull();
    expect(result.revenue[0].aov).toBeNull();
    expect(result.revenue[0].orders).toBeDefined();

    // Target stripped
    expect(result.target.amount).toBeNull();
    expect(result.target.achieved).toBeNull();
    expect(result.target.remaining).toBeNull();
    expect(result.target.runRateNeeded).toBeNull();

    // Widget arrays stripped
    expect(result.categories[0].amount).toBeNull();
    expect(result.topProducts[0].revenue).toBeNull();
    expect(result.recentOrders[0].grandTotal).toBeNull();
    expect(result.paymentMethods[0].amount).toBeNull();
    expect(result.geoDistricts[0].revenue).toBeNull();
  });

  it('persists and resets custom dashboard layout per user', async () => {
    mockDb.dashboardLayout.upsert.mockResolvedValue({
      userId: 'user-1',
      layout: { order: ['sales', 'orders', 'revenue'] },
      updatedAt: new Date(),
    });
    mockDb.dashboardLayout.findUnique.mockResolvedValue({
      layout: { order: ['sales', 'orders', 'revenue'] },
    });

    const saveRes = await service.saveLayout('user-1', { order: ['sales', 'orders', 'revenue'] });
    expect(saveRes.ok).toBe(true);
    expect(mockDb.dashboardLayout.upsert).toHaveBeenCalled();

    const getRes = await service.getLayout('user-1');
    expect(getRes).toEqual({ order: ['sales', 'orders', 'revenue'] });

    const resetRes = await service.resetLayout('user-1');
    expect(resetRes.ok).toBe(true);
    expect(mockDb.dashboardLayout.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });
});
