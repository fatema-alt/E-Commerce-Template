import {
  checkoutGatewayReady,
  type CheckoutGateway,
} from '../payments/checkout-gateways.js';
import {
  pricePlan,
  defaultPlanSettings,
  type Plan,
} from '../payments/plan-pricing.js';
import {
  paymentHandlers,
  validMethod,
} from '../payments/manual-payment-handler.js';
import { calcShipping } from '../shop/shipping.config.js';
import type { ManualTransfer } from '../payments/manual-payment.config.js';
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
  manualPayments: { orderBy: { createdAt: 'desc' as const } },
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
      paymentStatus !== 'AWAITING_VERIFICATION' &&
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
        ? paymentStatus === 'AWAITING_VERIFICATION'
          ? { manualPayments: { some: { status: 'awaiting_verification' } } }
          : { paymentStatus: paymentStatus as OrderPaymentStatus }
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
            manualPayments: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { status: true },
            },
            paymentMethod: true,
            paymentOption: true,
            paidTotal: true,
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
      include: {
        ...orderInclude,
        items: {
          include: {
            product: {
              select: {
                slug: true,
                category: { select: { name: true } },
                images: {
                  select: { url: true, altText: true },
                  orderBy: { sortOrder: 'asc' },
                  take: 1,
                },
              },
            },
          },
        },
        idempotencyKeys: {
          select: { id: true, key: true, operation: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    const grandTotal = new Prisma.Decimal(order.grandTotal ?? 0);
    const paidTotal = new Prisma.Decimal(order.paidTotal ?? 0);
    const refundedTotal = new Prisma.Decimal(order.refundedTotal ?? 0);
    const netPaid = paidTotal.minus(refundedTotal);
    const due =
      order.paymentStatus === 'PAID'
        ? new Prisma.Decimal(0)
        : Prisma.Decimal.max(new Prisma.Decimal(0), grandTotal.minus(netPaid));
    return {
      ...order,
      outstandingBalance: due.toFixed(2),
      amountDueNow:
        order.paymentStatus === 'PAID'
          ? '0.00'
          : order.manualPayments?.length
            ? order.manualPayments[0].status === 'confirmed'
              ? '0.00'
              : Prisma.Decimal.min(
                  due,
                  order.manualPayments[0].amountDueNow,
                ).toFixed(2)
            : order.paymentOption === 'OPTION_A'
              ? Prisma.Decimal.min(
                  due,
                  Prisma.Decimal.max(0, order.shippingTotal.minus(netPaid)),
                ).toFixed(2)
              : order.paymentMethod === 'COD'
                ? '0.00'
                : due.toFixed(2),
      amountDueOnDelivery: order.manualPayments?.length
        ? order.paymentPlan === 'COD'
          ? due.toFixed(2)
          : Prisma.Decimal.min(
              due,
              order.manualPayments[0]?.amountDueOnDelivery ?? 0,
            ).toFixed(2)
        : order.paymentOption === 'OPTION_A'
          ? Prisma.Decimal.max(
              0,
              grandTotal.minus(
                Prisma.Decimal.max(netPaid, order.shippingTotal),
              ),
            ).toFixed(2)
          : ['MANUAL_BKASH', 'MANUAL_NAGAD', 'BANK_TRANSFER'].includes(
                order.paymentOption || '',
              )
            ? '0.00'
            : due.toFixed(2),
    };
  }

  async create(
    dto: CreateOrderDto,
    key: string | undefined,
    actorId: string,
    storefront?: {
      sessionId: string;
      expectedSubtotal: string;
      manualAccount?: ManualTransfer;
      checkout?: {
        plan: Plan;
        deliveryArea?: 'inside_dhaka' | 'outside_dhaka';
        gateway?: CheckoutGateway;
        paymentMethodId?: string;
        senderInfo?: string;
        reference?: string;
        expectedTotal: string;
        expectedNow: string;
      };
    },
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
      .update(
        JSON.stringify({
          actorId,
          canonical,
          manualProvider: storefront?.manualAccount?.id,
          checkout: storefront?.checkout,
        }),
      )
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

            let pricingCoupon: Awaited<
              ReturnType<typeof tx.coupon.findUnique>
            > = null;
            if (dto.couponCode) {
              const code = dto.couponCode.trim().toUpperCase();
              const coupon = await tx.coupon.findUnique({
                where: { code },
              });
              if (!coupon || !coupon.isActive) {
                throw new BadRequestException(
                  'Invalid or inactive coupon code',
                );
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
                customerConditions.push({
                  customerPhone: dto.customerPhone.trim(),
                });
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

              pricingCoupon = coupon;
              appliedCouponId = coupon.id;
              appliedCouponCode = coupon.code;
            }

            if (dto.onlineDiscount) {
              const onlineD = new D(dto.onlineDiscount);
              if (onlineD.greaterThan(discountTotal)) {
                discountTotal = onlineD;
              }
            }

            // Shipping total: passed in from shop.service (already server-verified)
            // or 0 for admin-created orders.
            let shippingTotal = dto.shippingTotal
              ? new D(dto.shippingTotal)
              : new D(0);

            let grandTotal = subtotal.minus(discountTotal).plus(shippingTotal);

            let checkoutPrice: ReturnType<typeof pricePlan> | undefined;
            let checkoutMethod: Awaited<
              ReturnType<typeof tx.paymentMethod.findUnique>
            > = null;
            let submission:
              { senderInfo: string; reference: string } | undefined;
            if (storefront?.checkout) {
              const input = storefront.checkout;
              const settings =
                (await tx.paymentSettings.findUnique({
                  where: { id: 'default' },
                })) || defaultPlanSettings;
              checkoutPrice = pricePlan(
                subtotal,
                input.plan,
                settings,
                (base) =>
                  calcShipping(
                    base.toNumber(),
                    dto.shippingAddress.city,
                    dto.shippingAddress.district,
                    input.deliveryArea,
                  ),
                pricingCoupon,
              );
              if (!checkoutPrice.available)
                throw new BadRequestException(
                  'The selected payment plan is unavailable',
                );
              if (
                !checkoutPrice.total.equals(input.expectedTotal) ||
                !checkoutPrice.payableNow.equals(input.expectedNow)
              )
                throw new ConflictException(
                  'Pricing settings changed. Review checkout again.',
                );
              if (input.gateway) {
                if (
                  input.plan === 'COD' ||
                  checkoutPrice.payableNow.lessThanOrEqualTo(0) ||
                  input.paymentMethodId ||
                  input.senderInfo ||
                  input.reference
                )
                  throw new BadRequestException(
                    'Choose either an online gateway or a manual payment method for a prepaid plan',
                  );
                const gateway = await tx.paymentGatewayConfig.findUnique({
                  where: { provider: input.gateway },
                });
                if (!gateway || !checkoutGatewayReady(gateway))
                  throw new BadRequestException(
                    'The selected online gateway is unavailable',
                  );
              }
              if (
                input.plan !== 'COD' &&
                checkoutPrice.payableNow.greaterThan(0) &&
                !input.gateway
              ) {
                if (!input.paymentMethodId)
                  throw new BadRequestException('Select a payment method');
                checkoutMethod = await tx.paymentMethod.findUnique({
                  where: { id: input.paymentMethodId },
                });
                if (
                  !checkoutMethod ||
                  checkoutMethod.deletedAt ||
                  !checkoutMethod.isEnabled ||
                  !validMethod(checkoutMethod.type, checkoutMethod.details)
                )
                  throw new BadRequestException(
                    'The selected payment method is unavailable',
                  );
                const handler = paymentHandlers.get(checkoutMethod.type);
                if (!handler)
                  throw new BadRequestException('Unsupported payment method');
                submission = handler.validate(
                  checkoutMethod.details,
                  input.senderInfo || '',
                  input.reference || '',
                );
                if (
                  await tx.manualOrderPayment.findUnique({
                    where: { reference: submission.reference },
                  })
                )
                  throw new ConflictException(
                    'This transaction reference has already been submitted.',
                  );
              } else if (
                input.paymentMethodId ||
                input.senderInfo ||
                input.reference
              )
                throw new BadRequestException(
                  'COD or a zero-total order does not need a payment method or transaction reference',
                );
              discountTotal = checkoutPrice.discount;
              shippingTotal = checkoutPrice.shipping;
              grandTotal = checkoutPrice.total;
              if (
                pricingCoupon &&
                !checkoutPrice.couponDiscount.greaterThan(0) &&
                pricingCoupon.type !== 'FREE_SHIPPING'
              ) {
                appliedCouponId = undefined;
                appliedCouponCode = undefined;
              }
            }
            const order = await tx.order.create({
              data: {
                orderNumber: `ORD-${randomUUID()}`,
                customerId: dto.customerId ?? null,
                customerName: dto.customerName.trim(),
                customerEmail: dto.customerEmail?.trim().toLowerCase(),
                customerPhone: dto.customerPhone.trim(),
                paymentMethod:
                  checkoutMethod?.type === 'bank' &&
                  storefront?.checkout?.plan === 'FULL_PAYMENT'
                    ? 'BANK_TRANSFER'
                    : dto.paymentMethod,
                paymentOption:
                  storefront?.checkout?.plan ?? dto.paymentOption ?? null,
                paymentPlan: storefront?.checkout?.plan,
                couponDiscount: checkoutPrice?.couponDiscount ?? discountTotal,
                prepaidDiscount: checkoutPrice?.prepaidDiscount ?? 0,
                ...(checkoutPrice?.total.isZero()
                  ? { paymentStatus: 'PAID' as const }
                  : {}),
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
            if (checkoutPrice && storefront?.checkout?.gateway) {
              await tx.orderPaymentTransaction.create({
                data: {
                  orderId: order.id,
                  type: 'PAYMENT',
                  status: 'PENDING',
                  provider: storefront.checkout.gateway,
                  idempotencyKey: `checkout-gateway:${order.id}`,
                  amount: checkoutPrice.payableNow,
                  currency: 'BDT',
                  metadata: {
                    checkoutIntent: true,
                    paymentPlan: storefront.checkout.plan,
                  },
                },
              });
            }
            if (checkoutPrice && checkoutMethod && submission) {
              await tx.manualOrderPayment.create({
                data: {
                  orderId: order.id,
                  plan: storefront!.checkout!.plan,
                  paymentMethodId: checkoutMethod.id,
                  methodSnapshot: {
                    name: checkoutMethod.name,
                    type: checkoutMethod.type,
                    logo: checkoutMethod.logo,
                    details: checkoutMethod.details,
                    instruction: checkoutMethod.instruction,
                  } as Prisma.InputJsonValue,
                  amountDueNow: checkoutPrice.payableNow,
                  amountDueOnDelivery: checkoutPrice.amountDueOnDelivery,
                  ...submission,
                },
              });
              await tx.orderEvent.create({
                data: {
                  orderId: order.id,
                  action: 'MANUAL_PAYMENT_SUBMITTED',
                  actorType: 'CUSTOMER',
                  actorId,
                },
              });
            }
            if (storefront?.manualAccount)
              await tx.orderEvent.create({
                data: {
                  orderId: order.id,
                  action: 'MANUAL_PAYMENT_INSTRUCTIONS',
                  actorType: 'SHOPPER',
                  actorId: storefront.sessionId,
                  after: { ...storefront.manualAccount },
                },
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
                  discountAmount:
                    checkoutPrice?.couponDiscount ?? discountTotal,
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
                    discountAmount: (
                      checkoutPrice?.couponDiscount ?? discountTotal
                    ).toString(),
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
            'Duplicate transaction reference or checkout key. Review your order before retrying.',
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
