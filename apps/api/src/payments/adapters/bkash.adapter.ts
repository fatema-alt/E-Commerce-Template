import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  PaymentInitiateRequest,
  PaymentInitiateResponse,
  PaymentProvider,
  PaymentVerifyResult,
} from '../payment-provider.interface.js';

interface BkashTokenCache {
  idToken: string;
  refreshToken: string;
  expiresAt: number;
}

@Injectable()
export class BkashAdapter implements PaymentProvider {
  readonly providerName = 'BKASH';
  private readonly logger = new Logger(BkashAdapter.name);
  private tokenCache: BkashTokenCache | null = null;
  private dynamicConfig: {
    appKey?: string;
    appSecret?: string;
    username?: string;
    password?: string;
    baseUrl?: string;
    isSandbox?: boolean;
    isEnabled?: boolean;
  } | null = null;

  setConfig(
    config: {
      appKey?: string;
      appSecret?: string;
      username?: string;
      password?: string;
      baseUrl?: string;
      isSandbox?: boolean;
      isEnabled?: boolean;
    } | null,
  ) {
    this.dynamicConfig = config;
    this.tokenCache = null;
  }

  getConfig() {
    return {
      appKey: this.appKey,
      appSecret: this.appSecret,
      username: this.username,
      password: this.password,
      baseUrl: this.baseUrl,
      isSandbox: this.dynamicConfig?.isSandbox ?? true,
      isEnabled: this.isEnabled(),
    };
  }

  private get appKey(): string {
    return this.dynamicConfig?.appKey || process.env.BKASH_APP_KEY || '';
  }

  private get appSecret(): string {
    return this.dynamicConfig?.appSecret || process.env.BKASH_APP_SECRET || '';
  }

  private get username(): string {
    return this.dynamicConfig?.username || process.env.BKASH_USERNAME || '';
  }

  private get password(): string {
    return this.dynamicConfig?.password || process.env.BKASH_PASSWORD || '';
  }

  private get baseUrl(): string {
    if (this.dynamicConfig?.baseUrl) return this.dynamicConfig.baseUrl;
    if (this.dynamicConfig?.isSandbox === false) {
      return 'https://tokenized.pay.bka.sh/v1.2.0-beta';
    }
    return (
      process.env.BKASH_BASE_URL ||
      'https://tokenized.sandbox.bka.sh/v1.2.0-beta'
    );
  }

  isConfigured(): boolean {
    return Boolean(
      this.appKey && this.appSecret && this.username && this.password,
    );
  }

  isEnabled(): boolean {
    if (this.dynamicConfig?.isEnabled !== undefined) {
      if (!this.dynamicConfig.isEnabled) return false;
    }
    if (this.isConfigured()) {
      return true;
    }
    // Fail closed: with missing credentials, only allow if explicitly enabled in non-prod
    return this.isSimulated();
  }

  isSimulated(): boolean {
    // Simulation is NEVER active in production under any circumstances
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    const explicitFlag =
      process.env.ALLOW_SIMULATED_PAYMENTS === 'true' ||
      process.env.BKASH_SIMULATE === 'true';
    return explicitFlag && !this.isConfigured();
  }

  private async getAuthToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) {
      return this.tokenCache.idToken;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/tokenized/checkout/token/grant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            username: this.username,
            password: this.password,
          },
          body: JSON.stringify({
            app_key: this.appKey,
            app_secret: this.appSecret,
          }),
        },
      );

      const data = (await response.json()) as {
        id_token?: string;
        refresh_token?: string;
        expires_in?: number;
        statusMessage?: string;
      };

      if (!response.ok || !data.id_token) {
        throw new Error(
          data.statusMessage || `Failed to obtain bKash token (${response.status})`,
        );
      }

      const expiresIn = (data.expires_in ?? 3600) - 120;
      this.tokenCache = {
        idToken: data.id_token,
        refreshToken: data.refresh_token || '',
        expiresAt: Date.now() + Math.max(60, expiresIn) * 1000,
      };

      return data.id_token;
    } catch (err) {
      this.logger.error('bKash token grant error', err);
      throw err;
    }
  }

  async testCredentials(creds: {
    appKey: string;
    appSecret: string;
    username: string;
    password: string;
    isSandbox?: boolean;
  }): Promise<{ success: boolean; message: string }> {
    const baseUrl =
      creds.isSandbox === false
        ? 'https://tokenized.pay.bka.sh/v1.2.0-beta'
        : 'https://tokenized.sandbox.bka.sh/v1.2.0-beta';

    if (
      !creds.appKey ||
      !creds.appSecret ||
      !creds.username ||
      !creds.password
    ) {
      return {
        success: false,
        message:
          'All fields (App Key, App Secret, Username, Password) are required',
      };
    }

    try {
      const response = await fetch(`${baseUrl}/tokenized/checkout/token/grant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          username: creds.username,
          password: creds.password,
        },
        body: JSON.stringify({
          app_key: creds.appKey,
          app_secret: creds.appSecret,
        }),
      });

      const data = (await response.json()) as {
        id_token?: string;
        statusMessage?: string;
      };

      if (!response.ok || !data.id_token) {
        return {
          success: false,
          message:
            data.statusMessage ||
            `Token grant failed with HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        message: 'Successfully authenticated with bKash API',
      };
    } catch (err) {
      return {
        success: false,
        message: (err as Error).message,
      };
    }
  }

  async initiatePayment(
    req: PaymentInitiateRequest,
  ): Promise<PaymentInitiateResponse> {
    if (this.isSimulated()) {
      const simulatedPaymentId = `sim_bkash_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
      const callbackWithQuery = new URL(req.callbackUrl);
      callbackWithQuery.searchParams.set('paymentID', simulatedPaymentId);
      callbackWithQuery.searchParams.set('status', 'success');
      callbackWithQuery.searchParams.set('orderId', req.orderId);

      return {
        provider: this.providerName,
        redirectUrl: callbackWithQuery.toString(),
        transactionReference: simulatedPaymentId,
        providerSessionId: simulatedPaymentId,
        metadata: {
          simulated: true,
          amount: req.amount,
          currency: req.currency,
          orderNumber: req.orderNumber,
        },
      };
    }

    const token = await this.getAuthToken();
    const callbackWithOrderId = new URL(req.callbackUrl);
    callbackWithOrderId.searchParams.set('orderId', req.orderId);

    const response = await fetch(`${this.baseUrl}/tokenized/checkout/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: token,
        'x-app-key': this.appKey,
      },
      body: JSON.stringify({
        mode: '0011',
        payerReference: req.customerPhone,
        callbackURL: callbackWithOrderId.toString(),
        amount: req.amount.toFixed(2),
        currency: 'BDT',
        intent: 'sale',
        merchantInvoiceNumber: req.orderNumber,
      }),
    });

    const data = (await response.json()) as {
      paymentID?: string;
      bkashURL?: string;
      statusMessage?: string;
      statusCode?: string;
    };

    if (!response.ok || !data.bkashURL || !data.paymentID) {
      throw new Error(
        data.statusMessage || `bKash payment create failed (${response.status})`,
      );
    }

    return {
      provider: this.providerName,
      redirectUrl: data.bkashURL,
      transactionReference: data.paymentID,
      providerSessionId: data.paymentID,
      metadata: {
        paymentID: data.paymentID,
        statusCode: data.statusCode,
      },
    };
  }

  async verifyPayment(
    payload: Record<string, unknown>,
    queryParams?: Record<string, string>,
  ): Promise<PaymentVerifyResult> {
    const paymentId = String(
      queryParams?.paymentID || payload?.paymentID || '',
    );
    const status = String(queryParams?.status || payload?.status || '').toLowerCase();

    if (!paymentId) {
      return {
        success: false,
        provider: this.providerName,
        transactionReference: '',
        amount: 0,
        currency: 'BDT',
        rawStatus: status || 'MISSING_PAYMENT_ID',
        errorMessage: 'Missing bKash paymentID',
      };
    }

    if (this.isSimulated() || (process.env.NODE_ENV !== 'production' && paymentId.startsWith('sim_bkash_'))) {
      const isSuccess = status === 'success' || !status;
      return {
        success: isSuccess,
        provider: this.providerName,
        transactionReference: paymentId,
        amount: Number(payload?.amount ?? queryParams?.amount ?? (payload?.metadata as any)?.amount ?? 0),
        currency: 'BDT',
        rawStatus: isSuccess ? 'Completed' : status.toUpperCase(),
        bankTrxId: `SIM_BKASH_${randomUUID().slice(0, 10).toUpperCase()}`,
        paymentMethodUsed: 'bKash (Simulated)',
        metadata: { simulated: true, paymentId, status },
        errorMessage: isSuccess ? undefined : `Payment returned status: ${status}`,
      };
    }

    if (status !== 'success') {
      return {
        success: false,
        provider: this.providerName,
        transactionReference: paymentId,
        amount: 0,
        currency: 'BDT',
        rawStatus: status.toUpperCase(),
        errorMessage: `bKash customer cancelled or payment failed (${status})`,
      };
    }

    try {
      const token = await this.getAuthToken();
      const response = await fetch(`${this.baseUrl}/tokenized/checkout/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: token,
          'x-app-key': this.appKey,
        },
        body: JSON.stringify({ paymentID: paymentId }),
      });

      const data = (await response.json()) as {
        statusCode?: string;
        statusMessage?: string;
        paymentID?: string;
        trxID?: string;
        amount?: string;
        currency?: string;
        transactionStatus?: string;
      };

      const isCompleted =
        data.statusCode === '0000' &&
        (data.transactionStatus === 'Completed' ||
          data.transactionStatus === 'Authorized');

      return {
        success: isCompleted,
        provider: this.providerName,
        transactionReference: data.paymentID || paymentId,
        amount: Number(data.amount ?? 0),
        currency: data.currency || 'BDT',
        rawStatus: data.transactionStatus || data.statusCode || 'UNKNOWN',
        bankTrxId: data.trxID,
        paymentMethodUsed: 'bKash',
        metadata: data as Record<string, unknown>,
        errorMessage: isCompleted ? undefined : data.statusMessage,
      };
    } catch (err) {
      this.logger.error('bKash execute failed', err);
      return {
        success: false,
        provider: this.providerName,
        transactionReference: paymentId,
        amount: 0,
        currency: 'BDT',
        rawStatus: 'EXECUTE_ERROR',
        errorMessage: (err as Error).message,
      };
    }
  }

  async queryPayment(providerReference: string): Promise<PaymentVerifyResult> {
    if (this.isSimulated() || providerReference.startsWith('sim_bkash_')) {
      return {
        success: true,
        provider: this.providerName,
        transactionReference: providerReference,
        amount: 0,
        currency: 'BDT',
        rawStatus: 'Completed',
        bankTrxId: `SIM_QUERY_${providerReference}`,
      };
    }

    const token = await this.getAuthToken();
    const response = await fetch(
      `${this.baseUrl}/tokenized/checkout/payment/status`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: token,
          'x-app-key': this.appKey,
        },
        body: JSON.stringify({ paymentID: providerReference }),
      },
    );

    const data = (await response.json()) as {
      statusCode?: string;
      statusMessage?: string;
      paymentID?: string;
      trxID?: string;
      amount?: string;
      currency?: string;
      transactionStatus?: string;
    };

    const isCompleted =
      data.statusCode === '0000' && data.transactionStatus === 'Completed';

    return {
      success: isCompleted,
      provider: this.providerName,
      transactionReference: data.paymentID || providerReference,
      amount: Number(data.amount ?? 0),
      currency: data.currency || 'BDT',
      rawStatus: data.transactionStatus || data.statusCode || 'UNKNOWN',
      bankTrxId: data.trxID,
      paymentMethodUsed: 'bKash',
      metadata: data as Record<string, unknown>,
      errorMessage: isCompleted ? undefined : data.statusMessage,
    };
  }
}
