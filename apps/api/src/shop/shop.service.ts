import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { OrdersService } from '../orders/orders.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { PromotionsService } from '../promotions/promotions.service.js';
import { calcShipping, getShippingRates } from './shipping.config.js';
import { ManualPaymentsService } from './manual-payments.service.js';
import { isManualProvider } from '../payments/manual-payment.config.js';
import type { ManualPaymentSubmissionDto } from './shop.dto.js';
import type {
  QuoteDto,
  RegisterShopperDto,
  ShopCheckoutDto,
  ValidateCouponDto,
} from './shop.dto.js';
export const SHOP_COOKIE = 'commerce_shopper';
export const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const devSecret = randomBytes(32).toString('hex');
const secret = () => {
  const value = process.env.STOREFRONT_CHECKOUT_SECRET;
  if (process.env.NODE_ENV === 'production' && (!value || value.length < 32))
    throw new Error(
      'STOREFRONT_CHECKOUT_SECRET must be at least 32 characters in production',
    );
  return value || devSecret;
};
const publicUser = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
} as const;
@Injectable()
export class ShopService {
  async payments() {
    return this.paymentsService.getMethods();
  }
  constructor(
    private readonly db: PrismaService,
    private readonly orders: OrdersService,
    private readonly paymentsService: PaymentsService,
    private readonly promotionsService: PromotionsService,
    private readonly manualPayments?: ManualPaymentsService,
  ) {}
  async throttle(
    operation: string,
    identity: string,
    max: number,
    seconds = 900,
  ) {
    const bucket = Math.floor(Date.now() / (seconds * 1000));
    const key = digest(`${operation}:${identity}:${bucket}`);
    const row = await this.db.storefrontThrottle.upsert({
      where: { key },
      create: {
        key,
        count: 1,
        expiresAt: new Date((bucket + 1) * seconds * 1000),
      },
      update: { count: { increment: 1 } },
    });
    if (row.count > max)
      throw new HttpException(
        'Too many attempts. Please try again later.',
        429,
      );
  }
  async session(token?: string) {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const session = await this.db.shopperSession.findUnique({
      where: { tokenHash: digest(token) },
      include: {
        customer: { select: { ...publicUser, status: true, deletedAt: true } },
      },
    });
    if (!session || session.expiresAt <= new Date()) return null;
    if (
      session.customer &&
      (session.customer.deletedAt || session.customer.status !== 'ACTIVE')
    )
      return null;
    return session;
  }
  async newSession(customerId?: string, previousToken?: string) {
    const token = randomBytes(32).toString('hex');
    const previous = await this.session(previousToken);
    const session = await this.db.$transaction(async (tx) => {
      const next = await tx.shopperSession.create({
        data: {
          tokenHash: digest(token),
          customerId,
          expiresAt: new Date(Date.now() + 30 * 86400000),
        },
      });
      if (previous && !previous.customerId && customerId) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'shopper-session:' + previous.id}))`;
        const active = await tx.shopperSession.findFirst({
          where: {
            id: previous.id,
            customerId: null,
            expiresAt: { gt: new Date() },
          },
        });
        if (active) {
          const owned = await tx.order.findMany({
            where: {
              customerId: null,
              shopperAccess: { sessionId: previous.id },
            },
            select: { id: true },
          });
          await tx.order.updateMany({
            where: { id: { in: owned.map((order) => order.id) } },
            data: { customerId },
          });
          await tx.shopperOrderAccess.updateMany({
            where: { sessionId: previous.id },
            data: { sessionId: next.id },
          });
          await tx.orderEvent.createMany({
            data: owned.map((order) => ({
              orderId: order.id,
              action: 'GUEST_ORDER_LINKED',
              actorType: 'CUSTOMER',
              actorId: customerId,
            })),
          });
        }
      }
      if (previous)
        await tx.shopperSession.update({
          where: { id: previous.id },
          data: { expiresAt: new Date(0) },
        });
      return next;
    });
    return { token, session };
  }
  async me(token?: string) {
    const session = await this.session(token);
    if (!session?.customerId) return { user: null };
    return {
      user: await this.db.customer.findUnique({
        where: { id: session.customerId },
        select: publicUser,
      }),
    };
  }
  async register(dto: RegisterShopperDto) {
    const passwordHash = await hashPassword(dto.password);
    try {
      return await this.db.customer.create({
        data: {
          email: dto.email.toLowerCase(),
          firstName: dto.name,
          shopperAccount: { create: { passwordHash } },
        },
        select: publicUser,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'Unable to create this account. Use your existing sign-in or contact the store.',
        );
      throw error;
    }
  }
  async login(email: string, password: string) {
    const customer = await this.db.customer.findUnique({
      where: { email: email.toLowerCase() },
      include: { shopperAccount: true },
    });
    const valid = await verifyPassword(
      password,
      customer?.shopperAccount?.passwordHash ||
        'scrypt:00000000000000000000000000000000:' + '00'.repeat(64),
    );
    if (
      !customer ||
      !valid ||
      customer.status !== 'ACTIVE' ||
      customer.deletedAt
    )
      throw new UnauthorizedException('Invalid email or password');
    return customer.id;
  }
  async logout(token?: string) {
    if (token)
      await this.db.shopperSession.updateMany({
        where: { tokenHash: digest(token) },
        data: { expiresAt: new Date(0) },
      });
  }
  async changePassword(
    token: string | undefined,
    current: string,
    next: string,
  ) {
    const session = await this.session(token);
    if (!session?.customerId) throw new UnauthorizedException();
    await this.throttle('password-change', session.id, 10);
    const account = await this.db.shopperAccount.findUnique({
      where: { customerId: session.customerId },
    });
    if (!account || !(await verifyPassword(current, account.passwordHash)))
      throw new UnauthorizedException('Current password is incorrect');
    const passwordHash = await hashPassword(next);
    await this.db.$transaction([
      this.db.shopperAccount.update({
        where: { id: account.id },
        data: { passwordHash },
      }),
      this.db.shopperSession.updateMany({
        where: { customerId: session.customerId, id: { not: session.id } },
        data: { expiresAt: new Date(0) },
      }),
    ]);
    return { ok: true };
  }
  async quote(dto: QuoteDto, sessionId: string) {
    if (
      new Set(dto.items.map((i) => `${i.productId}:${i.variantId || ''}`))
        .size !== dto.items.length
    )
      throw new BadRequestException('Duplicate cart lines');
    const items = [];
    let subtotal = new Prisma.Decimal(0);
    for (const line of dto.items) {
      const product = await this.db.product.findFirst({
        where: {
          id: line.productId,
          status: 'ACTIVE',
          deletedAt: null,
          isActive: true,
          isVisible: true,
        },
        include: {
          inventory: true,
          variants: { where: { isActive: true }, include: { inventory: true } },
          images: { take: 1, orderBy: { sortOrder: 'asc' } },
        },
      });
      if (!product || product.currency !== 'BDT')
        throw new BadRequestException('A cart product is no longer available');
      const [blocked] = await this.db.$queryRaw<
        { count: bigint }[]
      >`WITH RECURSIVE parents AS (SELECT id, "parentId", "isActive", "isVisible" FROM categories WHERE id = ${product.categoryId} UNION SELECT c.id, c."parentId", c."isActive", c."isVisible" FROM categories c JOIN parents p ON c.id = p."parentId") SELECT COUNT(*) AS count FROM parents WHERE NOT "isActive" OR NOT "isVisible"`;
      if (Number(blocked.count))
        throw new BadRequestException('A cart product is no longer available');
      const variant = line.variantId
        ? product.variants.find((v) => v.id === line.variantId)
        : undefined;
      if (product.type === 'VARIABLE' ? !variant : !!line.variantId)
        throw new BadRequestException('Choose an available product variant');
      const inventory = variant ? variant.inventory : product.inventory;
      if (
        product.trackInventory &&
        (!inventory || inventory.quantity - inventory.reserved < line.quantity)
      )
        throw new ConflictException(
          `${product.name}: requested quantity is unavailable`,
        );
      const base = variant?.price ?? product.price;
      const sale = variant ? variant.salePrice : product.salePrice;
      const now = new Date();
      const onSale =
        sale &&
        sale.lessThan(base) &&
        (!product.saleStartsAt || product.saleStartsAt <= now) &&
        (!product.saleEndsAt || product.saleEndsAt > now);
      const unitPrice = (onSale ? sale! : base).toDecimalPlaces(2);
      const lineTotal = unitPrice.mul(line.quantity).toDecimalPlaces(2);
      subtotal = subtotal.plus(lineTotal);
      items.push({
        ...line,
        name: product.name,
        variantName: variant?.name,
        slug: product.slug,
        imageUrl: product.images[0]?.url,
        unitPrice: unitPrice.toFixed(2),
        lineTotal: lineTotal.toFixed(2),
      });
    }

    let discount = new Prisma.Decimal(0);
    let appliedCoupon:
      | { code: string; discount: string; description?: string | null }
      | undefined;

    if (dto.couponCode) {
      const evalRes = await this.promotionsService.evaluateCoupon(
        dto.couponCode,
        subtotal,
      );
      discount = evalRes.discountAmount;
      appliedCoupon = {
        code: evalRes.code,
        discount: discount.toFixed(2),
        description: evalRes.description,
      };
    }

    const paymentModelCfg = this.paymentsService?.getPaymentModelConfig
      ? await this.paymentsService.getPaymentModelConfig()
      : { optionCDiscountPercent: 0, optionCDiscountFixed: 0 };

    let onlinePaymentDiscount = new Prisma.Decimal(0);
    if (dto.paymentOption === 'OPTION_C') {
      if (paymentModelCfg.optionCDiscountPercent > 0) {
        onlinePaymentDiscount = subtotal
          .mul(paymentModelCfg.optionCDiscountPercent)
          .div(100)
          .toDecimalPlaces(2);
      } else if (paymentModelCfg.optionCDiscountFixed > 0) {
        onlinePaymentDiscount = Prisma.Decimal.min(
          subtotal,
          new Prisma.Decimal(paymentModelCfg.optionCDiscountFixed),
        ).toDecimalPlaces(2);
      }
    }

    // Non-stacking rule with coupons: apply whichever gives the larger discount
    let effectiveDiscount = discount;
    if (dto.paymentOption === 'OPTION_C') {
      if (onlinePaymentDiscount.greaterThan(discount)) {
        effectiveDiscount = onlinePaymentDiscount;
        appliedCoupon = undefined; // Coupon discount replaced by larger online discount
      } else {
        onlinePaymentDiscount = new Prisma.Decimal(0);
      }
    }

    const total = subtotal.minus(effectiveDiscount);

    // --- Shipping calculation ---
    // city/district are optional hints sent from the storefront address form.
    // If not provided yet (cart page), we return the default outside-Dhaka rate
    // so the customer can see an estimate; the final amount is re-verified on
    // checkout submission using the confirmed shipping address.
    const shippingFee = calcShipping(total.toNumber(), dto.city, dto.district);
    const shipping = new Prisma.Decimal(shippingFee);
    const grandTotal = total.plus(shipping);

    // Rates config surfaced to the client so the UI can display the rule.
    const rates = getShippingRates();

    let payableNow = grandTotal;
    let amountDueOnDelivery = new Prisma.Decimal(0);
    if (dto.paymentOption === 'OPTION_A') {
      payableNow = shipping;
      amountDueOnDelivery = total;
    } else if (dto.paymentOption === 'COD') {
      payableNow = grandTotal;
      amountDueOnDelivery = grandTotal;
    } else {
      payableNow = grandTotal;
      amountDueOnDelivery = new Prisma.Decimal(0);
    }

    const payload = Buffer.from(
      JSON.stringify({
        sessionId,
        items: dto.items,
        subtotal: subtotal.toFixed(2),
        discount: effectiveDiscount.toFixed(2),
        shipping: shipping.toFixed(2),
        city: dto.city,
        district: dto.district,
        couponCode: appliedCoupon?.code,
        paymentOption: dto.paymentOption,
        expires: Date.now() + 10 * 60000,
      }),
    ).toString('base64url');
    const quoteToken =
      payload +
      '.' +
      createHmac('sha256', secret()).update(payload).digest('hex');
    return {
      items,
      subtotal: subtotal.toFixed(2),
      discount: effectiveDiscount.toFixed(2),
      onlinePaymentDiscount: onlinePaymentDiscount.toFixed(2),
      coupon: appliedCoupon,
      shipping: shipping.toFixed(2),
      tax: '0.00',
      total: grandTotal.toFixed(2),
      payableNow: payableNow.toFixed(2),
      amountDueOnDelivery: amountDueOnDelivery.toFixed(2),
      paymentOption: dto.paymentOption,
      currency: 'BDT',
      quoteToken,
      shippingRates: {
        insideDhaka: rates.insideDhaka,
        outsideDhaka: rates.outsideDhaka,
        freeAbove: rates.freeAbove,
      },
    };
  }

  async validateCoupon(dto: ValidateCouponDto, token?: string) {
    const session = await this.session(token);
    const quoteRes = await this.quote(
      { items: dto.items, couponCode: dto.code },
      session?.id || 'guest',
    );
    return {
      valid: true,
      coupon: quoteRes.coupon,
      subtotal: quoteRes.subtotal,
      discount: quoteRes.discount,
      total: quoteRes.total,
    };
  }
  async checkout(
    dto: ShopCheckoutDto,
    token: string | undefined,
    key: string | undefined,
  ) {
    const session = await this.session(token);
    if (!session)
      throw new UnauthorizedException(
        'Your checkout session expired. Review your cart again.',
      );
    const [payload, signature] = dto.quoteToken.split('.');
    const expected = createHmac('sha256', secret())
      .update(payload || '')
      .digest();
    const provided = Buffer.from(signature || '', 'hex');
    if (
      provided.length !== expected.length ||
      !timingSafeEqual(expected, provided)
    )
      throw new BadRequestException('Invalid checkout quote');
    let quote: {
      sessionId: string;
      items: QuoteDto['items'];
      subtotal: string;
      discount?: string;
      shipping?: string;
      city?: string;
      district?: string;
      couponCode?: string;
      paymentOption?: string;
      expires: number;
    };
    try {
      quote = JSON.parse(Buffer.from(payload, 'base64url').toString());
    } catch {
      throw new BadRequestException('Invalid checkout quote');
    }
    if (
      quote.sessionId !== session.id ||
      quote.expires < Date.now() ||
      JSON.stringify(quote.items) !== JSON.stringify(dto.items)
    )
      throw new ConflictException(
        'Your cart changed or quote expired. Review it again.',
      );

    // --- Re-verify shipping fee server-side using the confirmed address ---
    // The city/district hint stored in the quoteToken is advisory; we always
    // re-calculate from the actual shipping address supplied in the DTO.
    const confirmedShippingFee = calcShipping(
      parseFloat(quote.subtotal) - parseFloat(quote.discount ?? '0'),
      dto.shippingAddress?.city,
      dto.shippingAddress?.district,
    );
    const shippingTotal = new Prisma.Decimal(confirmedShippingFee);

    // Tolerate ±1 BDT rounding drift but reject any material mismatch if quote.shipping was provided.
    // This prevents a customer from gaming the quote by changing address after locking the token.
    if (quote.shipping !== undefined) {
      const quotedShipping = new Prisma.Decimal(quote.shipping);
      if (shippingTotal.minus(quotedShipping).abs().greaterThan(1)) {
        throw new ConflictException(
          'Delivery address changed — please review your order summary and try again.',
        );
      }
    }

    const availablePayments = await this.payments();
    const paymentOption =
      dto.paymentOption ||
      (dto.paymentMethod === 'BANK_TRANSFER'
        ? 'BANK_TRANSFER'
        : dto.paymentMethod === 'COD' || !dto.paymentMethod
          ? 'COD'
          : 'OPTION_B');
    if (quote.paymentOption && quote.paymentOption !== paymentOption)
      throw new ConflictException(
        'Payment option changed. Review your order again.',
      );
    const manualAccount = availablePayments.manualTransfers?.find(
      (account) => account.id === paymentOption,
    );
    if (isManualProvider(paymentOption)) {
      if (
        !manualAccount ||
        dto.paymentMethod !==
          (paymentOption === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'MANUAL')
      )
        throw new BadRequestException(
          'The selected manual payment method is unavailable',
        );
    } else if (
      dto.paymentMethod === 'MANUAL' ||
      dto.paymentMethod === 'BANK_TRANSFER' ||
      (paymentOption === 'COD' &&
        dto.paymentMethod &&
        dto.paymentMethod !== 'COD') ||
      (['OPTION_A', 'OPTION_B', 'OPTION_C'].includes(paymentOption) &&
        (!dto.paymentMethod || ['COD', 'MANUAL'].includes(dto.paymentMethod)))
    ) {
      throw new BadRequestException(
        'Payment method does not match the selected option',
      );
    }
    if (
      !manualAccount &&
      !availablePayments.methods.some(
        (method) =>
          method.id === (dto.paymentMethod || 'COD') && method.enabled,
      )
    )
      throw new BadRequestException(
        'The selected payment method is currently unavailable',
      );
    if (dto.paymentMethod === 'BANK_TRANSFER' && !availablePayments.bank)
      throw new BadRequestException('Bank transfer is not available');
    const { quoteToken: _quote, ...data } = dto;
    if (paymentOption === 'OPTION_A' && shippingTotal.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'Advance delivery payment is not applicable for free delivery orders',
      );
    }

    let verifiedOnlineDiscount = new Prisma.Decimal(0);
    if (paymentOption === 'OPTION_C') {
      const paymentModelCfg = this.paymentsService?.getPaymentModelConfig
        ? await this.paymentsService.getPaymentModelConfig()
        : { optionCDiscountPercent: 0, optionCDiscountFixed: 0 };
      if (paymentModelCfg.optionCDiscountPercent > 0) {
        verifiedOnlineDiscount = new Prisma.Decimal(quote.subtotal)
          .mul(paymentModelCfg.optionCDiscountPercent)
          .div(100)
          .toDecimalPlaces(2);
      } else if (paymentModelCfg.optionCDiscountFixed > 0) {
        verifiedOnlineDiscount = Prisma.Decimal.min(
          new Prisma.Decimal(quote.subtotal),
          new Prisma.Decimal(paymentModelCfg.optionCDiscountFixed),
        ).toDecimalPlaces(2);
      }
    }

    const order = await this.orders.create(
      {
        ...data,
        customerId: session.customerId || undefined,
        paymentMethod: dto.paymentMethod || 'COD',
        paymentOption,
        couponCode: quote.couponCode || dto.couponCode,
        onlineDiscount: verifiedOnlineDiscount.greaterThan(0)
          ? verifiedOnlineDiscount.toFixed(2)
          : undefined,
        shippingTotal: shippingTotal.toFixed(2),
      },
      key ? `shop:${session.id}:${key}` : undefined,
      session.id,
      { sessionId: session.id, expectedSubtotal: quote.subtotal },
    );
    if (manualAccount)
      await this.manualPayments!.capture(order.id, manualAccount, session.id);
    return this.order(order.id, token);
  }
  private async scope(token?: string) {
    const session = await this.session(token);
    if (!session) throw new UnauthorizedException();
    return {
      OR: [
        { shopperAccess: { sessionId: session.id } },
        ...(session.customerId ? [{ customerId: session.customerId }] : []),
      ],
    };
  }
  async listOrders(token?: string, page = 1) {
    const where = await this.scope(token);
    const [items, total] = await this.db.$transaction([
      this.db.order.findMany({
        where,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          grandTotal: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * 20,
        take: 20,
      }),
      this.db.order.count({ where }),
    ]);
    return { items, total, page };
  }
  async submitManualPayment(
    id: string,
    token: string | undefined,
    dto: ManualPaymentSubmissionDto,
  ) {
    const scope = await this.scope(token);
    const session = await this.session(token);
    return this.manualPayments!.submit(id, scope, dto, session!.id);
  }
  async order(id: string, token?: string) {
    const order = await this.db.order.findFirst({
      where: { id, ...(await this.scope(token)) },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        paymentOption: true,
        paidTotal: true,
        refundedTotal: true,
        createdAt: true,
        grandTotal: true,
        discountTotal: true,
        couponCode: true,
        shippingTotal: true,
        taxTotal: true,
        subtotal: true,
        customerName: true,
        customerPhone: true,
        customerNote: true,
        items: {
          select: {
            nameSnapshot: true,
            skuSnapshot: true,
            variantSnapshot: true,
            product: {
              select: {
                images: {
                  take: 1,
                  orderBy: { sortOrder: 'asc' },
                  select: { url: true },
                },
              },
            },
            quantity: true,
            unitPrice: true,
            lineTotal: true,
          },
        },
        addresses: {
          select: {
            recipientName: true,
            phone: true,
            line1: true,
            line2: true,
            city: true,
            district: true,
            postalCode: true,
          },
        },
        shipments: {
          select: {
            provider: true,
            trackingNumber: true,
            status: true,
            shippedAt: true,
            deliveredAt: true,
          },
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
      amountDueOnDelivery: isManualProvider(order.paymentOption)
        ? '0.00'
        : due.toFixed(2),
      ...(isManualProvider(order.paymentOption) && this.manualPayments
        ? { manualPayment: await this.manualPayments.details(id) }
        : {}),
    };
  }
  async subscribe(email: string) {
    await this.db.newsletterSubscription.upsert({
      where: { email: email.toLowerCase() },
      create: {
        email: email.toLowerCase(),
        tokenHash: digest(randomBytes(32).toString('hex')),
      },
      update: {},
    });
    return { message: 'Your newsletter request has been recorded.' };
  }
  async newsletter(token?: string, consent?: boolean) {
    const session = await this.session(token);
    const customer = session?.customer;
    if (!customer?.email) throw new UnauthorizedException();
    if (consent !== undefined) {
      await this.db.$transaction(async (tx) => {
        if (consent)
          await tx.newsletterSubscription.upsert({
            where: { email: customer.email! },
            create: {
              email: customer.email!,
              tokenHash: digest(randomBytes(32).toString('hex')),
            },
            update: { unsubscribedAt: null, subscribedAt: new Date() },
          });
        else
          await tx.newsletterSubscription.updateMany({
            where: { email: customer.email! },
            data: { unsubscribedAt: new Date() },
          });
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            marketingConsentAt: consent ? new Date() : null,
            marketingConsentSource: consent ? 'STOREFRONT_ACCOUNT' : null,
          },
        });
      });
    }
    const row = await this.db.newsletterSubscription.findUnique({
      where: { email: customer.email },
    });
    return { subscribed: !!row && !row.unsubscribedAt };
  }
}
