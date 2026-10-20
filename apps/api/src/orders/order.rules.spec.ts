import { Prisma } from '../generated/prisma/client.js';
import {
  assertVersion,
  csvCell,
  parseMoney,
  paymentStatus,
  refundBalance,
} from './order.rules.js';
const d = (n: string | number) => new Prisma.Decimal(n);

describe('Order financial and export rules', () => {
  it.each([
    '-1',
    '0',
    '1.001',
    '1e3',
    'NaN',
    'Infinity',
    '1000000000000',
    ' 12',
  ])('rejects invalid amount %s', (value) => {
    expect(() => parseMoney(value)).toThrow();
  });
  it('uses exact decimal balances and distinguishes partial payments/refunds', () => {
    expect(parseMoney('0.10').plus(parseMoney('0.20')).toFixed(2)).toBe('0.30');
    expect(paymentStatus(d(20), d(0), d(100))).toBe('PARTIALLY_PAID');
    expect(paymentStatus(d(100), d(0), d(100))).toBe('PAID');
    expect(paymentStatus(d(100), d(20), d(100))).toBe('PARTIALLY_REFUNDED');
    expect(paymentStatus(d(100), d(100), d(100))).toBe('REFUNDED');
    expect(
      refundBalance(
        {
          status: 'DELIVERED',
          grandTotal: d(100),
          paidTotal: d(80),
          refundedTotal: d(10),
        },
        d(30),
      ).toString(),
    ).toBe('20');
    expect(
      refundBalance(
        {
          status: 'CANCELLED',
          grandTotal: d(100),
          paidTotal: d(80),
          refundedTotal: d(10),
        },
        d(0),
      ).toString(),
    ).toBe('70');
    expect(() => assertVersion(3, 2)).toThrow('refresh');
  });
  it.each([
    '=SUM(A1)',
    ' +cmd',
    '-1',
    '@SUM(1)',
    '\tformula',
    '\r=cmd',
    '\n=cmd',
  ])('escapes spreadsheet formula %j', (v) => {
    expect(csvCell(v)).toBe(`"'${v}"`);
  });
  it('quotes CSV delimiters and embedded quotes', () =>
    expect(csvCell('a,"b"\n')).toBe('"a,""b""\n"'));
});
