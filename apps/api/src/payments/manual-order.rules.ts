import { Prisma } from '../generated/prisma/client.js';
import { isManualProvider } from './manual-payment.config.js';

type PaymentOrder = { paymentOption?: string | null; paymentMethod: string; grandTotal: Prisma.Decimal; shippingTotal: Prisma.Decimal; paidTotal: Prisma.Decimal };
export function usesManualTransfer(order: Pick<PaymentOrder, 'paymentOption' | 'paymentMethod'>) {
  return isManualProvider(order.paymentOption) || ['MANUAL', 'BANK_TRANSFER'].includes(order.paymentMethod) || (order.paymentOption === 'OPTION_A' && order.paymentMethod === 'COD');
}
export function manualTarget(order: Pick<PaymentOrder, 'paymentOption' | 'shippingTotal' | 'grandTotal'>) {
  return order.paymentOption === 'OPTION_A' ? Prisma.Decimal.min(order.shippingTotal, order.grandTotal) : order.grandTotal;
}
export function manualOutstanding(order: PaymentOrder) {
  return Prisma.Decimal.max(0, manualTarget(order).minus(order.paidTotal));
}
