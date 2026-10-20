import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export function dashboardWindow(now = new Date()) {
  const local = new Date(now.getTime() + 6 * 3600000);
  const year = local.getUTCFullYear(),
    month = local.getUTCMonth(),
    day = local.getUTCDate();
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

// The same order-cohort net-sales basis as order reports, restricted to BDT.
const sales = Prisma.sql`WITH refunds AS (
  SELECT "orderId", SUM(amount) AS amount FROM order_payment_transactions
  WHERE type='REFUND' AND status='SUCCEEDED' GROUP BY "orderId"
), sales AS (
  SELECT o.*, CASE WHEN o.status='CANCELLED' THEN 0 ELSE o."grandTotal"-COALESCE(r.amount,0) END AS net
  FROM orders o LEFT JOIN refunds r ON r."orderId"=o.id WHERE o.currency='BDT'
)`;
type Amount = { value: Prisma.Decimal };

@Injectable()
export class DashboardService {
  constructor(private readonly db: PrismaService) {}

  async overview() {
    const range = dashboardWindow();
    return this.db.$transaction(
      async (tx) => {
        const [totals] = await tx.$queryRaw<
          (Amount & { monthly: Prisma.Decimal; purchases: bigint })[]
        >(Prisma.sql`${sales}
        SELECT COALESCE(SUM(net),0) AS value,
        COALESCE(SUM(net) FILTER(WHERE "createdAt">=${range.start} AND "createdAt"<${range.end}),0) AS monthly,
        COUNT(*) FILTER(WHERE "createdAt">=${range.start} AND "createdAt"<${range.end} AND status<>'CANCELLED') AS purchases FROM sales`);
        const buckets = await tx.$queryRaw<
          { day: string; revenue: Prisma.Decimal; orders: bigint }[]
        >(Prisma.sql`${sales}
        SELECT to_char("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Dhaka','YYYY-MM-DD') AS day,
        SUM(net) AS revenue, COUNT(*) AS orders FROM sales WHERE "createdAt">=${range.days[0]}
        AND "createdAt"<${new Date(range.days[6].getTime() + 86400000)} GROUP BY day ORDER BY day`);
        const [inventory] = await tx.$queryRaw<{ value: bigint }[]>(Prisma.sql`
        SELECT COALESCE(SUM(i.quantity),0)::bigint AS value FROM inventories i
        LEFT JOIN products p ON p.id=i."productId"
        LEFT JOIN product_variants v ON v.id=i."variantId"
        LEFT JOIN products vp ON vp.id=v."productId"
        WHERE (p.type='SIMPLE' AND p."deletedAt" IS NULL) OR (vp.type='VARIABLE' AND vp."deletedAt" IS NULL)`);
        const categories = await tx.$queryRaw<
          { name: string; amount: Prisma.Decimal }[]
        >(Prisma.sql`${sales}, item_totals AS (
        SELECT "orderId", SUM("lineTotal") AS amount FROM order_items GROUP BY "orderId"
      ) SELECT COALESCE(c.name,'Uncategorized') AS name,
        SUM(CASE WHEN t.amount>0 THEN s.net*i."lineTotal"/t.amount ELSE 0 END) AS amount
        FROM sales s JOIN order_items i ON i."orderId"=s.id JOIN item_totals t ON t."orderId"=s.id
        LEFT JOIN products p ON p.id=i."productId" LEFT JOIN categories c ON c.id=p."categoryId"
        WHERE s."createdAt">=${range.start} AND s."createdAt"<${range.end} AND s.status<>'CANCELLED'
        GROUP BY c.id,c.name ORDER BY amount DESC LIMIT 5`);
        const [activity] = await tx.$queryRaw<
          {
            active: bigint;
            returning: bigint;
            buyers: bigint;
            repeat: bigint;
          }[]
        >(Prisma.sql`
        WITH buyers AS (
          SELECT "customerId", COUNT(*) AS orders, MIN("createdAt") AS first,
            MAX("createdAt") AS last,
            BOOL_OR("createdAt">=${range.start} AND "createdAt"<${range.end}) AS this_month
          FROM orders WHERE "customerId" IS NOT NULL AND status<>'CANCELLED' GROUP BY "customerId"
        ) SELECT COUNT(*) FILTER(WHERE b.last>=${range.activeSince}) AS active,
          COUNT(*) FILTER(WHERE b.this_month AND b.first<${range.start}) AS returning,
          COUNT(*) AS buyers, COUNT(*) FILTER(WHERE b.orders>1) AS repeat
        FROM buyers b JOIN customers c ON c.id=b."customerId" WHERE c."deletedAt" IS NULL`);
        const events = await tx.$queryRaw<
          { kind: string; count: bigint }[]
        >(Prisma.sql`
        SELECT kind, COUNT(DISTINCT "sessionId") AS count FROM analytics_events
        WHERE "createdAt">=${range.start} AND "createdAt"<${range.end} GROUP BY kind`);
        const sources = await tx.$queryRaw<
          { source: string; count: bigint }[]
        >(Prisma.sql`
        SELECT s.source, COUNT(DISTINCT e."sessionId") AS count FROM analytics_events e
        JOIN analytics_sessions s ON s.id=e."sessionId" WHERE e."createdAt">=${range.start} AND e."createdAt"<${range.end}
        GROUP BY s.source`);
        const target = await tx.dashboardTarget.findUnique({
          where: { month: range.month },
        });
        const count = Number(activity.buyers);
        return {
          updatedAt: new Date().toISOString(),
          currency: 'BDT',
          timezone: 'Asia/Dhaka',
          month: range.month,
          totals: {
            sales: totals.value.toFixed(2),
            orders: await tx.order.count(),
            customers: await tx.customer.count({ where: { deletedAt: null } }),
            inventory: Number(inventory.value),
          },
          revenue: range.days.map((date) => {
            const day = new Date(date.getTime() + 6 * 3600000)
              .toISOString()
              .slice(0, 10);
            const bucket = buckets.find((item) => item.day === day);
            return {
              day,
              revenue: bucket?.revenue.toFixed(2) ?? '0.00',
              orders: Number(bucket?.orders ?? 0),
            };
          }),
          target: {
            amount: target?.amount.toFixed(2) ?? null,
            achieved: totals.monthly.toFixed(2),
          },
          categories: categories.map((item) => ({
            name: item.name,
            amount: item.amount.toFixed(2),
          })),
          customers: {
            active: Number(activity.active),
            returning: Number(activity.returning),
            new: await tx.customer.count({
              where: {
                deletedAt: null,
                createdAt: { gte: range.start, lt: range.end },
              },
            }),
            repeatRate: count ? (Number(activity.repeat) / count) * 100 : 0,
          },
          funnel: {
            productViews: Number(
              events.find((e) => e.kind === 'PRODUCT_VIEW')?.count ?? 0,
            ),
            addedToCart: Number(
              events.find((e) => e.kind === 'ADD_TO_CART')?.count ?? 0,
            ),
            checkout: Number(
              events.find((e) => e.kind === 'CHECKOUT')?.count ?? 0,
            ),
            purchases: Number(totals.purchases),
          },
          sources: ['direct', 'organic', 'social', 'referral', 'email'].map(
            (source) => ({
              source,
              count: Number(
                sources.find((s) => s.source === source)?.count ?? 0,
              ),
            }),
          ),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 20000,
      },
    );
  }

  async setTarget(amount: string, actorId: string) {
    const { month } = dashboardWindow();
    return this.db.$transaction(async (tx) => {
      const result = await tx.dashboardTarget.upsert({
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
      return { month, amount: result.amount.toFixed(2) };
    });
  }

  async track(dto: {
    id: string;
    sessionId: string;
    kind: string;
    source: string;
  }) {
    return this.db.$transaction(async (tx) => {
      // Serialize per session and bound ingestion, including duplicate/retried browser requests.
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
        data: [{ id: dto.id, sessionId: dto.sessionId, kind: dto.kind }],
        skipDuplicates: true,
      });
      return { ok: true };
    });
  }
}
