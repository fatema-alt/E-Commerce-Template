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
import type {
  QuoteDto,
  RegisterShopperDto,
  ShopCheckoutDto,
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
  payments() {
    return this.paymentsService.getMethods();
  }
  constructor(
    private readonly db: PrismaService,
    private readonly orders: OrdersService,
    private readonly paymentsService: PaymentsService,
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
    const payload = Buffer.from(
      JSON.stringify({
        sessionId,
        items: dto.items,
        subtotal: subtotal.toFixed(2),
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
      shipping: '0.00',
      tax: '0.00',
      total: subtotal.toFixed(2),
      currency: 'BDT',
      quoteToken,
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
    if (dto.paymentMethod === 'BANK_TRANSFER' && !this.payments().bank)
      throw new BadRequestException('Bank transfer is not available');
    const { quoteToken: _quote, ...data } = dto;
    const order = await this.orders.create(
      {
        ...data,
        customerId: session.customerId || undefined,
        paymentMethod: dto.paymentMethod || 'COD',
      },
      key ? `shop:${session.id}:${key}` : undefined,
      session.id,
      { sessionId: session.id, expectedSubtotal: quote.subtotal },
    );
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
  async order(id: string, token?: string) {
    const order = await this.db.order.findFirst({
      where: { id, ...(await this.scope(token)) },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        createdAt: true,
        grandTotal: true,
        shippingTotal: true,
        taxTotal: true,
        subtotal: true,
        customerName: true,
        items: {
          select: {
            nameSnapshot: true,
            skuSnapshot: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
          },
        },
        addresses: {
          select: {
            recipientName: true,
            line1: true,
            line2: true,
            city: true,
            district: true,
            postalCode: true,
          },
        },
        shipments: {
          select: { provider: true, trackingNumber: true, status: true },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
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
