import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';

const D = Prisma.Decimal;
export function parseMoney(value: string, allowZero = false) {
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(value))
    throw new BadRequestException(
      'Amount must be a positive decimal with at most two places',
    );
  const result = new D(value);
  if (result.lessThan(0) || (!allowZero && result.isZero()))
    throw new BadRequestException('Amount must be greater than zero');
  return result;
}
export function paymentStatus(
  paid: Prisma.Decimal,
  refunded: Prisma.Decimal,
  total: Prisma.Decimal,
) {
  if (refunded.greaterThan(0))
    return refunded.equals(paid)
      ? ('REFUNDED' as const)
      : ('PARTIALLY_REFUNDED' as const);
  return paid.isZero()
    ? ('UNPAID' as const)
    : paid.lessThan(total)
      ? ('PARTIALLY_PAID' as const)
      : ('PAID' as const);
}
export function refundBalance(
  order: {
    status: string;
    grandTotal: Prisma.Decimal;
    paidTotal: Prisma.Decimal;
    refundedTotal: Prisma.Decimal;
  },
  receivedValue: Prisma.Decimal,
) {
  const eligible =
    order.status === 'CANCELLED' ? order.grandTotal : receivedValue;
  return D.max(
    0,
    D.min(order.paidTotal, eligible).minus(order.refundedTotal),
  ).toDecimalPlaces(2, D.ROUND_DOWN);
}
export function assertVersion(actual: number, expected: number) {
  if (!Number.isSafeInteger(expected) || expected < 0)
    throw new BadRequestException('Order version is required');
  if (actual !== expected)
    throw new ConflictException('Order changed; refresh before trying again');
}
export function csvCell(value: unknown) {
  let text = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))
    text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
