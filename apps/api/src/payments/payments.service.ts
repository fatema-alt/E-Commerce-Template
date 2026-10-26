import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BkashAdapter } from './adapters/bkash.adapter.js';
import { SslCommerzAdapter } from './adapters/sslcommerz.adapter.js';
import {
  OnlinePaymentMethod,
  TestGatewayDto,
  UpdatePaymentSettingDto,
} from './payments.dto.js';
import type { PaymentProvider } from './payment-provider.interface.js';

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
      amount: Number(order.grandTotal),
      currency: order.currency,
      customerName: order.customerName,
      customerEmail: order.customerEmail || undefined,
      customerPhone: order.customerPhone,
      callbackUrl,
      ipnUrl,
      storefrontOrigin,
    };

    const result = await adapter.initiatePayment(initiateReq);

    // Record pending transaction
    const idempotencyKey = `pay:${method}:${order.id}:${randomUUID().slice(0, 16)}`;
    await this.db.orderPaymentTransaction.create({
      data: {
        orderId: order.id,
        type: 'PAYMENT',
        status: 'PENDING',
        provider: method,
        providerReference: result.transactionReference || result.providerSessionId,
        idempotencyKey,
        amount: order.grandTotal,
        currency: order.currency,
        metadata: {
          ...result.metadata,
          initiateUrl: result.redirectUrl,
          storefrontOrigin,
        },
      },
    });

    return {
      redirectUrl: result.redirectUrl,
      provider: method,
      transactionReference: result.transactionReference,
    };
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

    const orderId =
      query.orderId ||
      String(body.orderId || '') ||
      String(query.tran_id || body.tran_id || '');

    const order = await this.db.order.findFirst({
      where: {
        OR: [{ id: orderId }, { orderNumber: orderId }],
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

    return await this.db.$transaction(async (tx) => {
      // Re-fetch with lock
      const currentOrder = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { reservations: true, payments: true },
      });

      if (currentOrder.paymentStatus === 'PAID') {
        return {
          redirectUrl: `${storefrontOrigin}/orders/${order.id}?payment=success`,
        };
      }

      if (verification.success) {
        // Mark payment transaction as succeeded
        const verificationData = JSON.parse(
          JSON.stringify(verification),
        ) as Prisma.InputJsonValue;

        if (lastPayment) {
          await tx.orderPaymentTransaction.update({
            where: { id: lastPayment.id },
            data: {
              status: 'SUCCEEDED',
              providerReference:
                verification.transactionReference ||
                verification.bankTrxId ||
                lastPayment.providerReference,
              processedAt: new Date(),
              metadata: {
                ...(lastPayment.metadata as object),
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
              amount: currentOrder.grandTotal,
              currency: currentOrder.currency,
              processedAt: new Date(),
              metadata: { verification: verificationData },
            },
          });
        }

        // Update order status
        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'PAID',
            status:
              currentOrder.status === 'PENDING'
                ? 'CONFIRMED'
                : currentOrder.status,
            confirmedAt: currentOrder.confirmedAt || new Date(),
            paidTotal: currentOrder.grandTotal,
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
              trxId: verification.bankTrxId,
              amount: currentOrder.grandTotal.toString(),
            },
          },
        });

        return {
          redirectUrl: `${storefrontOrigin}/orders/${order.id}?payment=success`,
        };
      } else {
        // Payment failed or was cancelled
        if (lastPayment) {
          await tx.orderPaymentTransaction.update({
            where: { id: lastPayment.id },
            data: {
              status: 'FAILED',
              metadata: {
                ...(lastPayment.metadata as object),
                failureReason: verification.errorMessage || verification.rawStatus,
              },
            },
          });
        }

        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            action: 'PAYMENT_FAILED',
            actorType: 'GATEWAY',
            actorId: providerName,
            after: {
              provider: providerName,
              error: verification.errorMessage || verification.rawStatus,
            },
          },
        });

        return {
          redirectUrl: `${storefrontOrigin}/orders/${order.id}?payment=failed&reason=${encodeURIComponent(verification.errorMessage || 'Payment was not completed')}`,
        };
      }
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
      const currentOrder = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
      });

      if (currentOrder.paymentStatus === 'PAID') return;

      const ipnVerification = JSON.parse(
        JSON.stringify(verification),
      ) as Prisma.InputJsonValue;

      await tx.orderPaymentTransaction.create({
        data: {
          orderId: order.id,
          type: 'PAYMENT',
          status: 'SUCCEEDED',
          provider: providerName,
          providerReference: verification.bankTrxId || valId,
          idempotencyKey: `ipn:${providerName}:${valId || tranId}`,
          amount: currentOrder.grandTotal,
          currency: currentOrder.currency,
          processedAt: new Date(),
          metadata: { verification: ipnVerification, source: 'IPN' },
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'PAID',
          status:
            currentOrder.status === 'PENDING'
              ? 'CONFIRMED'
              : currentOrder.status,
          confirmedAt: currentOrder.confirmedAt || new Date(),
          paidTotal: currentOrder.grandTotal,
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
