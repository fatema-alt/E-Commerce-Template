import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { calcShipping } from '../shop/shipping.config.js';
import { BkashAdapter } from './adapters/bkash.adapter.js';
import { SslCommerzAdapter } from './adapters/sslcommerz.adapter.js';
import {
  OnlinePaymentMethod,
  TestGatewayDto,
  UpdatePaymentSettingDto,
} from './payments.dto.js';
import type { PaymentProvider } from './payment-provider.interface.js';

const digest = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class PaymentsService implements OnModuleInit {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly adapters: Map<string, PaymentProvider> = new Map();

  constructor(
    private readonly db: PrismaService,
    private readonly bkash: BkashAdapter,
    private readonly sslcommerz: SslCommerzAdapter,
  ) {
    this.adapters.set(OnlinePaymentMethod.BKASH, this.bkash);
    this.adapters.set(OnlinePaymentMethod.SSLCOMMERZ, this.sslcommerz);
  }

  async onModuleInit() {
    await this.syncAdaptersWithDatabase();
  }

  async syncAdaptersWithDatabase() {
    try {
      const configs = await this.db.paymentGatewayConfig.findMany();
      for (const row of configs) {
        const cfg = (row.config as Record<string, any>) || {};
        if (row.provider === 'BKASH') {
          this.bkash.setConfig({
            appKey: cfg.appKey,
            appSecret: cfg.appSecret,
            username: cfg.username,
            password: cfg.password,
            baseUrl: cfg.baseUrl,
            isSandbox: row.isSandbox,
            isEnabled: row.isEnabled,
          });
        } else if (row.provider === 'SSLCOMMERZ') {
          this.sslcommerz.setConfig({
            storeId: cfg.storeId,
            storePassword: cfg.storePassword,
            isSandbox: row.isSandbox,
            isEnabled: row.isEnabled,
          });
        }
      }
    } catch {
      // If table is not created yet or db unavailable during bootstrap, graceful fallback
    }
  }

  async getMethods() {
    await this.syncAdaptersWithDatabase();

    let bankDb: any = null;
    let codDb: any = null;

    try {
      bankDb = await this.db.paymentGatewayConfig.findUnique({
        where: { provider: 'BANK_TRANSFER' },
      });
      codDb = await this.db.paymentGatewayConfig.findUnique({
        where: { provider: 'COD' },
      });
    } catch {
      // Fallback to env
    }

    const bankConfig = (bankDb?.config as Record<string, string>) || {};
    const bank =
      bankConfig.name && bankConfig.accountNumber
        ? {
            name: bankConfig.name,
            accountName: bankConfig.accountName || '',
            accountNumber: bankConfig.accountNumber,
            branch: bankConfig.branch || '',
          }
        : process.env.BANK_NAME && process.env.BANK_ACCOUNT_NUMBER
          ? {
              name: process.env.BANK_NAME,
              accountName: process.env.BANK_ACCOUNT_NAME || '',
              accountNumber: process.env.BANK_ACCOUNT_NUMBER,
              branch: process.env.BANK_BRANCH || '',
            }
          : null;

    const codEnabled = codDb ? codDb.isEnabled : true;
    const bankEnabled = bankDb
      ? bankDb.isEnabled && Boolean(bank)
      : Boolean(bank);

    const rawOptions = await this.getPaymentModelConfig();
    const hasOnlineGateway = this.bkash.isEnabled() || this.sslcommerz.isEnabled();

    // If no online gateway is configured/enabled, hide Options A, B, and C completely
    const options = {
      ...rawOptions,
      optionAEnabled: hasOnlineGateway && rawOptions.optionAEnabled,
      optionBEnabled: hasOnlineGateway && rawOptions.optionBEnabled,
      optionCEnabled: hasOnlineGateway && rawOptions.optionCEnabled,
    };

    return {
      methods: [
        { id: 'COD', label: 'Cash on Delivery', enabled: codEnabled },
        { id: 'BANK_TRANSFER', label: 'Bank Transfer', enabled: bankEnabled },
        {
          id: 'BKASH',
          label: 'bKash',
          enabled: this.bkash.isEnabled(),
          simulated: this.bkash.isSimulated(),
        },
        {
          id: 'SSLCOMMERZ',
          label: 'SSLCommerz (Cards / MFS / Net Banking)',
          enabled: this.sslcommerz.isEnabled(),
          simulated: this.sslcommerz.isSimulated(),
        },
      ],
      bank,
      options,
    };
  }

  async getPaymentModelConfig(): Promise<{
    optionAEnabled: boolean;
    optionBEnabled: boolean;
    optionCEnabled: boolean;
    optionCDiscountPercent: number;
    optionCDiscountFixed: number;
  }> {
    let row: any = null;
    try {
      row = await this.db.paymentGatewayConfig.findUnique({
        where: { provider: 'PAYMENT_OPTIONS' },
      });
    } catch {
      // Graceful fallback if table is unavailable during initialization
    }
    const cfg = (row?.config as Record<string, any>) || {};
    return {
      optionAEnabled: cfg.optionAEnabled !== undefined ? Boolean(cfg.optionAEnabled) : true,
      optionBEnabled: cfg.optionBEnabled !== undefined ? Boolean(cfg.optionBEnabled) : true,
      optionCEnabled: cfg.optionCEnabled !== undefined ? Boolean(cfg.optionCEnabled) : true,
      optionCDiscountPercent: Number(cfg.optionCDiscountPercent) || 0,
      optionCDiscountFixed: Number(cfg.optionCDiscountFixed) || 0,
    };
  }

  async getAdminSettings() {
    await this.syncAdaptersWithDatabase();
    const rows = await this.db.paymentGatewayConfig.findMany();
    const configsMap = new Map(rows.map((r) => [r.provider, r]));

    const bkashRow = configsMap.get('BKASH');
    const bkashCfg = (bkashRow?.config as Record<string, any>) || {};
    const bkashAppSecret = bkashCfg.appSecret || process.env.BKASH_APP_SECRET || '';
    const bkashPassword = bkashCfg.password || process.env.BKASH_PASSWORD || '';

    const sslRow = configsMap.get('SSLCOMMERZ');
    const sslCfg = (sslRow?.config as Record<string, any>) || {};
    const sslStorePasswd =
      sslCfg.storePassword || process.env.SSLCOMMERZ_STORE_PASSWORD || '';

    const bankRow = configsMap.get('BANK_TRANSFER');
    const bankCfg = (bankRow?.config as Record<string, any>) || {};

    const codRow = configsMap.get('COD');

    return {
      gateways: [
        {
          provider: 'COD',
          title: 'Cash on Delivery (COD)',
          isEnabled: codRow ? codRow.isEnabled : true,
          isSandbox: false,
          config: {},
          updatedAt: codRow?.updatedAt,
        },
        {
          provider: 'BKASH',
          title: 'bKash Tokenized Checkout',
          isEnabled: bkashRow ? bkashRow.isEnabled : this.bkash.isEnabled(),
          isSandbox: bkashRow ? bkashRow.isSandbox : true,
          config: {
            appKey: bkashCfg.appKey || process.env.BKASH_APP_KEY || '',
            hasAppSecret: Boolean(bkashAppSecret),
            appSecretMasked: bkashAppSecret
              ? `••••••••${bkashAppSecret.slice(-4)}`
              : '',
            username: bkashCfg.username || process.env.BKASH_USERNAME || '',
            hasPassword: Boolean(bkashPassword),
            baseUrl: bkashCfg.baseUrl || process.env.BKASH_BASE_URL || '',
          },
          updatedAt: bkashRow?.updatedAt,
        },
        {
          provider: 'SSLCOMMERZ',
          title: 'SSLCommerz EasyCheckout',
          isEnabled: sslRow ? sslRow.isEnabled : this.sslcommerz.isEnabled(),
          isSandbox: sslRow ? sslRow.isSandbox : true,
          config: {
            storeId: sslCfg.storeId || process.env.SSLCOMMERZ_STORE_ID || '',
            hasStorePassword: Boolean(sslStorePasswd),
            storePasswordMasked: sslStorePasswd
              ? `••••••••${sslStorePasswd.slice(-4)}`
              : '',
          },
          updatedAt: sslRow?.updatedAt,
        },
        {
          provider: 'BANK_TRANSFER',
          title: 'Bank Transfer (Direct BDT Deposit)',
          isEnabled: bankRow
            ? bankRow.isEnabled
            : Boolean(process.env.BANK_NAME && process.env.BANK_ACCOUNT_NUMBER),
          isSandbox: false,
          config: {
            name: bankCfg.name || process.env.BANK_NAME || '',
            accountName:
              bankCfg.accountName || process.env.BANK_ACCOUNT_NAME || '',
            accountNumber:
              bankCfg.accountNumber || process.env.BANK_ACCOUNT_NUMBER || '',
            branch: bankCfg.branch || process.env.BANK_BRANCH || '',
          },
          updatedAt: bankRow?.updatedAt,
        },
      ],
    };
  }

  async updateAdminSetting(
    provider: string,
    dto: UpdatePaymentSettingDto,
    actorId?: string,
  ) {
    const existing = await this.db.paymentGatewayConfig.findUnique({
      where: { provider },
    });
    const currentCfg = (existing?.config as Record<string, any>) || {};
    const newCfg = dto.config || {};

    const mergedConfig: Record<string, any> = { ...currentCfg };

    for (const [k, v] of Object.entries(newCfg)) {
      if (typeof v === 'string' && v.startsWith('••••')) {
        continue;
      }
      if (v !== '' && v !== undefined) {
        mergedConfig[k] = v;
      }
    }

    const updated = await this.db.paymentGatewayConfig.upsert({
      where: { provider },
      create: {
        provider,
        isEnabled: dto.isEnabled ?? false,
        isSandbox: dto.isSandbox ?? true,
        config: mergedConfig,
        updatedBy: actorId,
      },
      update: {
        ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}),
        ...(dto.isSandbox !== undefined ? { isSandbox: dto.isSandbox } : {}),
        config: mergedConfig,
        updatedBy: actorId,
      },
    });

    await this.syncAdaptersWithDatabase();
    return updated;
  }

  async testGateway(provider: string, dto: TestGatewayDto) {
    const existing = await this.db.paymentGatewayConfig.findUnique({
      where: { provider },
    });
    const savedConfig = (existing?.config as Record<string, any>) || {};
    const inputConfig = dto.config || {};

    if (provider === 'BKASH') {
      const appKey = inputConfig.appKey || savedConfig.appKey || process.env.BKASH_APP_KEY || '';
      let appSecret = inputConfig.appSecret;
      if (!appSecret || appSecret.startsWith('••••')) {
        appSecret = savedConfig.appSecret || process.env.BKASH_APP_SECRET || '';
      }
      const username = inputConfig.username || savedConfig.username || process.env.BKASH_USERNAME || '';
      let password = inputConfig.password;
      if (!password || password.startsWith('••••')) {
        password = savedConfig.password || process.env.BKASH_PASSWORD || '';
      }

      return this.bkash.testCredentials({
        appKey,
        appSecret,
        username,
        password,
        isSandbox: dto.isSandbox ?? existing?.isSandbox ?? true,
      });
    }

    if (provider === 'SSLCOMMERZ') {
      const storeId = inputConfig.storeId || savedConfig.storeId || process.env.SSLCOMMERZ_STORE_ID || '';
      let storePassword = inputConfig.storePassword;
      if (!storePassword || storePassword.startsWith('••••')) {
        storePassword = savedConfig.storePassword || process.env.SSLCOMMERZ_STORE_PASSWORD || '';
      }

      return this.sslcommerz.testCredentials({
        storeId,
        storePassword,
        isSandbox: dto.isSandbox ?? existing?.isSandbox ?? true,
      });
    }

    return { success: true, message: 'Settings saved' };
  }

  async initiate(
    orderId: string,
    method: OnlinePaymentMethod,
    origin?: string,
    requestedOption?: string,
  ) {
    const adapter = this.adapters.get(method);
    if (!adapter || !adapter.isEnabled()) {
      throw new BadRequestException(`Payment method ${method} is not available`);
    }

    const order = await this.db.order.findUnique({
      where: { id: orderId },
      include: {
        payments: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.paymentStatus === 'PAID') {
      throw new ConflictException('Order is already paid');
    }

    if (order.status === 'CANCELLED') {
      throw new ConflictException('Cannot initiate payment for a cancelled order');
    }

    const paymentOption = requestedOption || order.paymentOption || 'OPTION_B';

    if (paymentOption === 'OPTION_A' && Number(order.shippingTotal) <= 0) {
      throw new BadRequestException('Advance delivery payment is not applicable for free delivery orders');
    }

    // Server strictly re-derives payable amount; never trust client amount
    let payableAmount: number;
    if (paymentOption === 'OPTION_A') {
      payableAmount = Number(order.shippingTotal);
    } else {
      payableAmount = Number(order.grandTotal);
    }

    if (!Number.isFinite(payableAmount) || payableAmount <= 0) {
      throw new BadRequestException('Invalid payable amount for payment initiation');
    }

    const storefrontOrigin =
      origin ||
      process.env.STOREFRONT_ORIGIN ||
      'http://localhost:3000';

    const apiPublicUrl =
      process.env.API_PUBLIC_URL ||
      `http://localhost:${process.env.PORT || 4000}/api/v1`;

    const callbackUrl = `${apiPublicUrl}/payments/${method.toLowerCase()}/callback`;
    const ipnUrl = `${apiPublicUrl}/payments/sslcommerz/ipn`;

    const initiateReq = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: payableAmount,
      currency: order.currency,
      customerName: order.customerName,
      customerEmail: order.customerEmail || undefined,
      customerPhone: order.customerPhone,
      callbackUrl,
      ipnUrl,
      storefrontOrigin,
    };

    const result = await adapter.initiatePayment(initiateReq);

    // Record pending transaction with exact payable amount and paymentOption
    const idempotencyKey = `pay:${method}:${order.id}:${randomUUID().slice(0, 16)}`;
    await this.db.orderPaymentTransaction.create({
      data: {
        orderId: order.id,
        type: 'PAYMENT',
        status: 'PENDING',
        provider: method,
        providerReference: result.transactionReference || result.providerSessionId,
        idempotencyKey,
        amount: new Prisma.Decimal(payableAmount),
        currency: order.currency,
        metadata: {
          ...result.metadata,
          paymentOption,
          payableAmount,
          initiateUrl: result.redirectUrl,
          storefrontOrigin,
        },
      },
    });

    if (requestedOption && order.paymentOption !== requestedOption) {
      await this.db.order.update({
        where: { id: order.id },
        data: { paymentOption: requestedOption, paymentMethod: method },
      });
    }

    return {
      redirectUrl: result.redirectUrl,
      provider: method,
      transactionReference: result.transactionReference,
      amount: payableAmount,
      paymentOption,
    };
  }

  async throttle(
    operation: string,
    identity: string,
    max: number,
    seconds = 900,
  ) {
    try {
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
      if (row.count > max) {
        throw new HttpException('Too many requests; retry later', 429);
      }
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
    }
  }

  async switchPaymentOption(
    orderId: string,
    optionOrDto: string | { paymentOption: string; paymentMethod?: string },
    methodArg?: string,
    sessionToken?: string,
  ) {
    await this.throttle('switch-payment-option', orderId, 10, 60);

    const newOption = typeof optionOrDto === 'string' ? optionOrDto : optionOrDto.paymentOption;
    const newMethod = typeof optionOrDto === 'string' ? methodArg : optionOrDto.paymentMethod || methodArg;
    return await this.db.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { coupon: true, addresses: true },
      });

      // Verify caller ownership if sessionToken is present
      if (sessionToken) {
        const tokenHash = digest(sessionToken);
        const session = await tx.shopperSession.findFirst({
          where: { tokenHash, expiresAt: { gt: new Date() } },
        });
        if (!session) {
          throw new UnauthorizedException('Invalid or expired session');
        }
        const hasAccess = await tx.order.findFirst({
          where: {
            id: orderId,
            OR: [
              { shopperAccess: { sessionId: session.id } },
              ...(session.customerId ? [{ customerId: session.customerId }] : []),
            ],
          },
        });
        if (!hasAccess) {
          throw new UnauthorizedException('Access denied to this order');
        }
      }

      // Blocked if already paid, partially paid, or an advance has been recorded
      if (
        order.paymentStatus === 'PAID' ||
        order.paymentStatus === 'PARTIALLY_PAID' ||
        (order.paidTotal && new Prisma.Decimal(order.paidTotal).greaterThan(0))
      ) {
        throw new ConflictException(
          'Cannot switch payment option once a payment or advance has been recorded',
        );
      }
      if (order.status === 'CANCELLED') {
        throw new ConflictException('Cannot modify a cancelled order');
      }

      const modelCfg = await this.getPaymentModelConfig();

      // Retrieve original coupon discount if coupon was applied
      let couponDiscount = new Prisma.Decimal(0);
      if (order.couponCode) {
        couponDiscount = order.coupon ? new Prisma.Decimal(order.discountTotal) : new Prisma.Decimal(0);
      }

      let onlineDiscount = new Prisma.Decimal(0);
      if (newOption === 'OPTION_C') {
        if (modelCfg.optionCDiscountPercent > 0) {
          onlineDiscount = order.subtotal
            .mul(modelCfg.optionCDiscountPercent)
            .div(100)
            .toDecimalPlaces(2);
        } else if (modelCfg.optionCDiscountFixed > 0) {
          onlineDiscount = Prisma.Decimal.min(
            order.subtotal,
            new Prisma.Decimal(modelCfg.optionCDiscountFixed),
          ).toDecimalPlaces(2);
        }
      }

      // Non-stacking rule with coupon: apply whichever discount is larger
      let effectiveDiscount = couponDiscount;
      if (newOption === 'OPTION_C') {
        effectiveDiscount = Prisma.Decimal.max(couponDiscount, onlineDiscount);
      } else {
        effectiveDiscount = couponDiscount;
      }

      // Recompute post-discount subtotal and shipping
      const postDiscountSubtotal = Prisma.Decimal.max(
        new Prisma.Decimal(0),
        order.subtotal.minus(effectiveDiscount),
      );
      const shippingAddress = order.addresses?.[0];
      const recalculatedShippingFee = calcShipping(
        postDiscountSubtotal.toNumber(),
        shippingAddress?.city || undefined,
        shippingAddress?.district || undefined,
      );
      const newShippingTotal = new Prisma.Decimal(recalculatedShippingFee);

      if (newOption === 'OPTION_A' && newShippingTotal.lessThanOrEqualTo(0)) {
        throw new BadRequestException('Advance delivery payment is not applicable for free delivery orders');
      }

      const newGrandTotal = postDiscountSubtotal.plus(newShippingTotal).plus(order.taxTotal || 0);

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          paymentOption: newOption,
          ...(newMethod ? { paymentMethod: newMethod as any } : {}),
          discountTotal: effectiveDiscount,
          shippingTotal: newShippingTotal,
          grandTotal: newGrandTotal,
          version: { increment: 1 },
        },
      });

      const dueOnDelivery = newOption === 'OPTION_A'
        ? Prisma.Decimal.max(new Prisma.Decimal(0), updated.subtotal.minus(updated.discountTotal))
        : newOption === 'OPTION_B' || newOption === 'OPTION_C'
          ? new Prisma.Decimal(0)
          : updated.grandTotal;

      const payableNow = newOption === 'OPTION_A'
        ? updated.shippingTotal
        : updated.grandTotal;

      return {
        id: updated.id,
        orderNumber: updated.orderNumber,
        paymentOption: updated.paymentOption,
        paymentMethod: updated.paymentMethod,
        subtotal: updated.subtotal.toFixed(2),
        discountTotal: updated.discountTotal.toFixed(2),
        shippingTotal: updated.shippingTotal.toFixed(2),
        grandTotal: updated.grandTotal.toFixed(2),
        paidTotal: (updated.paidTotal || new Prisma.Decimal(0)).toFixed(2),
        payableNow: payableNow.toFixed(2),
        amountDueOnDelivery: dueOnDelivery.toFixed(2),
      };
    });
  }

  async processCallback(
    providerName: 'BKASH' | 'SSLCOMMERZ',
    query: Record<string, string>,
    body: Record<string, unknown>,
  ) {
    const adapter = this.adapters.get(providerName);
    if (!adapter) {
      throw new BadRequestException(`Unsupported provider: ${providerName}`);
    }

    let orderId =
      query.orderId ||
      String(body.orderId || '') ||
      String(query.tran_id || body.tran_id || '');

    if (!orderId && (query.paymentID || body.paymentID || query.val_id || body.val_id)) {
      const ref = String(query.paymentID || body.paymentID || query.val_id || body.val_id);
      const foundTxn = await this.db.orderPaymentTransaction.findFirst({
        where: { providerReference: ref },
        select: { orderId: true },
      });
      if (foundTxn) orderId = foundTxn.orderId;
    }

    const order = await this.db.order.findFirst({
      where: {
        OR: [{ id: orderId || '' }, { orderNumber: orderId || '' }],
      },
      include: {
        items: true,
        reservations: true,
        payments: true,
      },
    });

    if (!order) {
      this.logger.error(`Callback order not found for ${providerName}`, {
        orderId,
        query,
      });
      return {
        redirectUrl: `http://localhost:3000/?payment=error&message=Order+not+found`,
      };
    }

    const lastPayment = order.payments.find(
      (p) => p.provider === providerName && p.status === 'PENDING',
    );
    const storefrontOrigin =
      (lastPayment?.metadata as { storefrontOrigin?: string })
        ?.storefrontOrigin ||
      process.env.STOREFRONT_ORIGIN ||
      'http://localhost:3000';

    if (order.paymentStatus === 'PAID') {
      return {
        redirectUrl: `${storefrontOrigin}/orders/${order.id}?payment=already_paid`,
      };
    }

    const verification = await adapter.verifyPayment(body, query);

    const txnRef =
      verification.transactionReference ||
      verification.bankTrxId ||
      query.paymentID ||
      query.val_id ||
      body.val_id;

    return await this.db.$transaction(async (tx) => {
      // Row lock to serialize concurrent redirect + IPN
      try {
        await tx.$executeRaw`SELECT 1 FROM "orders" WHERE "id" = ${order.id} FOR UPDATE`;
      } catch {
        // Safe fallback in test environments without raw lock support
      }

      const currentOrder = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { reservations: true, payments: true },
      });

      // Target transaction resolution by reference or pending status
      const targetTxn = await tx.orderPaymentTransaction.findFirst({
        where: {
          orderId: order.id,
          provider: providerName,
          OR: [
            ...(txnRef ? [{ providerReference: String(txnRef) }] : []),
            { status: 'PENDING' },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });

      // Idempotency: if THIS transaction already succeeded, return early without crediting again
      if (targetTxn && targetTxn.status === 'SUCCEEDED') {
        return {
          redirectUrl: `${storefrontOrigin}/orders/${order.id}?payment=success`,
        };
      }

      if (!verification.success) {
        this.logger.error(
          `Payment verification failed for order ${order.id} via ${providerName}: ${verification.errorMessage}`,
        );
        if (targetTxn) {
          await tx.orderPaymentTransaction.update({
            where: { id: targetTxn.id },
            data: {
              status: 'FAILED',
              processedAt: new Date(),
              metadata: {
                ...(targetTxn.metadata as object),
                verification: JSON.parse(JSON.stringify(verification)),
                failureReason: verification.errorMessage || 'Verification returned failure',
              },
            },
          });
        }
        return {
          redirectUrl: `${storefrontOrigin}/orders/${order.id}?payment=error&message=${encodeURIComponent(
            verification.errorMessage || 'Payment could not be verified',
          )}`,
        };
      }

      // Amount and currency validation: must match expected amount and currency
      const verifiedAmount = new Prisma.Decimal(verification.amount);
      const expectedAmount = targetTxn ? targetTxn.amount : new Prisma.Decimal(currentOrder.grandTotal);
      const expectedCurrency = currentOrder.currency;

      if (
        !verifiedAmount.equals(expectedAmount) ||
        (verification.currency && verification.currency.toUpperCase() !== expectedCurrency.toUpperCase())
      ) {
        this.logger.error(
          `Payment amount or currency mismatch for order ${order.id}. ` +
          `Expected: ${expectedAmount.toString()} ${expectedCurrency}, ` +
          `Verified from gateway: ${verifiedAmount.toString()} ${verification.currency}`,
        );
        if (targetTxn) {
          await tx.orderPaymentTransaction.update({
            where: { id: targetTxn.id },
            data: {
              status: 'FAILED',
              processedAt: new Date(),
              metadata: {
                ...(targetTxn.metadata as object),
                verification: JSON.parse(JSON.stringify(verification)),
                failureReason: `Amount/currency mismatch: expected ${expectedAmount.toString()} ${expectedCurrency}, received ${verifiedAmount.toString()} ${String(verification.currency || '')}`,
              },
            },
          });
        }
        return {
          redirectUrl: `${storefrontOrigin}/orders/${order.id}?payment=error&message=Amount+mismatch`,
        };
      }

      const creditedAmount = verifiedAmount;
      const verificationData = JSON.parse(
        JSON.stringify(verification),
      ) as Prisma.InputJsonValue;

        if (targetTxn) {
          await tx.orderPaymentTransaction.update({
            where: { id: targetTxn.id },
            data: {
              status: 'SUCCEEDED',
              providerReference:
                verification.transactionReference ||
                verification.bankTrxId ||
                targetTxn.providerReference,
              processedAt: new Date(),
              metadata: {
                ...(targetTxn.metadata as object),
                verification: verificationData,
              },
            },
          });
        } else {
          await tx.orderPaymentTransaction.create({
            data: {
              orderId: order.id,
              type: 'PAYMENT',
              status: 'SUCCEEDED',
              provider: providerName,
              providerReference:
                verification.transactionReference || verification.bankTrxId,
              idempotencyKey: `cb:${providerName}:${order.id}:${randomUUID()}`,
              amount: creditedAmount,
              currency: currentOrder.currency,
              processedAt: new Date(),
              metadata: { verification: verificationData },
            },
          });
        }

        // Atomically increment paidTotal
        const updatedOrder = await tx.order.update({
          where: { id: order.id },
          data: {
            paidTotal: { increment: creditedAmount },
          },
          select: {
            id: true,
            grandTotal: true,
            paidTotal: true,
            status: true,
            confirmedAt: true,
          },
        });

        const isFullyPaid = updatedOrder.paidTotal.greaterThanOrEqualTo(updatedOrder.grandTotal);
        const nextPaymentStatus = isFullyPaid ? 'PAID' : 'PARTIALLY_PAID';

        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: nextPaymentStatus,
            status:
              updatedOrder.status === 'PENDING'
                ? 'CONFIRMED'
                : updatedOrder.status,
            confirmedAt: updatedOrder.confirmedAt || new Date(),
            version: { increment: 1 },
          },
        });

        // Audit event
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            action: 'PAYMENT_CONFIRMED',
            actorType: 'GATEWAY',
            actorId: providerName,
            after: {
              provider: providerName,
              trxId: verification.bankTrxId || String(txnRef || ''),
              amount: creditedAmount.toString(),
              paymentStatus: nextPaymentStatus,
              paidTotal: updatedOrder.paidTotal.toString(),
            },
          },
        });

        return {
          redirectUrl: `${storefrontOrigin}/orders/${order.id}?payment=success`,
        };
    });
  }

  async processIpn(providerName: 'SSLCOMMERZ', payload: Record<string, unknown>) {
    this.logger.log(`Received IPN from ${providerName}`, payload);
    const tranId = String(payload.tran_id || '');
    const valId = String(payload.val_id || '');

    if (!tranId && !valId) {
      return { status: 'INVALID', message: 'Missing transaction identifiers' };
    }

    const order = await this.db.order.findFirst({
      where: {
        OR: [{ orderNumber: tranId }, { id: tranId }],
      },
    });

    if (!order) {
      this.logger.warn(`IPN order not found: ${tranId}`);
      return { status: 'NOT_FOUND' };
    }

    if (order.paymentStatus === 'PAID') {
      return { status: 'ALREADY_PAID' };
    }

    const verification = await this.sslcommerz.verifyPayment(payload);
    if (!verification.success) {
      this.logger.warn(`IPN verification failed for order ${order.orderNumber}`);
      return { status: 'FAILED', reason: verification.errorMessage };
    }

    await this.db.$transaction(async (tx) => {
      // Row lock to serialize concurrent redirect + IPN
      try {
        await tx.$executeRaw`SELECT 1 FROM "orders" WHERE "id" = ${order.id} FOR UPDATE`;
      } catch {
        // Safe fallback in test environments without raw lock support
      }

      const currentOrder = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
      });

      const ipnRef = verification.bankTrxId || valId;
      const existingTxn = await tx.orderPaymentTransaction.findFirst({
        where: {
          orderId: order.id,
          provider: providerName,
          OR: [
            ...(ipnRef ? [{ providerReference: String(ipnRef) }] : []),
            { status: 'PENDING' },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });

      // Idempotency: if this transaction already succeeded, return immediately without double crediting
      if (existingTxn && existingTxn.status === 'SUCCEEDED') {
        return;
      }

      const verifiedAmount = new Prisma.Decimal(verification.amount);
      const expectedAmount = existingTxn ? existingTxn.amount : new Prisma.Decimal(currentOrder.grandTotal);
      const expectedCurrency = currentOrder.currency;

      if (
        !verifiedAmount.equals(expectedAmount) ||
        (verification.currency && verification.currency.toUpperCase() !== expectedCurrency.toUpperCase())
      ) {
        this.logger.error(
          `IPN amount or currency mismatch for order ${order.id}. ` +
          `Expected: ${expectedAmount.toString()} ${expectedCurrency}, ` +
          `Received: ${verifiedAmount.toString()} ${verification.currency}`,
        );
        if (existingTxn) {
          await tx.orderPaymentTransaction.update({
            where: { id: existingTxn.id },
            data: {
              status: 'FAILED',
              processedAt: new Date(),
              metadata: {
                ...(existingTxn.metadata as object),
                verification: JSON.parse(JSON.stringify(verification)),
                failureReason: `Amount/currency mismatch: expected ${expectedAmount.toString()} ${expectedCurrency}, received ${verifiedAmount.toString()} ${String(verification.currency || '')}`,
                source: 'IPN',
              },
            },
          });
        }
        return;
      }

      const creditedAmount = verifiedAmount;

      const ipnVerification = JSON.parse(
        JSON.stringify(verification),
      ) as Prisma.InputJsonValue;

      if (existingTxn) {
        await tx.orderPaymentTransaction.update({
          where: { id: existingTxn.id },
          data: {
            status: 'SUCCEEDED',
            providerReference: ipnRef || existingTxn.providerReference,
            processedAt: new Date(),
            metadata: {
              ...(existingTxn.metadata as object),
              verification: ipnVerification,
              source: 'IPN',
            },
          },
        });
      } else {
        await tx.orderPaymentTransaction.create({
          data: {
            orderId: order.id,
            type: 'PAYMENT',
            status: 'SUCCEEDED',
            provider: providerName,
            providerReference: ipnRef,
            idempotencyKey: `ipn:${providerName}:${valId || tranId}`,
            amount: creditedAmount,
            currency: currentOrder.currency,
            processedAt: new Date(),
            metadata: { verification: ipnVerification, source: 'IPN' },
          },
        });
      }

      // Atomically increment paidTotal
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          paidTotal: { increment: creditedAmount },
        },
        select: {
          id: true,
          grandTotal: true,
          paidTotal: true,
          status: true,
          confirmedAt: true,
        },
      });

      const isFullyPaid = updatedOrder.paidTotal.greaterThanOrEqualTo(updatedOrder.grandTotal);
      const nextPaymentStatus = isFullyPaid ? 'PAID' : 'PARTIALLY_PAID';

      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: nextPaymentStatus,
          status:
            updatedOrder.status === 'PENDING'
              ? 'CONFIRMED'
              : updatedOrder.status,
          confirmedAt: updatedOrder.confirmedAt || new Date(),
          version: { increment: 1 },
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          action: 'PAYMENT_CONFIRMED',
          actorType: 'IPN',
          actorId: providerName,
          after: {
            provider: providerName,
            trxId: verification.bankTrxId,
            amount: creditedAmount.toString(),
            paymentStatus: nextPaymentStatus,
            paidTotal: updatedOrder.paidTotal.toString(),
            source: 'IPN_WEBHOOK',
          },
        },
      });
    });

    return { status: 'SUCCESS' };
  }

  async getStatus(orderId: string) {
    const order = await this.db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        grandTotal: true,
        currency: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: {
            id: true,
            provider: true,
            status: true,
            amount: true,
            processedAt: true,
            providerReference: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }
}
