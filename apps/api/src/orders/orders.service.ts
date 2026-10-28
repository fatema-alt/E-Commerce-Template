import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import {
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderStatus,
  Prisma,
  ProductStatus,
  ProductType,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';

const D = Prisma.Decimal;
const money = (value: Prisma.Decimal) => value.toDecimalPlaces(2);
export const orderInclude = {
  items: true,
  addresses: true,
  reservations: true,
  notes: true,
  payments: true,
  shipments: true,
  coupon: true,
  returns: { include: { items: true }, orderBy: { createdAt: 'asc' as const } },
  events: { orderBy: { createdAt: 'asc' as const } },
};

@Injectable()
export class OrdersService {
  constructor(protected readonly db: PrismaService) {}

  protected queryFilters(filters: {
    page?: string;
    limit?: string;
    status?: string;
    q?: string;
    paymentStatus?: string;
    paymentMethod?: string;
    from?: string;
    to?: string;
    sort?: string;
  }) {
    if (
      Object.values(filters).some(
        (value) => value !== undefined && typeof value !== 'string',
      )
    )
      throw new BadRequestException('Filter values must be strings');
    const { status, paymentStatus, paymentMethod, from, to } = filters;
    const page = filters.page === undefined ? 1 : Number(filters.page);
    const limit = filters.limit === undefined ? 20 : Number(filters.limit);
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      (page - 1) * limit > 2147483647
    )
      throw new BadRequestException('Invalid pagination');
    if (status && !Object.values(OrderStatus).includes(status as OrderStatus))
      throw new BadRequestException('Invalid order status');
    if (
      paymentStatus &&
      !Object.values(OrderPaymentStatus).includes(
        paymentStatus as OrderPaymentStatus,
      )
    )
      throw new BadRequestException('Invalid payment status');
    if (
      paymentMethod &&
      !Object.values(OrderPaymentMethod).includes(
        paymentMethod as OrderPaymentMethod,
      )
    )
      throw new BadRequestException('Invalid payment method');
    const q = (filters.q ?? '').trim();
    const contains = q.replace(/[\\%_]/g, '\\$&');
    if (q.length > 120)
      throw new BadRequestException('Search exceeds 120 characters');
    const parseDate = (value: string, end: boolean) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        throw new BadRequestException('Dates must use YYYY-MM-DD');
      const calendar = new Date(`${value}T00:00:00.000Z`);
      if (
        Number.isNaN(calendar.getTime()) ||
        calendar.toISOString().slice(0, 10) !== value
      )
        throw new BadRequestException('Invalid date');
      return new Date(
        `${value}T${end ? '23:59:59.999' : '00:00:00.000'}+06:00`,
      );
    };
    const start = from ? parseDate(from, false) : undefined;
    const end = to ? parseDate(to, true) : undefined;
    if (start && end && start > end)
      throw new BadRequestException('From date must not exceed to date');
    const sort = filters.sort ?? 'newest';
    const sorts: Record<string, Prisma.OrderOrderByWithRelationInput[]> = {
      newest: [{ createdAt: 'desc' }, { id: 'desc' }],
      oldest: [{ createdAt: 'asc' }, { id: 'asc' }],
      total_desc: [{ grandTotal: 'desc' }, { id: 'desc' }],
      total_asc: [{ grandTotal: 'asc' }, { id: 'asc' }],
    };
    if (!Object.hasOwn(sorts, sort))
      throw new BadRequestException('Invalid sort');
    const where: Prisma.OrderWhereInput = {
      ...(status ? { status: status as OrderStatus } : {}),
      ...(paymentStatus
        ? { paymentStatus: paymentStatus as OrderPaymentStatus }
        : {}),
      ...(paymentMethod
        ? { paymentMethod: paymentMethod as OrderPaymentMethod }
        : {}),
      ...(start || end
        ? {
            createdAt: {
              ...(start ? { gte: start } : {}),
              ...(end ? { lte: end } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { orderNumber: { contains, mode: 'insensitive' } },
              { customerName: { contains, mode: 'insensitive' } },
              { customerPhone: { contains } },
              { customerEmail: { contains, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return { page, limit, where, orderBy: sorts[sort] };
  }

  async list(filters: Parameters<OrdersService['queryFilters']>[0]) {
    const { page, limit, where, orderBy } = this.queryFilters(filters);
    const [items, total] = await this.db.$transaction(
      [
        this.db.order.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            customerPhone: true,
            status: true,
            paymentStatus: true,
            paymentMethod: true,
            grandTotal: true,
            createdAt: true,
          },
        }),
        this.db.order.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total, page, limit };
  }

  async detail(id: string) {
    const order = await this.db.order.findUnique({
      where: { id },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async create(
    dto: CreateOrderDto,
    key: string | undefined,
    actorId: string,
    storefront?: { sessionId: string; expectedSubtotal: string },
  ) {
    if (
      !key ||
      key.length < 16 ||
      key.length > 128 ||
      !/^[a-zA-Z0-9._:-]+$/.test(key)
    )
      throw new BadRequestException(
        'Idempotency-Key header (16-128 characters) is required',
      );
    if (!dto.items?.length || !dto.shippingAddress)
      throw new BadRequestException('Items and shipping address required');
    const unique = new Set(
      dto.items.map((x) => `${x.productId}:${x.variantId ?? ''}`),
    );
    if (unique.size !== dto.items.length)
      throw new BadRequestException('Duplicate product lines');
    if (
      dto.items.some((x) => !Number.isSafeInteger(x.quantity) || x.quantity < 1)
    )
      throw new BadRequestException('Invalid quantity');
    // Never trust client-provided prices, discounts, shipping, tax or payment confirmations.
    // Canonicalize item ordering to make retry hashes stable.
    const canonical = {
      ...dto,
      items: [...dto.items].sort((a, b) =>
        `${a.productId}:${a.variantId ?? ''}`.localeCompare(
          `${b.productId}:${b.variantId ?? ''}`,
        ),
      ),
    };
    const hash = createHash('sha256')
      .update(JSON.stringify({ actorId, canonical }))
      .digest('hex');
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.db.$transaction(
          async (tx) => {
            // Unique insert serializes same-key concurrent requests; rolled-back attempts leave no key.
            const existing = await tx.orderIdempotencyKey.findUnique({
              where: { key },
            });
            if (existing) {
              if (
                existing.requestHash !== hash ||
                existing.operation !== 'ORDER_CREATE'
              )
                throw new ConflictException(
                  'Idempotency key reused for a different request',
                );
              if (!existing.orderId)
                throw new ConflictException(
                  'Request is already being processed',
                );
              return tx.order.findUniqueOrThrow({
                where: { id: existing.orderId },
                include: orderInclude,
              });
            }
            await tx.orderIdempotencyKey.create({
              data: {
                key,
                operation: 'ORDER_CREATE',
                requestHash: hash,
                expiresAt: new Date(Date.now() + 7 * 86400000),
              },
            });
            if (dto.customerId) {
              const customer = await tx.customer.findFirst({
                where: {
                  id: dto.customerId,
                  status: 'ACTIVE',
                  deletedAt: null,
                },
              });
              if (!customer)
                throw new BadRequestException(
                  'Registered customer not found or inactive',
                );
            }
            const lines: {
              productId: string;
              variantId?: string;
              inventoryId?: string;
              sku: string;
              name: string;
              variantSnapshot?: Prisma.InputJsonValue;
              quantity: number;
              unitPrice: Prisma.Decimal;
              lineTotal: Prisma.Decimal;
            }[] = [];
            for (const input of canonical.items) {
              const product = await tx.product.findFirst({
                where: {
                  id: input.productId,
                  status: ProductStatus.ACTIVE,
                  isActive: true,
                  isVisible: true,
                  deletedAt: null,
                },
                include: { inventory: true },
              });
              if (!product)
                throw new BadRequestException('Product unavailable');
              if (product.currency !== 'BDT')
                throw new BadRequestException('Unsupported currency');
              if (storefront) {
                const [blocked] = await tx.$queryRaw<
                  { count: bigint }[]
                >`WITH RECURSIVE parents AS (SELECT id, "parentId", "isActive", "isVisible" FROM categories WHERE id = ${product.categoryId} UNION SELECT c.id, c."parentId", c."isActive", c."isVisible" FROM categories c JOIN parents p ON c.id = p."parentId") SELECT COUNT(*) AS count FROM parents WHERE NOT "isActive" OR NOT "isVisible"`;
                if (Number(blocked.count))
                  throw new BadRequestException('Product unavailable');
              }
              let variant: Awaited<
                ReturnType<typeof tx.productVariant.findUnique>
              > | null = null;
              if (product.type === ProductType.VARIABLE) {
                if (!input.variantId)
                  throw new BadRequestException('Variant required');
                variant = await tx.productVariant.findFirst({
                  where: {
                    id: input.variantId,
                    productId: product.id,
                    isActive: true,
                  },
                });
                if (!variant)
                  throw new BadRequestException('Variant unavailable');
              } else if (input.variantId)
                throw new BadRequestException(
                  'Simple product cannot use a variant',
                );
              const inventory = product.trackInventory
                ? await tx.inventory.findFirst({
                    where: variant
                      ? { variantId: variant.id }
                      : { productId: product.id },
                  })
                : null;
              if (product.trackInventory && !inventory)
                throw new ConflictException('Inventory missing');
              // Do not silently permit backorders: this implementation only supports stock-backed orders.
              const base = variant ? variant.price : product.price;
              const sale = variant ? variant.salePrice : product.salePrice;
              const unitPrice = money(
                sale &&
                  sale.lessThan(base) &&
                  (!product.saleStartsAt ||
                    product.saleStartsAt <= new Date()) &&
                  (!product.saleEndsAt || product.saleEndsAt > new Date())
                  ? sale
                  : base,
              );
              if (unitPrice.isNegative())
                throw new BadRequestException('Invalid catalog price');
              lines.push({
                productId: product.id,
                variantId: variant?.id,
                inventoryId: inventory?.id,
                sku: variant?.sku ?? product.sku,
                name: product.name,
                variantSnapshot: variant
                  ? (variant.attributes as Prisma.InputJsonValue)
                  : undefined,
                quantity: input.quantity,
                unitPrice,
                lineTotal: money(unitPrice.mul(input.quantity)),
              });
            }
            // Conditional updates protect quantity - reserved even under concurrent checkout.
            // Reserve in consistent inventory-id order to reduce deadlock probability.
            for (const line of [...lines]
              .filter((l) => l.inventoryId)
              .sort((a, b) => a.inventoryId!.localeCompare(b.inventoryId!))) {
              const updated =
                await tx.$executeRaw`UPDATE "inventories" SET "reserved" = "reserved" + ${line.quantity}, "updatedAt" = NOW() WHERE "id" = ${line.inventoryId} AND "quantity" - "reserved" >= ${line.quantity}`;
              if (updated !== 1)
                throw new ConflictException(
                  `Insufficient stock for ${line.sku}`,
                );
            }
            const subtotal = lines.reduce(
              (sum, l) => sum.plus(l.lineTotal),
              new D(0),
            );
            if (storefront && !subtotal.equals(storefront.expectedSubtotal))
              throw new ConflictException(
                'Prices changed. Review your cart again.',
              );
            let discountTotal = new D(0);
            let appliedCouponId: string | undefined;
            let appliedCouponCode: string | undefined;

            if (dto.couponCode) {
              const code = dto.couponCode.trim().toUpperCase();
              const coupon = await tx.coupon.findUnique({
                where: { code },
              });
              if (!coupon || !coupon.isActive) {
                throw new BadRequestException('Invalid or inactive coupon code');
              }
              const now = new Date();
              if (coupon.startsAt && coupon.startsAt > now) {
                throw new BadRequestException(
                  'Coupon promotion has not started yet',
                );
              }
              if (coupon.expiresAt && coupon.expiresAt < now) {
                throw new BadRequestException('Coupon code has expired');
              }
              if (
                coupon.usageLimit !== null &&
                coupon.usageLimit !== undefined &&
                coupon.usageCount >= coupon.usageLimit
              ) {
                throw new BadRequestException('Coupon usage limit reached');
              }
              if (
                coupon.minOrderAmount &&
                subtotal.lessThan(coupon.minOrderAmount)
              ) {
                throw new BadRequestException(
                  `Minimum order amount of ৳${coupon.minOrderAmount} required`,
                );
              }

              const customerConditions: Prisma.CouponUsageWhereInput[] = [];
              if (dto.customerId) {
                customerConditions.push({ customerId: dto.customerId });
              }
              if (dto.customerPhone) {
                customerConditions.push({ customerPhone: dto.customerPhone.trim() });
              }
              if (dto.customerEmail) {
                customerConditions.push({
                  customerEmail: dto.customerEmail.trim().toLowerCase(),
                });
              }

              if (customerConditions.length > 0) {
                const count = await tx.couponUsage.count({
                  where: { couponId: coupon.id, OR: customerConditions },
                });
                if (count >= coupon.perCustomerLimit) {
                  throw new BadRequestException(
                    'Coupon usage limit exceeded for your account',
                  );
                }
              }

              if (coupon.type === 'PERCENTAGE') {
                discountTotal = subtotal
                  .mul(coupon.value)
                  .div(100)
                  .toDecimalPlaces(2);
                if (
                  coupon.maxDiscountAmount &&
                  discountTotal.greaterThan(coupon.maxDiscountAmount)
                ) {
                  discountTotal = coupon.maxDiscountAmount;
                }
              } else if (coupon.type === 'FIXED_AMOUNT') {
                discountTotal = coupon.value.greaterThan(subtotal)
                  ? subtotal
                  : coupon.value;
              }

              appliedCouponId = coupon.id;
              appliedCouponCode = coupon.code;
            }

            // Shipping total: passed in from shop.service (already server-verified)
            // or 0 for admin-created orders.
            const shippingTotal = dto.shippingTotal
              ? new D(dto.shippingTotal)
              : new D(0);

            const grandTotal = subtotal.minus(discountTotal).plus(shippingTotal);

            const order = await tx.order.create({
              data: {
                orderNumber: `ORD-${randomUUID()}`,
                customerId: dto.customerId ?? null,
                customerName: dto.customerName.trim(),
                customerEmail: dto.customerEmail?.trim().toLowerCase(),
                customerPhone: dto.customerPhone.trim(),
                paymentMethod: dto.paymentMethod,
                source: storefront ? 'STOREFRONT' : undefined,
                subtotal,
                discountTotal,
                shippingTotal,
                grandTotal,
                couponId: appliedCouponId,
                couponCode: appliedCouponCode,
                customerNote: dto.customerNote,
                items: {
                  create: lines.map((l) => ({
                    id: randomUUID(),
                    productId: l.productId,
                    variantId: l.variantId,
                    skuSnapshot: l.sku,
                    nameSnapshot: l.name,
                    ...(l.variantSnapshot
                      ? { variantSnapshot: l.variantSnapshot }
                      : {}),
                    quantity: l.quantity,
                    unitPrice: l.unitPrice,
                    lineTotal: l.lineTotal,
                  })),
                },
                addresses: {
                  create: [
                    {
                      type: 'SHIPPING',
                      recipientName: dto.shippingAddress.recipientName,
                      phone: dto.shippingAddress.phone,
                      line1: dto.shippingAddress.line1,
                      line2: dto.shippingAddress.line2,
                      city: dto.shippingAddress.city,
                      district: dto.shippingAddress.district,
                      division: dto.shippingAddress.division,
                      upazila: dto.shippingAddress.upazila,
                      postalCode: dto.shippingAddress.postalCode,
                      countryCode: 'BD',
                    },
                  ],
                },
                events: {
                  create: [
                    {
                      action: 'ORDER_CREATED',
                      actorType: storefront ? 'CUSTOMER' : 'ADMIN',
                      actorId,
                    },
                  ],
                },
              },
              include: { items: true },
            });
            for (const line of lines) {
              const item = order.items.find(
                (i) =>
                  i.productId === line.productId &&
                  i.variantId === (line.variantId ?? null),
              );
              if (!item)
                throw new ConflictException('Order line creation mismatch');
              if (line.inventoryId)
                await tx.orderStockReservation.create({
                  data: {
                    orderId: order.id,
                    orderItemId: item.id,
                    inventoryId: line.inventoryId,
                    quantity: line.quantity,
                  },
                });
            }
            if (appliedCouponId) {
              await tx.couponUsage.create({
                data: {
                  couponId: appliedCouponId,
                  orderId: order.id,
                  customerId: dto.customerId ?? null,
                  customerPhone: dto.customerPhone.trim(),
                  customerEmail:
                    dto.customerEmail?.trim().toLowerCase() ?? null,
                  discountAmount: discountTotal,
                },
              });
              await tx.coupon.update({
                where: { id: appliedCouponId },
                data: { usageCount: { increment: 1 } },
              });
              await tx.orderEvent.create({
                data: {
                  orderId: order.id,
                  action: 'COUPON_APPLIED',
                  actorType: storefront ? 'CUSTOMER' : 'ADMIN',
                  actorId,
                  after: {
                    couponCode: appliedCouponCode,
                    discountAmount: discountTotal.toString(),
                  },
                },
              });
            }
            await tx.orderIdempotencyKey.update({
              where: { key },
              data: { orderId: order.id, responseStatus: 201 },
            });
            if (storefront)
              await tx.shopperOrderAccess.create({
                data: { sessionId: storefront.sessionId, orderId: order.id },
              });
            return tx.order.findUniqueOrThrow({
              where: { id: order.id },
              include: orderInclude,
            });
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            timeout: 15000,
          },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt < 2
        )
          continue;
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const existing = await this.db.orderIdempotencyKey.findUnique({
            where: { key },
          });
          if (existing?.requestHash === hash && existing.orderId)
            return this.detail(existing.orderId);
          throw new ConflictException(
            'Duplicate idempotency key or order number',
          );
        }
        throw error;
      }
    }
    throw new ConflictException(
      'Transaction contention; retry with same Idempotency-Key',
    );
  }
}
