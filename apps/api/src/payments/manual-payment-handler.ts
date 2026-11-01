import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';

export interface PaymentHandler {
  validate(
    details: Prisma.JsonValue,
    sender: string,
    reference: string,
  ): { senderInfo: string; reference: string };
}
export function validMethod(type: string, details: unknown): boolean {
  if (!details || typeof details !== 'object' || Array.isArray(details))
    return false;
  const d = details as Record<string, unknown>;
  const required =
    type === 'bank'
      ? ['bankName', 'accountName', 'accountNumber', 'branch', 'routingNumber']
      : type === 'mobile_banking'
        ? ['accountNumber', 'accountType']
        : [];
  return (
    required.length > 0 &&
    required.every(
      (k) => typeof d[k] === 'string' && String(d[k]).trim().length > 0,
    ) &&
    (type !== 'mobile_banking' ||
      (['Personal', 'Agent', 'Merchant'].includes(String(d.accountType)) &&
        /^(?:\+?88)?01[3-9][0-9]{8}$/.test(String(d.accountNumber))))
  );
}
export class ManualPaymentHandler implements PaymentHandler {
  constructor(private readonly type: 'mobile_banking' | 'bank') {}
  validate(details: Prisma.JsonValue, sender: string, rawReference: string) {
    if (!validMethod(this.type, details))
      throw new BadRequestException('Payment account is incomplete');
    const senderInfo = (sender || '').trim();
    const reference = (rawReference || '')
      .trim()
      .toUpperCase()
      .replace(/[ -]/g, '');
    if (!/^[A-Z0-9]{3,100}$/.test(reference))
      throw new BadRequestException(
        'Enter a valid transaction ID or bank reference',
      );
    if (
      senderInfo.length < 3 ||
      senderInfo.length > 120 ||
      (this.type === 'mobile_banking' &&
        !/^(?:\+?88)?01[3-9][0-9]{8}$/.test(senderInfo))
    )
      throw new BadRequestException(
        this.type === 'mobile_banking'
          ? 'Enter a valid sender mobile number'
          : 'Enter the sender name or account',
      );
    return { senderInfo, reference };
  }
}
// A future handler registers separately; manual persistence remains independent.
export const paymentHandlers: ReadonlyMap<string, PaymentHandler> = new Map([
  ['mobile_banking', new ManualPaymentHandler('mobile_banking')],
  ['bank', new ManualPaymentHandler('bank')],
]);
