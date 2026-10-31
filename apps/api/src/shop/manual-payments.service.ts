import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  isManualProvider,
  type ManualTransfer,
} from '../payments/manual-payment.config.js';
import type { ManualPaymentSubmissionDto } from './shop.dto.js';

@Injectable()
export class ManualPaymentsService {
  constructor(private readonly db: PrismaService) {}

  async capture(orderId: string, account: ManualTransfer, sessionId: string) {
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
      const exists = await tx.orderEvent.findFirst({
        where: { orderId, action: 'MANUAL_PAYMENT_INSTRUCTIONS' },
      });
      if (!exists)
        await tx.orderEvent.create({
          data: {
            orderId,
            action: 'MANUAL_PAYMENT_INSTRUCTIONS',
            actorType: 'SHOPPER',
            actorId: sessionId,
            after: { ...account },
          },
        });
    });
  }

  // Call only after the order has been scoped to the authenticated shopper session.
  async details(orderId: string) {
    const snapshot = await this.db.orderEvent.findFirst({
      where: { orderId, action: 'MANUAL_PAYMENT_INSTRUCTIONS' },
      orderBy: { createdAt: 'asc' },
    });
    if (!snapshot) return null;
    const account = snapshot.after as unknown as ManualTransfer;
    const rows = await this.db.orderPaymentTransaction.findMany({
      where: { orderId, provider: account.id.toLowerCase() },
      orderBy: { createdAt: 'desc' },
    });
    return {
      account,
      submissions: rows.map((row) => ({
        id: row.id,
        reference: row.providerReference,
        status: row.status,
        amount: row.amount.toFixed(2),
        createdAt: row.createdAt,
        rejectionReason:
          row.status === 'FAILED'
            ? (row.metadata as Record<string, unknown> | null)?.rejectionReason
            : undefined,
      })),
    };
  }

  async submit(
    orderId: string,
    scope: Prisma.OrderWhereInput,
    dto: ManualPaymentSubmissionDto,
    sessionId: string,
  ) {
    try {
      return await this.db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
          const order = await tx.order.findFirst({
            where: { id: orderId, ...scope },
          });
          if (!order) throw new NotFoundException('Order not found');
          if (!isManualProvider(order.paymentOption))
            throw new BadRequestException(
              'This order does not use manual transfer',
            );
          if (['CANCELLED', 'RETURNED'].includes(order.status))
            throw new ConflictException(
              'This order is closed. Contact our team about any transfer already sent.',
            );
          const snapshot = await tx.orderEvent.findFirst({
            where: { orderId, action: 'MANUAL_PAYMENT_INSTRUCTIONS' },
          });
          if (!snapshot)
            throw new ConflictException(
              'Payment instructions are unavailable. Contact our team before transferring.',
            );
          const provider = order.paymentOption.toLowerCase();
          const reference = dto.reference
            .trim()
            .replace(/[ -]/g, '')
            .toUpperCase();
          const previous = await tx.orderPaymentTransaction.findUnique({
            where: {
              provider_providerReference: {
                provider,
                providerReference: reference,
              },
            },
          });
          if (previous) {
            if (previous.orderId !== orderId)
              throw new ConflictException(
                'This transaction reference has already been submitted',
              );
            return { ok: true, status: previous.status };
          }
          if (
            await tx.orderPaymentTransaction.findFirst({
              where: { orderId, provider, status: 'PENDING' },
            })
          )
            throw new ConflictException(
              'A payment is already awaiting verification',
            );
          const amount = order.grandTotal.minus(order.paidTotal);
          if (amount.lessThanOrEqualTo(0))
            throw new ConflictException('No payment is due');
          const claim = await tx.orderPaymentTransaction.create({
            data: {
              orderId,
              type: 'PAYMENT',
              status: 'PENDING',
              provider,
              providerReference: reference,
              idempotencyKey: `manual:${orderId}:${provider}:${reference}`,
              amount,
              currency: order.currency,
              metadata: {
                verification: 'CUSTOMER_CLAIM_PENDING',
                sender: dto.sender.trim(),
                submittedBySession: sessionId,
              },
            },
          });
          await tx.order.update({
            where: { id: orderId },
            data: { version: { increment: 1 } },
          });
          await tx.orderEvent.create({
            data: {
              orderId,
              action: 'MANUAL_PAYMENT_SUBMITTED',
              actorType: 'SHOPPER',
              actorId: sessionId,
              after: {
                transactionId: claim.id,
                provider,
                reference,
                amount: amount.toFixed(2),
              },
            },
          });
          return { ok: true, status: 'PENDING' };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)
      )
        throw new ConflictException(
          'Payment submission changed. Refresh the order and try again.',
        );
      throw error;
    }
  }
}
