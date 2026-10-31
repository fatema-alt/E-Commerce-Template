import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { manualOutstanding } from '../payments/manual-order.rules.js';
import { Prisma, OrderStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrdersService, orderInclude } from './orders.service.js';
import {
  ChangeOrderStatusDto,
  AddOrderNoteDto,
} from './dto/order-management.dto.js';
import { BookManualShipmentDto } from './dto/order-shipping-returns.dto.js';
import {
  OrderMutationDto,
  ShipmentUpdateDto,
  ReturnRequestDto,
  ReturnDecisionDto,
  ReturnReceiveDto,
  PaymentRecordDto,
} from './dto/order-operations.dto.js';
import {
  assertVersion,
  parseMoney,
  paymentStatus,
  refundBalance,
} from './order.rules.js';

const D = Prisma.Decimal;
type Tx = Prisma.TransactionClient;
type FullOrder = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
type Actor = { id: string; role: string };

@Injectable()
export class OrderOperationsService extends OrdersService {
  constructor(db: PrismaService) {
    super(db);
  }

  override async detail(id: string) {
    const order = await super.detail(id);
    return { ...order, refundableBalance: this.refundable(order).toFixed(2) };
  }

  private refundable(order: FullOrder) {
    const receivedValue = order.returns
      .filter((r) => r.status === 'RECEIVED')
      .flatMap((r) => r.items)
      .reduce((sum, i) => sum.plus(i.refundableAmount), new D(0));
    return refundBalance(order, receivedValue);
  }

  // Claim, version check, side effects, audit and response commit together.
  // Serializable retries are safe because no external calls occur inside this transaction.
  private async mutate(
    id: string,
    dto: OrderMutationDto,
    key: string | undefined,
    actor: Actor,
    operation: string,
    work: (tx: Tx, order: FullOrder) => Promise<Prisma.InputJsonValue>,
  ) {
    if (!key || !/^[a-zA-Z0-9._:-]{16,128}$/.test(key))
      throw new BadRequestException(
        'Idempotency-Key (16-128 characters) required',
      );
    const hash = createHash('sha256')
      .update(JSON.stringify({ id, dto, actor: actor.id, operation }))
      .digest('hex');
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.db.$transaction(
          async (tx) => {
            const existing = await tx.orderIdempotencyKey.findUnique({
              where: { key },
            });
            if (existing) {
              if (
                existing.requestHash !== hash ||
                existing.orderId !== id ||
                existing.operation !== operation
              )
                throw new ConflictException(
                  'Idempotency key reused for a different request',
                );
              if (!existing.responseBody)
                throw new ConflictException('Request in progress');
              return existing.responseBody;
            }
            const order = await tx.order.findUnique({
              where: { id },
              include: orderInclude,
            });
            if (!order) throw new NotFoundException('Order not found');
            assertVersion(order.version, dto.version);
            await tx.orderIdempotencyKey.create({
              data: {
                key,
                operation,
                requestHash: hash,
                orderId: id,
                expiresAt: new Date(Date.now() + 7 * 86400000),
              },
            });
            const locked = await tx.order.updateMany({
              where: { id, version: dto.version },
              data: { version: { increment: 1 } },
            });
            if (locked.count !== 1)
              throw new ConflictException('Concurrent order update; refresh');
            const after = await work(tx, order);
            await tx.orderEvent.create({
              data: {
                orderId: id,
                actorType: 'ADMIN',
                actorId: actor.id,
                action: operation,
                before: { version: order.version, status: order.status },
                after,
              },
            });
            const updated = await tx.order.findUniqueOrThrow({
              where: { id },
              include: orderInclude,
            });
            const response = JSON.parse(
              JSON.stringify({
                ...updated,
                refundableBalance: this.refundable(updated).toFixed(2),
              }),
            ) as Prisma.InputJsonObject;
            await tx.orderIdempotencyKey.update({
              where: { key },
              data: { responseBody: response, responseStatus: 200 },
            });
            return response;
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            timeout: 15000,
          },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2034', 'P2002'].includes(error.code)
        ) {
          const existing = await this.db.orderIdempotencyKey.findUnique({
            where: { key },
          });
          if (existing?.requestHash === hash && existing.responseBody)
            return existing.responseBody;
          if (existing)
            throw new ConflictException(
              'Idempotency key reused for a different request',
            );
          if (error.code === 'P2034' && attempt < 2) continue;
          throw new ConflictException(
            'Concurrent update or duplicate external reference',
          );
        }
        throw error;
      }
    }
    throw new ConflictException('Concurrent update; retry with the same key');
  }

  async changeStatus(
    id: string,
    dto: ChangeOrderStatusDto,
    key: string | undefined,
    actor: Actor,
  ) {
    return this.mutate(
      id,
      dto,
      key,
      actor,
      'ORDER_STATUS_CHANGED',
      async (tx, order) => {
        const next: Partial<Record<OrderStatus, OrderStatus>> = {
          PENDING: 'CONFIRMED',
          CONFIRMED: 'PROCESSING',
          PROCESSING: 'SHIPPED',
          SHIPPED: 'DELIVERED',
        };
        if (next[order.status] !== dto.status)
          throw new ConflictException(
            `Cannot transition ${order.status} to ${dto.status}`,
          );
        if (dto.status === 'SHIPPED' || dto.status === 'DELIVERED') {
          const shipment = order.shipments.find(
            (s) => !['CANCELLED', 'FAILED'].includes(s.status),
          );
          if (!shipment)
            throw new ConflictException('Record a manual shipment first');
          await this.advanceShipment(
            tx,
            order,
            shipment.id,
            dto.status === 'SHIPPED' ? 'IN_TRANSIT' : 'DELIVERED',
          );
        } else {
          await tx.order.update({
            where: { id },
            data: {
              status: dto.status,
              ...(dto.status === 'CONFIRMED'
                ? { confirmedAt: new Date() }
                : {}),
            },
          });
        }
        return { status: dto.status, reason: dto.reason?.trim() ?? '' };
      },
    );
  }

  private async consumeStock(tx: Tx, order: FullOrder) {
    for (const r of [...order.reservations].sort((a, b) =>
      a.inventoryId.localeCompare(b.inventoryId),
    )) {
      if (r.status !== 'ACTIVE')
        throw new ConflictException('Expected active stock reservation');
      const item = order.items.find((i) => i.id === r.orderItemId);
      if (!item?.productId || r.quantity !== item.quantity)
        throw new ConflictException('Stock reservation mismatch');
      const changed = await tx.inventory.updateMany({
        where: {
          id: r.inventoryId,
          quantity: { gte: r.quantity },
          reserved: { gte: r.quantity },
        },
        data: {
          quantity: { decrement: r.quantity },
          reserved: { decrement: r.quantity },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException('Insufficient reserved inventory');
      await tx.orderStockReservation.update({
        where: { id: r.id },
        data: { status: 'CONSUMED' },
      });
      const stock = await tx.inventory.findUniqueOrThrow({
        where: { id: r.inventoryId },
      });
      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          variantId: item.variantId,
          type: 'SALE',
          quantity: r.quantity,
          beforeQty: stock.quantity + r.quantity,
          afterQty: stock.quantity,
          referenceId: order.id,
          reason: 'ORDER_SHIPPED',
        },
      });
    }
  }

  private async advanceShipment(
    tx: Tx,
    order: FullOrder,
    shipmentId: string,
    status: string,
  ) {
    const shipment = order.shipments.find((s) => s.id === shipmentId);
    if (!shipment) throw new NotFoundException('Shipment not found');
    const allowed: Record<string, string[]> = {
      MANUAL_BOOKED: ['IN_TRANSIT', 'CANCELLED'],
      IN_TRANSIT: ['DELIVERED', 'FAILED'],
      FAILED: ['IN_TRANSIT'],
    };
    if (!allowed[shipment.status]?.includes(status))
      throw new ConflictException(
        `Cannot transition shipment ${shipment.status} to ${status}`,
      );
    const now = new Date();
    if (status === 'IN_TRANSIT') {
      if (shipment.status === 'MANUAL_BOOKED') {
        if (order.status !== 'PROCESSING')
          throw new ConflictException(
            'Order must be processing before dispatch',
          );
        await this.consumeStock(tx, order);
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'SHIPPED',
            shippedAt: now,
            fulfillmentStatus: 'FULFILLED',
          },
        });
      } else if (order.status !== 'SHIPPED')
        throw new ConflictException('Order must be shipped');
    }
    if (status === 'DELIVERED') {
      if (order.status !== 'SHIPPED')
        throw new ConflictException('Only shipped orders can be delivered');
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'DELIVERED', deliveredAt: now },
      });
    }
    await tx.orderShipment.update({
      where: { id: shipmentId },
      data: {
        status,
        ...(status === 'IN_TRANSIT' && !shipment.shippedAt
          ? { shippedAt: now }
          : {}),
        ...(status === 'DELIVERED' ? { deliveredAt: now } : {}),
      },
    });
  }

  async addNote(
    id: string,
    dto: AddOrderNoteDto,
    key: string | undefined,
    actor: Actor,
  ) {
    return this.mutate(id, dto, key, actor, 'ADMIN_NOTE_ADDED', async (tx) => {
      if (!dto.body.trim())
        throw new BadRequestException('Note cannot be blank');
      const note = await tx.orderAdminNote.create({
        data: {
          orderId: id,
          body: dto.body.trim(),
          createdByAdminId: actor.id,
        },
      });
      return { noteId: note.id };
    });
  }

  async cancel(
    id: string,
    dto: OrderMutationDto,
    key: string | undefined,
    actor: Actor,
  ) {
    return this.mutate(
      id,
      dto,
      key,
      actor,
      'ORDER_CANCELLED',
      async (tx, order) => {
        if (!['PENDING', 'CONFIRMED', 'PROCESSING'].includes(order.status))
          throw new ConflictException(
            'Cannot cancel a dispatched or closed order',
          );
        for (const r of [...order.reservations].sort((a, b) =>
          a.inventoryId.localeCompare(b.inventoryId),
        )) {
          if (r.status !== 'ACTIVE')
            throw new ConflictException('Expected active reservation');
          const stock = await tx.inventory.updateMany({
            where: { id: r.inventoryId, reserved: { gte: r.quantity } },
            data: { reserved: { decrement: r.quantity } },
          });
          if (stock.count !== 1)
            throw new ConflictException('Invalid reserved inventory');
          await tx.orderStockReservation.update({
            where: { id: r.id },
            data: { status: 'RELEASED' },
          });
        }
        await tx.orderShipment.updateMany({
          where: { orderId: id, status: 'MANUAL_BOOKED' },
          data: { status: 'CANCELLED' },
        });
        await tx.order.update({
          where: { id },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        });
        const hasUnrefundedAdvance = order.paidTotal.greaterThan(
          order.refundedTotal,
        );
        if (hasUnrefundedAdvance) {
          const unrefunded = order.paidTotal.minus(order.refundedTotal);
          await tx.orderAdminNote.create({
            data: {
              orderId: id,
              body: `Order cancelled with advance/online payment collected. Manual refund required: BDT ${unrefunded.toFixed(2)}`,
              createdByAdminId: actor.id,
            },
          });
        }
        return {
          status: 'CANCELLED',
          refundRequired: hasUnrefundedAdvance,
        };
      },
    );
  }

  async bookManualShipment(
    id: string,
    dto: BookManualShipmentDto,
    key: string | undefined,
    actor: Actor,
  ) {
    return this.mutate(
      id,
      dto,
      key,
      actor,
      'MANUAL_SHIPMENT_RECORDED',
      async (tx, order) => {
        if (!['CONFIRMED', 'PROCESSING'].includes(order.status))
          throw new ConflictException('Order must be confirmed or processing');
        if (order.paymentOption === 'OPTION_A' && order.paymentMethod === 'COD' && manualOutstanding(order).greaterThan(0)) throw new ConflictException('Verify the advance delivery payment before booking a shipment');
        if (order.shipments.some((s) => s.status !== 'CANCELLED'))
          throw new ConflictException('An active shipment already exists');
        if (!dto.provider.trim() || !dto.trackingNumber.trim())
          throw new BadRequestException(
            'Provider and tracking number required',
          );
        const shipment = await tx.orderShipment.create({
          data: {
            orderId: id,
            provider: dto.provider.trim(),
            trackingNumber: dto.trackingNumber.trim(),
            providerBookingId: dto.providerBookingId?.trim() || null,
            status: 'MANUAL_BOOKED',
            bookedAt: new Date(),
            parcelWeightKg: dto.parcelWeightKg,
            shippingCost: dto.shippingCost,
            parcelDetails: dto.parcelDetails?.trim(),
          },
        });
        return {
          shipmentId: shipment.id,
          status: 'MANUAL_BOOKED',
          bookingType: 'MANUAL_RECORD_ONLY',
        };
      },
    );
  }

  async updateShipment(
    id: string,
    shipmentId: string,
    dto: ShipmentUpdateDto,
    key: string | undefined,
    actor: Actor,
  ) {
    return this.mutate(
      id,
      dto,
      key,
      actor,
      `SHIPMENT_${shipmentId}_UPDATED`,
      async (tx, order) => {
        await this.advanceShipment(tx, order, shipmentId, dto.status);
        return { shipmentId, status: dto.status, note: dto.note.trim() };
      },
    );
  }

  async requestReturn(
    id: string,
    dto: ReturnRequestDto,
    key: string | undefined,
    actor: Actor,
  ) {
    return this.mutate(
      id,
      dto,
      key,
      actor,
      'ORDER_RETURN_REQUESTED',
      async (tx, order) => {
        if (order.status !== 'DELIVERED')
          throw new ConflictException(
            'Only delivered orders can request a return',
          );
        const days = Number(process.env.ORDER_RETURN_WINDOW_DAYS ?? 14);
        if (
          !Number.isSafeInteger(days) ||
          days < 1 ||
          !order.deliveredAt ||
          Date.now() > order.deliveredAt.getTime() + days * 86400000
        )
          throw new ConflictException('Return eligibility window expired');
        if (
          new Set(dto.items.map((i) => i.orderItemId)).size !== dto.items.length
        )
          throw new BadRequestException('Duplicate return lines');
        for (const line of dto.items) {
          const item = order.items.find((i) => i.id === line.orderItemId);
          const committed = order.returns
            .filter((r) =>
              ['APPROVED', 'RECEIVED', 'REQUESTED'].includes(r.status),
            )
            .flatMap((r) => r.items)
            .filter((i) => i.orderItemId === line.orderItemId)
            .reduce(
              (n, i) =>
                n +
                (order.returns.some(
                  (r) => r.status === 'RECEIVED' && r.items.includes(i),
                )
                  ? i.receivedQuantity
                  : i.quantity),
              0,
            );
          if (
            !item ||
            line.quantity < 1 ||
            line.quantity + committed > item.quantity
          )
            throw new ConflictException(
              'Return quantity exceeds remaining delivered quantity',
            );
        }
        const record = await tx.orderReturn.create({
          data: {
            orderId: id,
            reason: dto.reason.trim(),
            createdByAdminId: actor.id,
            items: { create: dto.items },
          },
        });
        await tx.order.update({
          where: { id },
          data: { status: 'RETURN_REQUESTED' },
        });
        return {
          returnId: record.id,
          reason: dto.reason.trim(),
          items: dto.items.map((i) => ({ ...i })),
        };
      },
    );
  }

  async decideReturn(
    id: string,
    returnId: string,
    dto: ReturnDecisionDto,
    key: string | undefined,
    actor: Actor,
  ) {
    return this.mutate(
      id,
      dto,
      key,
      actor,
      `RETURN_${returnId}_DECIDED`,
      async (tx, order) => {
        const record = order.returns.find((r) => r.id === returnId);
        if (
          !record ||
          record.status !== 'REQUESTED' ||
          order.status !== 'RETURN_REQUESTED'
        )
          throw new ConflictException('Return is not awaiting approval');
        await tx.orderReturn.update({
          where: { id: returnId },
          data: {
            status: dto.approved ? 'APPROVED' : 'REJECTED',
            adminNote: dto.note.trim(),
            resolvedByAdminId: actor.id,
            resolvedAt: new Date(),
          },
        });
        await tx.order.update({
          where: { id },
          data: { status: dto.approved ? 'RETURN_APPROVED' : 'DELIVERED' },
        });
        return { returnId, approved: dto.approved, note: dto.note.trim() };
      },
    );
  }

  async receiveReturn(
    id: string,
    returnId: string,
    dto: ReturnReceiveDto,
    key: string | undefined,
    actor: Actor,
  ) {
    return this.mutate(
      id,
      dto,
      key,
      actor,
      `RETURN_${returnId}_RECEIVED`,
      async (tx, order) => {
        const record = order.returns.find((r) => r.id === returnId);
        if (
          !record ||
          record.status !== 'APPROVED' ||
          order.status !== 'RETURN_APPROVED'
        )
          throw new ConflictException(
            'Return must be approved and not previously received',
          );
        if (
          dto.items.length !== record.items.length ||
          new Set(dto.items.map((i) => i.orderItemId)).size !== dto.items.length
        )
          throw new BadRequestException(
            'Inspect every return line exactly once',
          );
        for (const line of [...dto.items].sort((a, b) =>
          a.orderItemId.localeCompare(b.orderItemId),
        )) {
          const requested = record.items.find(
            (i) => i.orderItemId === line.orderItemId,
          );
          const item = order.items.find((i) => i.id === line.orderItemId);
          if (
            !requested ||
            !item ||
            line.receivedQuantity > requested.quantity ||
            line.sellableQuantity > line.receivedQuantity ||
            line.receivedQuantity < 0 ||
            line.sellableQuantity < 0
          )
            throw new BadRequestException(
              'Invalid received/sellable quantities',
            );
          // Cumulative rounding prevents repeated partial returns exceeding the item value.
          const previousQty = order.returns
            .filter((r) => r.status === 'RECEIVED')
            .flatMap((r) => r.items)
            .filter((i) => i.orderItemId === item.id)
            .reduce((n, i) => n + i.receivedQuantity, 0);
          const previousValue = order.returns
            .filter((r) => r.status === 'RECEIVED')
            .flatMap((r) => r.items)
            .filter((i) => i.orderItemId === item.id)
            .reduce((n, i) => n.plus(i.refundableAmount), new D(0));
          const refundableAmount = item.lineTotal
            .mul(previousQty + line.receivedQuantity)
            .div(item.quantity)
            .toDecimalPlaces(2, D.ROUND_DOWN)
            .minus(previousValue);
          const reservation = order.reservations.find(
            (r) => r.orderItemId === item.id && r.status === 'CONSUMED',
          );
          let restockedQuantity = 0;
          if (reservation && line.sellableQuantity > 0) {
            if (!item.productId)
              throw new ConflictException('Missing product for restock');
            const stock = await tx.inventory.update({
              where: { id: reservation.inventoryId },
              data: { quantity: { increment: line.sellableQuantity } },
            });
            await tx.inventoryMovement.create({
              data: {
                productId: item.productId,
                variantId: item.variantId,
                type: 'RETURN',
                quantity: line.sellableQuantity,
                beforeQty: stock.quantity - line.sellableQuantity,
                afterQty: stock.quantity,
                referenceId: returnId,
                reason: 'INSPECTED_SELLABLE_RETURN',
              },
            });
            restockedQuantity = line.sellableQuantity;
          }
          await tx.orderReturnItem.update({
            where: { id: requested.id },
            data: {
              receivedQuantity: line.receivedQuantity,
              sellableQuantity: line.sellableQuantity,
              restockedQuantity,
              refundableAmount,
            },
          });
        }
        await tx.orderReturn.update({
          where: { id: returnId },
          data: {
            status: 'RECEIVED',
            adminNote: dto.note.trim(),
            receivedByAdminId: actor.id,
            receivedAt: new Date(),
          },
        });
        const all = await tx.orderReturn.findMany({
          where: { orderId: id, status: 'RECEIVED' },
          include: { items: true },
        });
        const full = order.items.every(
          (item) =>
            all
              .flatMap((r) => r.items)
              .filter((i) => i.orderItemId === item.id)
              .reduce((n, i) => n + i.receivedQuantity, 0) === item.quantity,
        );
        await tx.order.update({
          where: { id },
          data: {
            status: full ? 'RETURNED' : 'DELIVERED',
            ...(full ? { fulfillmentStatus: 'RETURNED' } : {}),
          },
        });
        return {
          returnId,
          note: dto.note.trim(),
          fullReturn: full,
          inspection: dto.items.map((i) => ({ ...i })),
          refundExecuted: false,
        };
      },
    );
  }

  async recordPayment(
    id: string,
    dto: PaymentRecordDto,
    key: string | undefined,
    actor: Actor,
  ) {
    return this.mutate(
      id,
      dto,
      key,
      actor,
      'PAYMENT_ACCOUNTING_RECORDED',
      async (tx, order) => {
        const amount = parseMoney(dto.amount);
        const provider = dto.provider.trim().toLowerCase();
        if (
          !provider ||
          !dto.reference.trim() ||
          dto.evidence.trim().length < 10
        )
          throw new BadRequestException(
            'Provider, unique reference and verification evidence required',
          );
        const reference = [
          'manual_bkash',
          'manual_nagad',
          'bank_transfer',
        ].includes(provider)
          ? dto.reference.trim().replace(/[ -]/g, '').toUpperCase()
          : dto.reference.trim();
        const pending =
          dto.kind === 'MANUAL_VERIFIED'
            ? order.payments.find(
                (p) =>
                  p.provider === provider && p.providerReference === reference,
              )
            : undefined;
        if (
          pending &&
          (pending.status !== 'PENDING' ||
            !pending.amount.equals(amount) ||
            (pending.metadata as Record<string, unknown> | null)
              ?.verification !== 'CUSTOMER_CLAIM_PENDING')
        )
          throw new ConflictException(
            'The payment claim is no longer pending or the amount does not match',
          );
        let paid = order.paidTotal;
        let refunded = order.refundedTotal;
        const fee = parseMoney(dto.fee ?? '0', true);
        const shipment = order.shipments.find((s) => s.id === dto.shipmentId);
        if (dto.kind !== 'COD_SETTLEMENT' && !fee.isZero())
          throw new BadRequestException('Fees apply only to COD settlements');
        if (dto.kind === 'REFUND_RECORDED') {
          if (amount.greaterThan(this.refundable(order)))
            throw new ConflictException(
              'Refund exceeds eligible received/cancelled balance',
            );
          refunded = refunded.plus(amount);
        } else if (dto.kind === 'COD_SETTLEMENT') {
          if (
            order.paymentMethod !== 'COD' ||
            !shipment ||
            amount
              .plus(fee)
              .greaterThan(
                shipment.codCollected
                  .minus(shipment.codSettled)
                  .minus(shipment.codFees),
              )
          )
            throw new ConflictException(
              'Settlement and fees exceed courier-held COD balance',
            );
          await tx.orderShipment.update({
            where: { id: shipment!.id },
            data: {
              codSettled: { increment: amount },
              codFees: { increment: fee },
            },
          });
        } else {
          if (['CANCELLED', 'RETURNED'].includes(order.status))
            throw new ConflictException(
              'Closed orders cannot receive new payments',
            );
          if (dto.kind === 'COD_COLLECTION') {
            if (
              order.paymentMethod !== 'COD' ||
              !shipment ||
              shipment.status !== 'DELIVERED'
            )
              throw new ConflictException(
                'COD collection requires a delivered COD shipment',
              );
            await tx.orderShipment.update({
              where: { id: shipment!.id },
              data: { codCollected: { increment: amount } },
            });
          } else if (order.paymentMethod === 'COD' && !(dto.kind === 'MANUAL_VERIFIED' && order.paymentOption === 'OPTION_A' && pending))
            throw new ConflictException('Use COD collection for COD orders');
          if (dto.kind === 'MANUAL_VERIFIED' && order.paymentOption === 'OPTION_A' && amount.greaterThan(manualOutstanding(order))) throw new ConflictException('Advance payment exceeds the delivery charge still due');
          paid = paid.plus(amount);
          if (paid.greaterThan(order.grandTotal))
            throw new ConflictException('Payment exceeds order balance');
        }
        // Settlement is a ledger entry, never a second customer payment.
        const entry = {
          orderId: id,
          type:
            dto.kind === 'REFUND_RECORDED'
              ? 'REFUND'
              : dto.kind === 'COD_SETTLEMENT'
                ? 'CAPTURE'
                : 'PAYMENT',
          status: 'SUCCEEDED',
          provider,
          providerReference: reference,
          idempotencyKey: key!,
          amount,
          metadata: {
            ...((pending?.metadata || {}) as Record<
              string,
              Prisma.InputJsonValue
            >),
            kind: dto.kind,
            verification: 'ADMIN_MANUAL_EVIDENCE',
            evidence: dto.evidence.trim(),
            actorId: actor.id,
            shipmentId: dto.shipmentId ?? null,
            fee: fee.toFixed(2),
            externalTransferExecuted: false,
          },
          processedAt: new Date(),
        } as const;
        const transaction = pending
          ? await tx.orderPaymentTransaction.update({
              where: { id: pending.id },
              data: entry,
            })
          : await tx.orderPaymentTransaction.create({ data: entry });
        await tx.order.update({
          where: { id },
          data: {
            paidTotal: paid,
            refundedTotal: refunded,
            paymentStatus: paymentStatus(paid, refunded, order.grandTotal),
          },
        });
        return {
          transactionId: transaction.id,
          kind: dto.kind,
          amount: amount.toFixed(2),
          fee: fee.toFixed(2),
          reference: dto.reference.trim(),
          verification: 'ADMIN_MANUAL_EVIDENCE',
          externalTransferExecuted: false,
        };
      },
    );
  }
  async rejectManualPayment(
    id: string,
    transactionId: string,
    dto: import('./dto/order-operations.dto.js').ManualPaymentRejectionDto,
    key: string | undefined,
    actor: Actor,
  ) {
    return this.mutate(
      id,
      dto,
      key,
      actor,
      'MANUAL_PAYMENT_REJECTED',
      async (tx, order) => {
        const claim = order.payments.find(
          (payment) => payment.id === transactionId,
        );
        if (
          !claim ||
          claim.status !== 'PENDING' ||
          (claim.metadata as Record<string, unknown> | null)?.verification !==
            'CUSTOMER_CLAIM_PENDING'
        )
          throw new ConflictException(
            'This payment claim is no longer awaiting verification',
          );
        await tx.orderPaymentTransaction.update({
          where: { id: claim.id },
          data: {
            status: 'FAILED',
            processedAt: new Date(),
            metadata: {
              ...((claim.metadata || {}) as Record<
                string,
                Prisma.InputJsonValue
              >),
              rejectionReason: dto.note.trim(),
              reviewedBy: actor.id,
            },
          },
        });
        return { transactionId, status: 'FAILED', note: dto.note.trim() };
      },
    );
  }
}
