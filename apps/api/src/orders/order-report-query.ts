import { Prisma } from '../generated/prisma/client.js';

// Only validated filter values enter these parameterized SQL fragments.
export function reportCte(
  filters: {
    status?: string;
    paymentStatus?: string;
    paymentMethod?: string;
    q?: string;
  },
  range: { gte?: Date; lte?: Date } = {},
) {
  const clauses: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (filters.status)
    clauses.push(Prisma.sql`o."status"::text = ${filters.status}`);
  if (filters.paymentStatus)
    clauses.push(
      Prisma.sql`o."paymentStatus"::text = ${filters.paymentStatus}`,
    );
  if (filters.paymentMethod)
    clauses.push(
      Prisma.sql`o."paymentMethod"::text = ${filters.paymentMethod}`,
    );
  if (range.gte) clauses.push(Prisma.sql`o."createdAt" >= ${range.gte}`);
  if (range.lte) clauses.push(Prisma.sql`o."createdAt" <= ${range.lte}`);
  const q = filters.q?.trim();
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    clauses.push(
      Prisma.sql`(o."orderNumber" ILIKE ${pattern} OR o."customerName" ILIKE ${pattern} OR o."customerPhone" LIKE ${pattern} OR o."customerEmail" ILIKE ${pattern})`,
    );
  }
  return Prisma.sql`WITH filtered AS (
    SELECT o.* FROM orders o WHERE ${Prisma.join(clauses, ' AND ')}
  ), ledger AS (
    SELECT p."orderId",
      COALESCE(SUM(p.amount) FILTER (WHERE p.type = 'PAYMENT'),0) AS paid,
      COALESCE(SUM(p.amount) FILTER (WHERE p.type = 'REFUND'),0) AS refunded
    FROM order_payment_transactions p JOIN filtered f ON f.id=p."orderId"
    WHERE p.status='SUCCEEDED' GROUP BY p."orderId"
  ), courier AS (
    SELECT s."orderId", SUM(s."codCollected"-s."codSettled"-s."codFees") AS outstanding,
      SUM(s."codSettled") AS settled, SUM(s."codFees") AS fees
    FROM order_shipments s JOIN filtered f ON f.id=s."orderId" GROUP BY s."orderId"
  ), cohort AS (
    SELECT f.id, f.status, f."grandTotal", f."createdAt", COALESCE(l.paid,0) AS paid,
      COALESCE(l.refunded,0) AS refunded, COALESCE(c.outstanding,0) AS outstanding,
      COALESCE(c.settled,0) AS settled, COALESCE(c.fees,0) AS fees,
      EXISTS(SELECT 1 FROM order_returns r WHERE r."orderId"=f.id AND r.status='RECEIVED' AND EXISTS(SELECT 1 FROM order_return_items ri WHERE ri."returnId"=r.id AND ri."receivedQuantity">0)) AS returned
    FROM filtered f LEFT JOIN ledger l ON l."orderId"=f.id LEFT JOIN courier c ON c."orderId"=f.id
  )`;
}
