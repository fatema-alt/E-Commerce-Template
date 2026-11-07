import { Injectable } from '@nestjs/common';
import { Subject, Observable, interval, merge } from 'rxjs';
import { map } from 'rxjs/operators';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DashboardQueryDto } from './dashboard.dto.js';

export interface DashboardEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export function dashboardWindow(now = new Date()) {
  const local = new Date(now.getTime() + 6 * 3600000);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const day = local.getUTCDate();
  const start = new Date(Date.UTC(year, month, 1) - 6 * 3600000);
  const end = new Date(Date.UTC(year, month + 1, 1) - 6 * 3600000);
  const today = new Date(Date.UTC(year, month, day) - 6 * 3600000);
  return {
    start,
    end,
    month: `${year}-${String(month + 1).padStart(2, '0')}`,
    days: Array.from(
      { length: 7 },
      (_, i) => new Date(today.getTime() - (6 - i) * 86400000),
    ),
    activeSince: new Date(now.getTime() - 30 * 86400000),
  };
}

export function resolveTimeRange(
  range: DashboardQueryDto['range'] = '7d',
  fromStr?: string,
  toStr?: string,
  now = new Date(),
) {
  const dhakaOffset = 6 * 3600000;
  const dhakaNow = new Date(now.getTime() + dhakaOffset);
  const y = dhakaNow.getUTCFullYear();
  const m = dhakaNow.getUTCMonth();
  const d = dhakaNow.getUTCDate();

  const startOfDhakaToday = new Date(Date.UTC(y, m, d) - dhakaOffset);
  const endOfDhakaToday = new Date(Date.UTC(y, m, d + 1) - dhakaOffset);

  let start: Date;
  let end: Date;

  if (range === 'today') {
    start = startOfDhakaToday;
    end = endOfDhakaToday;
  } else if (range === '7d') {
    start = new Date(startOfDhakaToday.getTime() - 6 * 86400000);
    end = endOfDhakaToday;
  } else if (range === '30d') {
    start = new Date(startOfDhakaToday.getTime() - 29 * 86400000);
    end = endOfDhakaToday;
  } else if (range === '90d') {
    start = new Date(startOfDhakaToday.getTime() - 89 * 86400000);
    end = endOfDhakaToday;
  } else if (range === 'this_month') {
    start = new Date(Date.UTC(y, m, 1) - dhakaOffset);
    end = new Date(Date.UTC(y, m + 1, 1) - dhakaOffset);
  } else if (range === 'custom' && fromStr && toStr) {
    start = new Date(fromStr);
    end = new Date(toStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      start = new Date(startOfDhakaToday.getTime() - 6 * 86400000);
      end = endOfDhakaToday;
    }
  } else {
    start = new Date(startOfDhakaToday.getTime() - 6 * 86400000);
    end = endOfDhakaToday;
  }

  const duration = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - duration);
  const prevEnd = start;

  const monthStart = new Date(Date.UTC(y, m, 1) - dhakaOffset);
  const monthEnd = new Date(Date.UTC(y, m + 1, 1) - dhakaOffset);

  const days: string[] = [];
  const curr = new Date(start.getTime());
  while (curr.getTime() < end.getTime()) {
    const dhakaCurr = new Date(curr.getTime() + dhakaOffset);
    const dayStr = dhakaCurr.toISOString().slice(0, 10);
    if (!days.includes(dayStr)) {
      days.push(dayStr);
    }
    curr.setTime(curr.getTime() + 86400000);
  }

  const currentMonthStr = `${y}-${String(m + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const daysLeft = Math.max(0, daysInMonth - d);

  return {
    start,
    end,
    prevStart,
    prevEnd,
    monthStart,
    monthEnd,
    days,
    month: currentMonthStr,
    daysLeft,
    activeSince: new Date(now.getTime() - 30 * 86400000),
  };
}

const salesSql = Prisma.sql`WITH refunds AS (
  SELECT "orderId", SUM(amount) AS amount FROM order_payment_transactions
  WHERE type='REFUND' AND status='SUCCEEDED' GROUP BY "orderId"
), sales AS (
  SELECT o.*,
    CASE WHEN o.status='CANCELLED' THEN 0 ELSE o."grandTotal"-COALESCE(r.amount,0) END AS net,
    COALESCE(r.amount,0) AS refund_amount
  FROM orders o LEFT JOIN refunds r ON r."orderId"=o.id WHERE o.currency='BDT'
)`;

function calcDelta(current: number, prev: number): number | null {
  if (prev === 0) {
    return current > 0 ? 100 : current === 0 ? 0 : null;
  }
  return Number((((current - prev) / prev) * 100).toFixed(1));
}

@Injectable()
export class DashboardService {
  private readonly events$ = new Subject<{ data: string }>();
  private readonly cache = new Map<string, { expiresAt: number; data: unknown }>();

  constructor(private readonly db: PrismaService) {}

  emitEvent(type: string, data: Record<string, unknown>) {
    this.events$.next({
      data: JSON.stringify({
        type,
        data,
        timestamp: new Date().toISOString(),
      }),
    });
  }

  eventStream(): Observable<{ data: string }> {
    const ping$ = interval(25000).pipe(
      map(() => ({
        data: JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }),
      })),
    );
    return merge(this.events$.asObservable(), ping$);
  }

  async getLayout(userId: string) {
    const record = await this.db.dashboardLayout.findUnique({
      where: { userId },
    });
    return record?.layout ?? null;
  }

  async saveLayout(userId: string, layout: unknown) {
    const updated = await this.db.dashboardLayout.upsert({
      where: { userId },
      create: { userId, layout: layout as Prisma.InputJsonValue },
      update: { layout: layout as Prisma.InputJsonValue },
    });
    return { ok: true, updatedAt: updated.updatedAt };
  }

  async resetLayout(userId: string) {
    await this.db.dashboardLayout.deleteMany({
      where: { userId },
    });
    return { ok: true };
  }

  async overview(query: DashboardQueryDto = new DashboardQueryDto(), role = 'ADMIN') {
    const range = resolveTimeRange(query.range, query.from, query.to);
    const cacheKey = `${role}:${query.range}:${query.from ?? ''}:${query.to ?? ''}:${query.compare}`;

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const { start, end, prevStart, prevEnd, monthStart, monthEnd } = range;

    const [
      totalsRows,
      bucketsRows,
      inventoryRows,
      categoriesRows,
      topProductsRows,
      customerActivityRows,
      funnelEventsRows,
      trafficSourcesRows,
      lowStockRows,
      paymentMethodsRows,
      geoDistrictsRows,
      recentOrdersRows,
      orderEventsRows,
      reviewsRows,
      targetRecord,
      newCustomersCurrent,
      newCustomersPrev,
      pendingOrdersCount,
      failedPaymentsCount,
      pendingReviewsCount,
    ] = await Promise.all([
      // 1. Totals & previous period query
      this.db.$queryRaw<
        {
          current_net: Prisma.Decimal;
          current_gross: Prisma.Decimal;
          current_refunds: Prisma.Decimal;
          current_orders: bigint;
          pending_orders: bigint;
          confirmed_orders: bigint;
          processing_orders: bigint;
          shipped_orders: bigint;
          delivered_orders: bigint;
          cancelled_orders: bigint;
          current_purchases: bigint;
          prev_net: Prisma.Decimal;
          prev_gross: Prisma.Decimal;
          prev_refunds: Prisma.Decimal;
          prev_orders: bigint;
          prev_purchases: bigint;
          month_net: Prisma.Decimal;
        }[]
      >(Prisma.sql`${salesSql}
        SELECT
          COALESCE(SUM(net) FILTER(WHERE "createdAt">=${start} AND "createdAt"<${end}),0) AS current_net,
          COALESCE(SUM("grandTotal") FILTER(WHERE "createdAt">=${start} AND "createdAt"<${end} AND status<>'CANCELLED'),0) AS current_gross,
          COALESCE(SUM(refund_amount) FILTER(WHERE "createdAt">=${start} AND "createdAt"<${end}),0) AS current_refunds,
          COUNT(*) FILTER(WHERE "createdAt">=${start} AND "createdAt"<${end}) AS current_orders,
          COUNT(*) FILTER(WHERE "createdAt">=${start} AND "createdAt"<${end} AND status='PENDING') AS pending_orders,
          COUNT(*) FILTER(WHERE "createdAt">=${start} AND "createdAt"<${end} AND status='CONFIRMED') AS confirmed_orders,
          COUNT(*) FILTER(WHERE "createdAt">=${start} AND "createdAt"<${end} AND status='PROCESSING') AS processing_orders,
          COUNT(*) FILTER(WHERE "createdAt">=${start} AND "createdAt"<${end} AND status='SHIPPED') AS shipped_orders,
          COUNT(*) FILTER(WHERE "createdAt">=${start} AND "createdAt"<${end} AND status='DELIVERED') AS delivered_orders,
          COUNT(*) FILTER(WHERE "createdAt">=${start} AND "createdAt"<${end} AND status='CANCELLED') AS cancelled_orders,
          COUNT(*) FILTER(WHERE "createdAt">=${start} AND "createdAt"<${end} AND status<>'CANCELLED') AS current_purchases,

          COALESCE(SUM(net) FILTER(WHERE "createdAt">=${prevStart} AND "createdAt"<${prevEnd}),0) AS prev_net,
          COALESCE(SUM("grandTotal") FILTER(WHERE "createdAt">=${prevStart} AND "createdAt"<${prevEnd} AND status<>'CANCELLED'),0) AS prev_gross,
          COALESCE(SUM(refund_amount) FILTER(WHERE "createdAt">=${prevStart} AND "createdAt"<${prevEnd}),0) AS prev_refunds,
          COUNT(*) FILTER(WHERE "createdAt">=${prevStart} AND "createdAt"<${prevEnd}) AS prev_orders,
          COUNT(*) FILTER(WHERE "createdAt">=${prevStart} AND "createdAt"<${prevEnd} AND status<>'CANCELLED') AS prev_purchases,

          COALESCE(SUM(net) FILTER(WHERE "createdAt">=${monthStart} AND "createdAt"<${monthEnd}),0) AS month_net
        FROM sales`),

      // 2. Daily revenue buckets
      this.db.$queryRaw<{ day: string; revenue: Prisma.Decimal; orders: bigint }[]>(
        Prisma.sql`${salesSql}
        SELECT to_char("createdAt" AT TIME ZONE 'Asia/Dhaka','YYYY-MM-DD') AS day,
        SUM(net) AS revenue, COUNT(*) AS orders FROM sales
        WHERE "createdAt">=${start} AND "createdAt"<${end}
        GROUP BY day ORDER BY day`,
      ),

      // 3. Inventory summary
      this.db.$queryRaw<{ total: bigint; low_stock: bigint; out_of_stock: bigint }[]>(
        Prisma.sql`SELECT
          COALESCE(SUM(i.quantity),0)::bigint AS total,
          COUNT(*) FILTER(WHERE i.quantity > 0 AND i.quantity <= i."lowStockAt")::bigint AS low_stock,
          COUNT(*) FILTER(WHERE i.quantity <= 0)::bigint AS out_of_stock
        FROM inventories i
        LEFT JOIN products p ON p.id=i."productId"
        LEFT JOIN product_variants v ON v.id=i."variantId"
        LEFT JOIN products vp ON vp.id=v."productId"
        WHERE (p.type='SIMPLE' AND p."deletedAt" IS NULL) OR (vp.type='VARIABLE' AND vp."deletedAt" IS NULL)`,
      ),

      // 4. Categories ranking
      this.db.$queryRaw<{ name: string; amount: Prisma.Decimal }[]>(
        Prisma.sql`${salesSql}, item_totals AS (
          SELECT "orderId", SUM("lineTotal") AS amount FROM order_items GROUP BY "orderId"
        ) SELECT COALESCE(c.name,'Uncategorized') AS name,
          SUM(CASE WHEN t.amount>0 THEN s.net*i."lineTotal"/t.amount ELSE 0 END) AS amount
          FROM sales s JOIN order_items i ON i."orderId"=s.id JOIN item_totals t ON t."orderId"=s.id
          LEFT JOIN products p ON p.id=i."productId" LEFT JOIN categories c ON c.id=p."categoryId"
          WHERE s."createdAt">=${start} AND s."createdAt"<${end} AND s.status<>'CANCELLED'
          GROUP BY c.id, c.name ORDER BY amount DESC LIMIT 5`,
      ),

      // 5. Top products
      this.db.$queryRaw<
        {
          id: string;
          name: string;
          sku: string;
          image: string | null;
          units: bigint;
          revenue: Prisma.Decimal;
        }[]
      >(
        Prisma.sql`SELECT
          COALESCE(p.id, i."productId", '') AS id,
          i."nameSnapshot" AS name,
          i."skuSnapshot" AS sku,
          (SELECT url FROM product_images WHERE "productId"=p.id ORDER BY "isPrimary" DESC, "sortOrder" ASC LIMIT 1) AS image,
          SUM(i.quantity)::bigint AS units,
          SUM(i."lineTotal") AS revenue
        FROM order_items i
        JOIN orders o ON o.id=i."orderId"
        LEFT JOIN products p ON p.id=i."productId"
        WHERE o."createdAt">=${start} AND o."createdAt"<${end} AND o.status<>'CANCELLED' AND o.currency='BDT'
        GROUP BY p.id, i."productId", i."nameSnapshot", i."skuSnapshot"
        ORDER BY units DESC, revenue DESC LIMIT 5`,
      ),

      // 6. Customer activity
      this.db.$queryRaw<
        { active: bigint; returning: bigint; buyers: bigint; repeat: bigint }[]
      >(
        Prisma.sql`WITH buyers AS (
          SELECT "customerId", COUNT(*) AS orders, MIN("createdAt") AS first, MAX("createdAt") AS last,
            BOOL_OR("createdAt">=${start} AND "createdAt"<${end}) AS in_period
          FROM orders WHERE "customerId" IS NOT NULL AND status<>'CANCELLED' GROUP BY "customerId"
        ) SELECT
          COUNT(*) FILTER(WHERE b.last>=${range.activeSince}) AS active,
          COUNT(*) FILTER(WHERE b.in_period AND b.first<${start}) AS returning,
          COUNT(*) AS buyers,
          COUNT(*) FILTER(WHERE b.orders>1) AS repeat
        FROM buyers b JOIN customers c ON c.id=b."customerId" WHERE c."deletedAt" IS NULL`,
      ),

      // 7. Funnel events
      this.db.$queryRaw<{ kind: string; count: bigint }[]>(
        Prisma.sql`SELECT kind, COUNT(DISTINCT "sessionId") AS count FROM analytics_events
        WHERE "createdAt">=${start} AND "createdAt"<${end} GROUP BY kind`,
      ),

      // 8. Traffic sources
      this.db.$queryRaw<{ source: string; count: bigint }[]>(
        Prisma.sql`SELECT s.source, COUNT(DISTINCT e."sessionId") AS count FROM analytics_events e
        JOIN analytics_sessions s ON s.id=e."sessionId" WHERE e."createdAt">=${start} AND e."createdAt"<${end}
        GROUP BY s.source`,
      ),

      // 9. Low stock alerts
      this.db.$queryRaw<
        {
          id: string;
          name: string;
          sku: string;
          quantity: number;
          lowStockAt: number;
          isOutOfStock: boolean;
        }[]
      >(
        Prisma.sql`SELECT
          i.id,
          COALESCE(p.name, vp.name, 'Unnamed Product') AS name,
          COALESCE(p.sku, v.sku, '') AS sku,
          i.quantity,
          i."lowStockAt",
          (i.quantity <= 0) AS "isOutOfStock"
        FROM inventories i
        LEFT JOIN products p ON p.id=i."productId"
        LEFT JOIN product_variants v ON v.id=i."variantId"
        LEFT JOIN products vp ON vp.id=v."productId"
        WHERE ((p.type='SIMPLE' AND p."deletedAt" IS NULL) OR (vp.type='VARIABLE' AND vp."deletedAt" IS NULL))
          AND i.quantity <= i."lowStockAt"
        ORDER BY i.quantity ASC, i."updatedAt" DESC LIMIT 6`,
      ),

      // 10. Payment methods split
      this.db.$queryRaw<
        { method: string; count: bigint; amount: Prisma.Decimal }[]
      >(
        Prisma.sql`SELECT
          "paymentMethod" AS method,
          COUNT(*)::bigint AS count,
          SUM(CASE WHEN status<>'CANCELLED' THEN "grandTotal" ELSE 0 END) AS amount
        FROM orders
        WHERE "createdAt">=${start} AND "createdAt"<${end}
        GROUP BY "paymentMethod" ORDER BY count DESC`,
      ),

      // 11. Geo districts split
      this.db.$queryRaw<
        { district: string; orders: bigint; revenue: Prisma.Decimal }[]
      >(
        Prisma.sql`WITH geo AS (
          SELECT
            o.id,
            o."grandTotal",
            o.status,
            COALESCE(NULLIF(TRIM(a.district), ''), NULLIF(TRIM(a.city), ''), 'Unknown') AS district
          FROM orders o
          JOIN order_addresses a ON a."orderId"=o.id AND a.type='SHIPPING'
          WHERE o."createdAt">=${start} AND o."createdAt"<${end}
        )
        SELECT
          district,
          COUNT(DISTINCT id)::bigint AS orders,
          SUM(CASE WHEN status<>'CANCELLED' THEN "grandTotal" ELSE 0 END) AS revenue
        FROM geo
        GROUP BY district
        ORDER BY orders DESC, revenue DESC LIMIT 6`,
      ),

      // 12. Recent orders
      this.db.order.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          status: true,
          paymentMethod: true,
          paymentStatus: true,
          grandTotal: true,
          createdAt: true,
          _count: { select: { items: true } },
        },
      }),

      // 13. Order events for activity feed
      this.db.orderEvent.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        include: { order: { select: { orderNumber: true, customerName: true } } },
      }),

      // 14. Product reviews for activity feed
      this.db.productReview.findMany({
        take: 4,
        orderBy: { createdAt: 'desc' },
        include: { product: { select: { name: true } } },
      }),

      // 15. Dashboard target
      this.db.dashboardTarget.findUnique({
        where: { month: range.month },
      }),

      // 16. Customers created in current period
      this.db.customer.count({
        where: { deletedAt: null, createdAt: { gte: start, lt: end } },
      }),

      // 17. Customers created in previous period
      this.db.customer.count({
        where: { deletedAt: null, createdAt: { gte: prevStart, lt: prevEnd } },
      }),

      // 18. Pending orders notification count
      this.db.order.count({ where: { status: 'PENDING' } }),

      // 19. Failed payments notification count
      this.db.orderPaymentTransaction.count({ where: { status: 'FAILED' } }),

      // 20. Pending reviews notification count
      this.db.productReview.count({ where: { status: 'PENDING' } }),
    ]);

    const totals = totalsRows[0] ?? {
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
    };

    const inv = inventoryRows[0] ?? { total: BigInt(0), low_stock: BigInt(0), out_of_stock: BigInt(0) };
    const act = customerActivityRows[0] ?? { active: BigInt(0), returning: BigInt(0), buyers: BigInt(0), repeat: BigInt(0) };

    const currentNetSales = Number(totals.current_net);
    const prevNetSales = Number(totals.prev_net);
    const currentOrders = Number(totals.current_orders);
    const prevOrders = Number(totals.prev_orders);
    const currentGross = Number(totals.current_gross);
    const prevGross = Number(totals.prev_gross);
    const currentRefunds = Number(totals.current_refunds);
    const prevRefunds = Number(totals.prev_refunds);

    const currentPurchases = Number(totals.current_purchases);
    const productViews = Number(funnelEventsRows.find((e) => e.kind === 'PRODUCT_VIEW')?.count ?? 0);
    const addedToCart = Number(funnelEventsRows.find((e) => e.kind === 'ADD_TO_CART')?.count ?? 0);
    const checkout = Number(funnelEventsRows.find((e) => e.kind === 'CHECKOUT')?.count ?? 0);

    const currentConversionRate = productViews > 0 ? (currentPurchases / productViews) * 100 : null;
    const prevConversionRate = null;

    const currentAov = currentOrders > 0 ? currentNetSales / currentOrders : null;
    const prevAov = prevOrders > 0 ? prevNetSales / prevOrders : null;

    const currentRefundRate = currentGross > 0 ? (currentRefunds / currentGross) * 100 : null;
    const prevRefundRate = prevGross > 0 ? (prevRefunds / prevGross) * 100 : null;

    const totalBuyers = Number(act.buyers);
    const repeatRate = totalBuyers > 0 ? (Number(act.repeat) / totalBuyers) * 100 : null;

    // Zero-fill daily revenue chart buckets
    const revenueBuckets = range.days.map((day) => {
      const found = bucketsRows.find((b) => b.day === day);
      const rev = found ? Number(found.revenue) : 0;
      const ord = found ? Number(found.orders) : 0;
      return {
        day,
        revenue: rev.toFixed(2),
        orders: ord,
        aov: ord > 0 ? (rev / ord).toFixed(2) : '0.00',
      };
    });

    // 7-point sparkline for each KPI card (last 7 days or points)
    const sparklineDays = revenueBuckets.slice(-7);
    const sparklines = {
      sales: sparklineDays.map((d) => Number(d.revenue)),
      orders: sparklineDays.map((d) => d.orders),
      customers: Array.from({ length: 7 }, () => Math.round(newCustomersCurrent / 7)),
      inventory: Array.from({ length: 7 }, () => Number(inv.total)),
      aov: sparklineDays.map((d) => Number(d.aov)),
      refundRate: sparklineDays.map(() => (currentRefundRate ?? 0)),
      conversionRate: sparklineDays.map(() => (currentConversionRate ?? 0)),
    };

    // Monthly Target calculations
    const targetAmount = targetRecord ? Number(targetRecord.amount) : null;
    const monthAchieved = Number(totals.month_net);
    const targetRemaining = targetAmount !== null ? Math.max(0, targetAmount - monthAchieved) : null;
    const runRateNeeded =
      targetRemaining !== null && range.daysLeft > 0
        ? targetRemaining / range.daysLeft
        : targetRemaining !== null
          ? targetRemaining
          : null;
    const targetProgress =
      targetAmount && targetAmount > 0
        ? Math.min(100, Math.max(0, (monthAchieved / targetAmount) * 100))
        : 0;

    // Category shares
    const totalCatAmount = categoriesRows.reduce((sum, c) => sum + Math.max(0, Number(c.amount)), 0);
    const categories = categoriesRows.map((c) => {
      const amt = Math.max(0, Number(c.amount));
      return {
        name: c.name,
        amount: amt.toFixed(2),
        share: totalCatAmount > 0 ? Number(((amt / totalCatAmount) * 100).toFixed(1)) : 0,
      };
    });

    // Top products
    const topProducts = topProductsRows.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      image: p.image,
      units: Number(p.units),
      revenue: Number(p.revenue).toFixed(2),
    }));

    // Traffic sources with shares
    const allKnownSources = ['direct', 'organic', 'social', 'referral', 'email', 'paid'];
    const totalSourceSessions = trafficSourcesRows.reduce((sum, s) => sum + Number(s.count), 0);
    const sources = allKnownSources.map((src) => {
      const found = trafficSourcesRows.find((s) => s.source === src);
      const count = found ? Number(found.count) : 0;
      return {
        source: src,
        count,
        share: totalSourceSessions > 0 ? Number(((count / totalSourceSessions) * 100).toFixed(1)) : 0,
      };
    });

    // Payment methods with shares
    const totalPaymentAmount = paymentMethodsRows.reduce((sum, p) => sum + Math.max(0, Number(p.amount)), 0);
    const paymentMethods = paymentMethodsRows.map((p) => {
      const amt = Math.max(0, Number(p.amount));
      return {
        method: p.method,
        count: Number(p.count),
        amount: amt.toFixed(2),
        share: totalPaymentAmount > 0 ? Number(((amt / totalPaymentAmount) * 100).toFixed(1)) : 0,
      };
    });

    // Geo districts with shares
    const geoDistricts = geoDistrictsRows.map((g) => ({
      district: g.district,
      orders: Number(g.orders),
      revenue: Number(g.revenue).toFixed(2),
    }));

    // Activity feed merging order events and reviews
    const activityFeed = [
      ...orderEventsRows.map((e) => ({
        id: e.id,
        type: 'order',
        title: `Order ${e.order.orderNumber} ${e.action.toLowerCase()}`,
        description: `Customer: ${e.order.customerName}`,
        timestamp: e.createdAt.toISOString(),
      })),
      ...reviewsRows.map((r) => ({
        id: r.id,
        type: 'review',
        title: `New review on ${r.product.name}`,
        description: `Rating: ${r.rating}★ - "${r.title || r.content.slice(0, 40)}"`,
        timestamp: r.createdAt.toISOString(),
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 8);

    // Notifications
    const notifications: Array<{
      id: string;
      type: 'order' | 'low_stock' | 'payment_failed' | 'review';
      title: string;
      message: string;
      time: string;
      createdAt: string;
      read: boolean;
      link: string;
      targetUrl: string;
    }> = [];

    // 1. Recent & Pending Orders
    for (const o of (recentOrdersRows || []).slice(0, 8)) {
      const displayNo = this.getOrderDisplay(o.orderNumber, o.id);
      const isPending = o.status === 'PENDING';
      const title = isPending ? `New Order: ${displayNo}` : `Order ${displayNo} (${o.status.replaceAll('_', ' ')})`;
      const amount = Number(o.grandTotal ?? 0).toLocaleString();
      const message = `${o.customerName} placed order for BDT ${amount}${isPending ? ' — Awaiting confirmation' : ''}`;
      const targetUrl = `/orders?highlight=${encodeURIComponent(displayNo)}&notiTitle=${encodeURIComponent(title)}&notiMsg=${encodeURIComponent(message)}`;

      notifications.push({
        id: `order-${o.id}`,
        type: 'order',
        title,
        message,
        time: this.formatTimeAgo(o.createdAt),
        createdAt: new Date(o.createdAt).toISOString(),
        read: false,
        link: targetUrl,
        targetUrl,
      });
    }

    // 2. Low Stock Alerts
    for (const item of (lowStockRows || []).slice(0, 6)) {
      const isOut = Number(item.quantity) <= 0;
      const prodName = item.variantName ? `${item.productName} (${item.variantName})` : item.productName;
      const title = isOut ? `Out of Stock: ${prodName}` : `Low Stock Alert: ${prodName}`;
      const message = isOut
        ? 'Product is completely sold out! Restock needed immediately.'
        : `Only ${item.quantity} units remaining in inventory (Threshold: ${item.lowStockAt})`;
      const targetUrl = `/inventory?highlight=${encodeURIComponent(item.productName)}&q=${encodeURIComponent(item.sku || item.productName)}&notiTitle=${encodeURIComponent(title)}&notiMsg=${encodeURIComponent(message)}`;

      notifications.push({
        id: `stock-${item.productId}-${item.sku}`,
        type: 'low_stock',
        title,
        message,
        time: isOut ? 'Out of stock' : 'Low stock',
        createdAt: new Date().toISOString(),
        read: false,
        link: targetUrl,
        targetUrl,
      });
    }

    // 3. Pending Reviews
    for (const r of (reviewsRows || []).slice(0, 5)) {
      const prodName = r.product?.name || 'Product';
      const title = `New Review (${r.rating}★): ${prodName}`;
      const snippet = r.title || (r.content ? r.content.slice(0, 45) : 'Customer review');
      const message = `"${snippet}" awaiting review moderation`;
      const targetUrl = `/reviews?status=PENDING&highlight=${encodeURIComponent(r.id)}&notiTitle=${encodeURIComponent(title)}&notiMsg=${encodeURIComponent(message)}`;

      notifications.push({
        id: `review-${r.id}`,
        type: 'review',
        title,
        message,
        time: this.formatTimeAgo(r.createdAt),
        createdAt: new Date(r.createdAt).toISOString(),
        read: false,
        link: targetUrl,
        targetUrl,
      });
    }

    // 4. Failed payments
    if (failedPaymentsCount > 0) {
      const title = `${failedPaymentsCount} payment attempt${failedPaymentsCount > 1 ? 's' : ''} failed`;
      const message = 'Transactions flagged as failed in payment gateway';
      const targetUrl = `/orders?paymentStatus=UNPAID&notiTitle=${encodeURIComponent(title)}&notiMsg=${encodeURIComponent(message)}`;
      notifications.push({
        id: 'failed-payments-summary',
        type: 'payment_failed',
        title,
        message,
        time: 'Finance alert',
        createdAt: new Date().toISOString(),
        read: false,
        link: targetUrl,
        targetUrl,
      });
    }

    // Response structure
    const isStaff = role === 'STAFF';

    const response = {
      updatedAt: new Date().toISOString(),
      currency: 'BDT',
      currencySymbol: '৳',
      timezone: 'Asia/Dhaka',
      month: range.month,
      range: query.range,
      role,
      totals: {
        sales: isStaff ? null : currentNetSales.toFixed(2),
        orders: currentOrders,
        customers: newCustomersCurrent,
        inventory: Number(inv.total),
        lowStockCount: Number(inv.low_stock),
        outOfStockCount: Number(inv.out_of_stock),
        aov: isStaff || currentAov === null ? null : currentAov.toFixed(2),
        refundRate: isStaff || currentRefundRate === null ? null : Number(currentRefundRate.toFixed(1)),
        conversionRate: currentConversionRate !== null ? Number(currentConversionRate.toFixed(1)) : null,
        breakdown: {
          pending: Number(totals.pending_orders),
          confirmed: Number(totals.confirmed_orders),
          processing: Number(totals.processing_orders),
          shipped: Number(totals.shipped_orders),
          delivered: Number(totals.delivered_orders),
          cancelled: Number(totals.cancelled_orders),
        },
      },
      comparison: {
        sales: isStaff ? null : prevNetSales.toFixed(2),
        orders: prevOrders,
        customers: newCustomersPrev,
        aov: isStaff || prevAov === null ? null : prevAov.toFixed(2),
        refundRate: isStaff || prevRefundRate === null ? null : Number(prevRefundRate.toFixed(1)),
        conversionRate: prevConversionRate,
        deltas: {
          sales: isStaff ? null : calcDelta(currentNetSales, prevNetSales),
          orders: calcDelta(currentOrders, prevOrders),
          customers: calcDelta(newCustomersCurrent, newCustomersPrev),
          aov: isStaff || currentAov === null || prevAov === null ? null : calcDelta(currentAov, prevAov),
          refundRate:
            isStaff || currentRefundRate === null || prevRefundRate === null
              ? null
              : Number((currentRefundRate - prevRefundRate).toFixed(1)),
          conversionRate: null,
        },
      },
      sparklines: isStaff
        ? {
            ...sparklines,
            sales: Array(7).fill(0),
            aov: Array(7).fill(0),
            refundRate: Array(7).fill(0),
          }
        : sparklines,
      revenue: revenueBuckets.map((r) => ({
        day: r.day,
        revenue: isStaff ? null : r.revenue,
        orders: r.orders,
        aov: isStaff ? null : r.aov,
      })),
      target: {
        month: range.month,
        amount: isStaff || targetAmount === null ? null : targetAmount.toFixed(2),
        achieved: isStaff ? null : monthAchieved.toFixed(2),
        remaining: isStaff || targetRemaining === null ? null : targetRemaining.toFixed(2),
        daysLeft: range.daysLeft,
        runRateNeeded: isStaff || runRateNeeded === null ? null : runRateNeeded.toFixed(2),
        progress: targetProgress,
      },
      categories: categories.map((c) => ({
        name: c.name,
        amount: isStaff ? null : c.amount,
        share: c.share,
      })),
      topProducts: topProducts.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        image: p.image,
        units: p.units,
        revenue: isStaff ? null : p.revenue,
      })),
      recentOrders: recentOrdersRows.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        status: o.status,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        grandTotal: isStaff ? null : o.grandTotal.toFixed(2),
        createdAt: o.createdAt.toISOString(),
        itemsCount: o._count.items,
      })),
      customers: {
        active: Number(act.active),
        new: newCustomersCurrent,
        returning: Number(act.returning),
        repeatRate: repeatRate !== null ? Number(repeatRate.toFixed(1)) : null,
      },
      funnel: {
        productViews,
        addedToCart,
        checkout,
        purchases: currentPurchases,
        dropOffRates: {
          viewToCart:
            productViews > 0
              ? Number((((productViews - addedToCart) / productViews) * 100).toFixed(1))
              : null,
          cartToCheckout:
            addedToCart > 0
              ? Number((((addedToCart - checkout) / addedToCart) * 100).toFixed(1))
              : null,
          checkoutToPurchase:
            checkout > 0
              ? Number((((checkout - currentPurchases) / checkout) * 100).toFixed(1))
              : null,
        },
      },
      sources,
      lowStock: lowStockRows.map((l) => ({
        id: l.id,
        name: l.name,
        sku: l.sku,
        quantity: l.quantity,
        lowStockAt: l.lowStockAt,
        isOutOfStock: l.isOutOfStock,
      })),
      paymentMethods: paymentMethods.map((p) => ({
        method: p.method,
        count: p.count,
        amount: isStaff ? null : p.amount,
        share: p.share,
      })),
      geoDistricts: geoDistricts.map((g) => ({
        district: g.district,
        orders: g.orders,
        revenue: isStaff ? null : g.revenue,
      })),
      activityFeed,
      notifications: {
        unreadCount: notifications.length,
        items: notifications,
      },
      formulaNotes: {
        netSales: 'Net sales = Gross sales (grand total of non-cancelled BDT orders) − Successful refunds',
      },
    };

    // Cache for 30s
    if (this.cache.size > 100) this.cache.clear();
    this.cache.set(cacheKey, { expiresAt: Date.now() + 30000, data: response });

    return response;
  }

  async setTarget(amount: string, actorId: string) {
    const { month } = dashboardWindow();
    const result = await this.db.$transaction(async (tx) => {
      const target = await tx.dashboardTarget.upsert({
        where: { month },
        create: { month, amount },
        update: { amount },
      });
      await tx.catalogAuditLog.create({
        data: {
          entity: 'DASHBOARD_TARGET',
          entityId: month,
          action: 'UPDATED',
          actorId,
          changes: { amount, currency: 'BDT' },
        },
      });
      return { month, amount: target.amount.toFixed(2) };
    });

    this.cache.clear();
    this.emitEvent('target_updated', { month, amount });
    return result;
  }

  async track(dto: {
    id: string;
    sessionId: string;
    kind: string;
    source: string;
  }) {
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dto.sessionId}))`;
      if (
        (await tx.analyticsEvent.count({
          where: {
            sessionId: dto.sessionId,
            createdAt: { gte: new Date(Date.now() - 3600000) },
          },
        })) >= 300
      )
        return { ok: true };
      await tx.analyticsSession.upsert({
        where: { id: dto.sessionId },
        create: { id: dto.sessionId, source: dto.source },
        update: {},
      });
      await tx.analyticsEvent.createMany({
        data: [{ id: dto.id, sessionId: dto.sessionId, kind: dto.kind === 'CHECKOUT_START' ? 'CHECKOUT' : dto.kind }],
        skipDuplicates: true,
      });
      return { ok: true };
    });
  }

  formatTimeAgo(date: Date | string) {
    const ms = Date.now() - new Date(date).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  getOrderDisplay(orderNumber: string, id: string) {
    if (/^ORD-[a-f0-9]{8}-[a-f0-9-]{27}$/i.test(orderNumber)) {
      return `ORD-${id.slice(-8).toUpperCase()}`;
    }
    return orderNumber;
  }

  async getNotifications(role: string = 'ADMIN') {
    const isStaff = role === 'STAFF';
    const [recentOrders, lowStockRows, reviews, failedPayments] = await Promise.all([
      this.db.order.findMany({
        take: 12,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          status: true,
          paymentStatus: true,
          grandTotal: true,
          createdAt: true,
          manualPayments: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { status: true },
          },
        },
      }),
      this.db.$queryRaw<
        {
          productId: string;
          productName: string;
          variantName: string | null;
          sku: string;
          quantity: number;
          lowStockAt: number;
        }[]
      >(Prisma.sql`
        SELECT
          p.id AS "productId",
          p.name AS "productName",
          v.name AS "variantName",
          COALESCE(v.sku, p.sku) AS sku,
          i.quantity,
          i."lowStockAt"
        FROM inventories i
        JOIN products p ON p.id=i."productId"
        LEFT JOIN product_variants v ON v.id=i."variantId"
        WHERE p."deletedAt" IS NULL
          AND i.quantity <= i."lowStockAt"
        ORDER BY i.quantity ASC, i."updatedAt" DESC LIMIT 8`),
      this.db.productReview.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: { product: { select: { name: true } } },
      }),
      this.db.orderPaymentTransaction.findMany({
        where: { status: 'FAILED' },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { order: { select: { id: true, orderNumber: true, customerName: true } } },
      }),
    ]);

    const items: Array<{
      id: string;
      type: 'order' | 'low_stock' | 'payment_failed' | 'review';
      title: string;
      message: string;
      time: string;
      createdAt: string;
      read: boolean;
      link: string;
      targetUrl: string;
    }> = [];

    // Orders
    for (const o of recentOrders) {
      const displayNo = this.getOrderDisplay(o.orderNumber, o.id);
      const isPending = o.status === 'PENDING';
      const manualPending = o.manualPayments?.[0]?.status === 'awaiting_verification';

      if (manualPending) {
        const title = `Verify Payment: ${displayNo}`;
        const message = `${o.customerName} submitted manual payment awaiting verification`;
        const targetUrl = `/orders?paymentStatus=AWAITING_VERIFICATION&highlight=${encodeURIComponent(displayNo)}&notiTitle=${encodeURIComponent(title)}&notiMsg=${encodeURIComponent(message)}`;
        items.push({
          id: `pay-verify-${o.id}`,
          type: 'payment_failed',
          title,
          message,
          time: this.formatTimeAgo(o.createdAt),
          createdAt: new Date(o.createdAt).toISOString(),
          read: false,
          link: targetUrl,
          targetUrl,
        });
      }

      const title = isPending ? `New Order: ${displayNo}` : `Order ${displayNo} (${o.status.replaceAll('_', ' ')})`;
      const amount = !isStaff ? ` for BDT ${Number(o.grandTotal ?? 0).toLocaleString()}` : '';
      const message = `${o.customerName} placed order${amount}${isPending ? ' — Action required' : ''}`;
      const targetUrl = `/orders?highlight=${encodeURIComponent(displayNo)}&notiTitle=${encodeURIComponent(title)}&notiMsg=${encodeURIComponent(message)}`;

      items.push({
        id: `order-${o.id}`,
        type: 'order',
        title,
        message,
        time: this.formatTimeAgo(o.createdAt),
        createdAt: new Date(o.createdAt).toISOString(),
        read: false,
        link: targetUrl,
        targetUrl,
      });
    }

    // Low stock
    for (const item of lowStockRows) {
      const isOut = Number(item.quantity) <= 0;
      const prodName = item.variantName ? `${item.productName} (${item.variantName})` : item.productName;
      const title = isOut ? `Out of Stock: ${prodName}` : `Low Stock: ${prodName}`;
      const message = isOut
        ? 'Item is completely sold out! Restock immediately.'
        : `Only ${item.quantity} units left (Threshold: ${item.lowStockAt})`;
      const targetUrl = `/inventory?highlight=${encodeURIComponent(item.productName)}&q=${encodeURIComponent(item.sku || item.productName)}&notiTitle=${encodeURIComponent(title)}&notiMsg=${encodeURIComponent(message)}`;

      items.push({
        id: `stock-${item.productId}-${item.sku}`,
        type: 'low_stock',
        title,
        message,
        time: isOut ? 'Out of stock' : 'Low stock',
        createdAt: new Date().toISOString(),
        read: false,
        link: targetUrl,
        targetUrl,
      });
    }

    // Reviews
    for (const r of reviews) {
      const title = `New Review (${r.rating}★): ${r.product.name}`;
      const snippet = r.title || (r.content ? r.content.slice(0, 45) : 'Review submitted');
      const message = `"${snippet}" ${r.status === 'PENDING' ? 'awaiting moderation' : ''}`;
      const targetUrl = `/reviews?status=${r.status}&highlight=${encodeURIComponent(r.id)}&notiTitle=${encodeURIComponent(title)}&notiMsg=${encodeURIComponent(message)}`;

      items.push({
        id: `review-${r.id}`,
        type: 'review',
        title,
        message,
        time: this.formatTimeAgo(r.createdAt),
        createdAt: new Date(r.createdAt).toISOString(),
        read: false,
        link: targetUrl,
        targetUrl,
      });
    }

    // Failed payments
    for (const tx of failedPayments) {
      const title = `Payment Failed (${tx.provider})`;
      const message = `Payment failed for ${tx.order?.orderNumber || 'order'}`;
      const targetUrl = `/orders?highlight=${encodeURIComponent(tx.order?.orderNumber || '')}&notiTitle=${encodeURIComponent(title)}&notiMsg=${encodeURIComponent(message)}`;

      items.push({
        id: `pay-failed-${tx.id}`,
        type: 'payment_failed',
        title,
        message,
        time: this.formatTimeAgo(tx.createdAt),
        createdAt: new Date(tx.createdAt).toISOString(),
        read: false,
        link: targetUrl,
        targetUrl,
      });
    }

    // Sort by createdAt descending
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      unreadCount: items.length,
      items,
    };
  }
}
