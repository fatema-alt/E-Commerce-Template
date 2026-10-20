import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrdersService } from './orders.service.js';
import { reportCte } from './order-report-query.js';
import { csvCell } from './order.rules.js';

@Injectable()
export class OrderReportsService extends OrdersService {
  constructor(db: PrismaService) {
    super(db);
  }

  async report(
    filters: Parameters<OrdersService['list']>[0],
    period = 'daily',
  ) {
    if (!['daily', 'monthly'].includes(period))
      throw new BadRequestException('Invalid report period');
    const { where } = this.queryFilters(filters);
    const cte = reportCte(
      filters,
      where.createdAt as { gte?: Date; lte?: Date } | undefined,
    );
    type Totals = {
      count: bigint;
      gross: Prisma.Decimal;
      net: Prisma.Decimal;
      paid: Prisma.Decimal;
      unpaid: Prisma.Decimal;
      refunded: Prisma.Decimal;
      outstanding: Prisma.Decimal;
      settled: Prisma.Decimal;
      fees: Prisma.Decimal;
      cancelled: bigint;
      returned: bigint;
    };
    type Bucket = {
      period: string;
      count: bigint;
      gross: Prisma.Decimal;
      paid: Prisma.Decimal;
      refunded: Prisma.Decimal;
    };
    return this.db.$transaction(
      async (tx) => {
        const [totals] = await tx.$queryRaw<Totals[]>(Prisma.sql`${cte}
        SELECT COUNT(*) AS count, COALESCE(SUM("grandTotal"),0) AS gross,
          COALESCE(SUM(CASE WHEN status='CANCELLED' THEN 0 ELSE "grandTotal"-refunded END),0) AS net,
          COALESCE(SUM(paid),0) AS paid,
          COALESCE(SUM(CASE WHEN status='CANCELLED' THEN 0 ELSE GREATEST(0,"grandTotal"-paid) END),0) AS unpaid,
          COALESCE(SUM(refunded),0) AS refunded, COALESCE(SUM(outstanding),0) AS outstanding,
          COALESCE(SUM(settled),0) AS settled, COALESCE(SUM(fees),0) AS fees,
          COUNT(*) FILTER(WHERE status='CANCELLED') AS cancelled,
          COUNT(*) FILTER(WHERE returned) AS returned FROM cohort`);
        const buckets = await tx.$queryRaw<Bucket[]>(Prisma.sql`${cte}
        SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka', ${period === 'monthly' ? 'YYYY-MM' : 'YYYY-MM-DD'}) AS period,
          COUNT(*) AS count, SUM("grandTotal") AS gross, SUM(paid) AS paid, SUM(refunded) AS refunded
        FROM cohort GROUP BY period ORDER BY period`);
        const count = Number(totals.count);
        return {
          totalOrders: count,
          grossSales: totals.gross.toFixed(2),
          netSales: totals.net.toFixed(2),
          paidTotal: totals.paid.toFixed(2),
          unpaidTotal: totals.unpaid.toFixed(2),
          refundTotal: totals.refunded.toFixed(2),
          codOutstanding: totals.outstanding.toFixed(2),
          codSettled: totals.settled.toFixed(2),
          courierFees: totals.fees.toFixed(2),
          cancellationRate: count ? Number(totals.cancelled) / count : 0,
          returnRate: count ? Number(totals.returned) / count : 0,
          summaries: buckets.map((b) => ({
            period: b.period,
            orders: Number(b.count),
            grossSales: b.gross.toFixed(2),
            paidTotal: b.paid.toFixed(2),
            refundTotal: b.refunded.toFixed(2),
          })),
          basis:
            'Order cohort by placed date (Asia/Dhaka); net sales exclude cancelled orders and received-return refunds; customer payments exclude courier settlements',
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async exportCsv(
    filters: Parameters<OrdersService['list']>[0],
    actorId: string,
  ) {
    const { where, orderBy } = this.queryFilters(filters);
    return this.db.$transaction(async (tx) => {
      const rows = await tx.order.findMany({ where, orderBy, take: 10001 });
      if (rows.length > 10000)
        throw new BadRequestException(
          'Export limited to 10,000 orders; narrow the filters',
        );
      // Reuse the existing secure admin audit store for this bulk read.
      await tx.catalogAuditLog.create({
        data: {
          entity: 'ORDER_EXPORT',
          entityId: 'bulk',
          action: 'CUSTOMER_CSV_EXPORTED',
          actorId,
          changes: {
            count: rows.length,
            filters: JSON.parse(JSON.stringify(filters)),
          },
        },
      });
      return (
        '\uFEFF' +
        [
          [
            'Order',
            'Customer',
            'Phone',
            'Email',
            'Status',
            'Payment method',
            'Payment status',
            'Total BDT',
            'Paid BDT',
            'Refunded BDT',
            'Placed UTC',
          ],
          ...rows.map((o) => [
            o.orderNumber,
            o.customerName,
            o.customerPhone,
            o.customerEmail,
            o.status,
            o.paymentMethod,
            o.paymentStatus,
            o.grandTotal.toFixed(2),
            o.paidTotal.toFixed(2),
            o.refundedTotal.toFixed(2),
            o.createdAt.toISOString(),
          ]),
        ]
          .map((row) => row.map(csvCell).join(','))
          .join('\r\n')
      );
    });
  }
}
