import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { toProductHtml } from '@commerce/product-content';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { assertVersion, paymentStatus } from '../orders/order.rules.js';
import { paymentHandlers, validMethod } from './manual-payment-handler.js';
import { defaultPlanSettings } from './plan-pricing.js';
import type {
  PaymentMethodDto,
  PlanSettingsDto,
  ReviewManualDto,
} from './checkout-payments.dto.js';

@Injectable()
export class CheckoutPaymentsService {
  constructor(private readonly db: PrismaService) {}
  async settings() {
    return (
      (await this.db.paymentSettings.findUnique({
        where: { id: 'default' },
      })) || defaultPlanSettings
    );
  }
  async saveSettings(dto: PlanSettingsDto) {
    if (dto.discountType === 'percentage' && dto.discountValue > 100)
      throw new BadRequestException('Discount percentage cannot exceed 100');
    if (
      dto.partialEnabled &&
      dto.advanceType !== 'delivery_charge_only' &&
      dto.advanceValue <= 0
    )
      throw new BadRequestException('Advance must be greater than zero');
    if (dto.codMin != null && dto.codMax != null && dto.codMin > dto.codMax)
      throw new BadRequestException('COD minimum cannot exceed maximum');
    return this.db.paymentSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...dto },
      update: dto,
    });
  }
  async methods(publicOnly = false) {
    const methods = await this.db.paymentMethod.findMany({
      where: {
        deletedAt: null,
        type: { in: ['mobile_banking', 'bank'] },
        ...(publicOnly ? { isEnabled: true } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return publicOnly
      ? methods.filter((m) => validMethod(m.type, m.details))
      : methods;
  }
  async publicConfig() {
    const [settings, methods] = await Promise.all([
      this.settings(),
      this.methods(true),
    ]);
    return { settings, methods };
  }
  async saveMethod(dto: PaymentMethodDto, id?: string) {
    if (id) {
      const existing = await this.db.paymentMethod.findFirst({
        where: { id, deletedAt: null },
      });
      if (!existing) throw new NotFoundException('Payment method not found');
      if (
        existing.type !== dto.type &&
        (await this.db.manualOrderPayment.count({
          where: { paymentMethodId: id },
        }))
      )
        throw new ConflictException(
          'The type of a used payment method cannot be changed',
        );
    }
    if (!validMethod(dto.type, dto.details))
      throw new BadRequestException(
        'Complete all required account fields for this method',
      );
    if (!dto.name.trim())
      throw new BadRequestException('Method name is required');
    const allowed =
      dto.type === 'bank'
        ? [
            'bankName',
            'accountName',
            'accountNumber',
            'branch',
            'routingNumber',
          ]
        : ['accountNumber', 'accountType'];
    if (Object.keys(dto.details).some((key) => !allowed.includes(key)))
      throw new BadRequestException('Unexpected payment account field');
    if (
      Object.values(dto.details).some(
        (v) => typeof v !== 'string' || v.length > 240,
      )
    )
      throw new BadRequestException('Invalid account details');
    if (dto.logo && !/^(https?:\/\/|\/uploads\/)/.test(dto.logo))
      throw new BadRequestException('Choose an uploaded logo');
    const data = {
      ...dto,
      name: dto.name.trim(),
      details: Object.fromEntries(
        Object.entries(dto.details).map(([key, value]) => [key, value.trim()]),
      ),
      instruction: toProductHtml(dto.instruction),
    };
    return id
      ? this.db.paymentMethod.update({ where: { id }, data })
      : this.db.paymentMethod.create({ data });
  }
  async deleteMethod(id: string) {
    return this.db.paymentMethod.update({
      where: { id },
      data: { deletedAt: new Date(), isEnabled: false },
    });
  }
  async review(id: string, dto: ReviewManualDto, actorId: string) {
    if (
      dto.action === 'reject' &&
      (!dto.reason || dto.reason.trim().length < 3)
    )
      throw new BadRequestException('A rejection reason is required');
    return this.db.$transaction(
      async (tx) => {
        const claim = await tx.manualOrderPayment.findUnique({
          where: { id },
          include: { order: true },
        });
        if (!claim) throw new NotFoundException('Payment not found');
        assertVersion(claim.order.version, dto.version);
        if (claim.status !== 'awaiting_verification')
          throw new ConflictException('This payment has already been reviewed');
        if (['CANCELLED', 'RETURNED'].includes(claim.order.status))
          throw new ConflictException('Order is closed');
        const confirm = dto.action === 'confirm';
        const paid = claim.order.paidTotal.plus(
          confirm ? claim.amountDueNow : 0,
        );
        if (paid.greaterThan(claim.order.grandTotal))
          throw new ConflictException('Payment exceeds outstanding balance');
        await tx.manualOrderPayment.update({
          where: { id },
          data: {
            status: confirm ? 'confirmed' : 'rejected',
            rejectReason: confirm ? null : dto.reason!.trim(),
            verifiedBy: actorId,
            verifiedAt: new Date(),
          },
        });
        if (confirm)
          await tx.orderPaymentTransaction.create({
            data: {
              orderId: claim.orderId,
              type: 'PAYMENT',
              status: 'SUCCEEDED',
              provider: 'MANUAL_VERIFIED',
              providerReference: claim.id,
              idempotencyKey: `manual-review:${claim.id}`,
              amount: claim.amountDueNow,
              metadata: { manualPaymentId: claim.id, verifiedBy: actorId },
              processedAt: new Date(),
            },
          });
        await tx.order.update({
          where: { id: claim.orderId },
          data: {
            ...(confirm && claim.order.status === 'PENDING'
              ? { status: 'CONFIRMED', confirmedAt: new Date() }
              : {}),
            paidTotal: paid,
            paymentStatus: paymentStatus(
              paid,
              claim.order.refundedTotal,
              claim.order.grandTotal,
            ),
            version: { increment: 1 },
          },
        });
        // Durable hook for future notifications; no delivery integration here.
        await tx.orderEvent.create({
          data: {
            orderId: claim.orderId,
            action: confirm
              ? 'MANUAL_PAYMENT_CONFIRMED'
              : 'MANUAL_PAYMENT_REJECTED',
            actorType: 'ADMIN',
            actorId,
            after: {
              paymentId: id,
              ...(confirm ? {} : { reason: dto.reason! }),
            },
          },
        });
        return { ok: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  async resubmit(
    orderId: string,
    scope: Prisma.OrderWhereInput,
    sender: string,
    reference: string,
    actorId: string,
  ) {
    try {
      return await this.db.$transaction(
        async (tx) => {
          const order = await tx.order.findFirst({
            where: { id: orderId, ...scope },
            include: { manualPayments: { orderBy: { createdAt: 'desc' } } },
          });
          if (!order) throw new NotFoundException('Order not found');
          const previous = order.manualPayments[0];
          if (
            !previous ||
            previous.status !== 'rejected' ||
            ['CANCELLED', 'RETURNED'].includes(order.status) ||
            order.paymentStatus === 'PAID'
          )
            throw new ConflictException(
              'Only rejected payments on open orders can be resubmitted',
            );
          const snapshot = previous.methodSnapshot as Record<
            string,
            Prisma.JsonValue
          >;
          const handler = paymentHandlers.get(String(snapshot.type));
          if (!handler)
            throw new BadRequestException('Unsupported payment method');
          const submission = handler.validate(
            snapshot.details,
            sender,
            reference,
          );
          await tx.manualOrderPayment.create({
            data: {
              orderId,
              plan: previous.plan,
              paymentMethodId: previous.paymentMethodId,
              methodSnapshot: previous.methodSnapshot as Prisma.InputJsonValue,
              amountDueNow: previous.amountDueNow,
              amountDueOnDelivery: previous.amountDueOnDelivery,
              ...submission,
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
              actorType: 'CUSTOMER',
              actorId,
            },
          });
          return { ok: true };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002')
        throw new ConflictException(
          'This transaction reference has already been submitted. Use a different reference.',
        );
      throw e;
    }
  }
}
