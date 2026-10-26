import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  PaymentInitiateRequest,
  PaymentInitiateResponse,
  PaymentProvider,
  PaymentVerifyResult,
} from '../payment-provider.interface.js';

@Injectable()
export class SslCommerzAdapter implements PaymentProvider {
  readonly providerName = 'SSLCOMMERZ';
  private readonly logger = new Logger(SslCommerzAdapter.name);

  private get storeId(): string {
    return process.env.SSLCOMMERZ_STORE_ID || '';
  }

  private get storePassword(): string {
    return process.env.SSLCOMMERZ_STORE_PASSWORD || '';
  }

  private get isLive(): boolean {
    return process.env.SSLCOMMERZ_IS_SANDBOX === 'false';
  }

  private get baseUrl(): string {
    return this.isLive
      ? 'https://securepay.sslcommerz.com'
      : 'https://sandbox.sslcommerz.com';
  }

  isEnabled(): boolean {
    const configured = Boolean(this.storeId && this.storePassword);
    const simulationAllowed =
      process.env.SSLCOMMERZ_SIMULATE === 'true' ||
      process.env.NODE_ENV !== 'production';
    return configured || simulationAllowed;
  }

  isSimulated(): boolean {
    const configured = Boolean(this.storeId && this.storePassword);
    return !configured || process.env.SSLCOMMERZ_SIMULATE === 'true';
  }

  async initiatePayment(
    req: PaymentInitiateRequest,
  ): Promise<PaymentInitiateResponse> {
    if (this.isSimulated()) {
      const simulatedValId = `sim_ssl_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
      const callbackWithQuery = new URL(req.callbackUrl);
      callbackWithQuery.searchParams.set('val_id', simulatedValId);
      callbackWithQuery.searchParams.set('tran_id', req.orderNumber);
      callbackWithQuery.searchParams.set('status', 'VALID');
      callbackWithQuery.searchParams.set('orderId', req.orderId);

      return {
        provider: this.providerName,
        redirectUrl: callbackWithQuery.toString(),
        transactionReference: req.orderNumber,
        providerSessionId: simulatedValId,
        metadata: {
          simulated: true,
          val_id: simulatedValId,
          amount: req.amount,
          currency: req.currency,
        },
      };
    }

    const callbackWithOrderId = new URL(req.callbackUrl);
    callbackWithOrderId.searchParams.set('orderId', req.orderId);

    const formData = new URLSearchParams();
    formData.append('store_id', this.storeId);
    formData.append('store_passwd', this.storePassword);
    formData.append('total_amount', req.amount.toFixed(2));
    formData.append('currency', 'BDT');
    formData.append('tran_id', req.orderNumber);
    formData.append('success_url', callbackWithOrderId.toString());
    formData.append('fail_url', callbackWithOrderId.toString());
    formData.append('cancel_url', callbackWithOrderId.toString());
    formData.append('ipn_url', req.ipnUrl);

    formData.append('cus_name', req.customerName || 'Customer');
    formData.append('cus_email', req.customerEmail || 'customer@example.com');
    formData.append('cus_add1', 'Dhaka');
    formData.append('cus_city', 'Dhaka');
    formData.append('cus_country', 'Bangladesh');
    formData.append('cus_phone', req.customerPhone);

    formData.append('shipping_method', 'NO');
    formData.append('product_name', 'DS Mart Order');
    formData.append('product_category', 'General');
    formData.append('product_profile', 'general');

    const response = await fetch(`${this.baseUrl}/gwprocess/v4/api.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = (await response.json()) as {
      status?: string;
      failedreason?: string;
      sessionkey?: string;
      GatewayPageURL?: string;
    };

    if (!response.ok || data.status !== 'SUCCESS' || !data.GatewayPageURL) {
      throw new Error(
        data.failedreason ||
          `SSLCommerz session initialization failed (${response.status})`,
      );
    }

    return {
      provider: this.providerName,
      redirectUrl: data.GatewayPageURL,
      transactionReference: req.orderNumber,
      providerSessionId: data.sessionkey,
      metadata: {
        sessionkey: data.sessionkey,
      },
    };
  }

  async verifyPayment(
    payload: Record<string, unknown>,
    queryParams?: Record<string, string>,
  ): Promise<PaymentVerifyResult> {
    const valId = String(
      queryParams?.val_id || payload?.val_id || '',
    );
    const tranId = String(
      queryParams?.tran_id || payload?.tran_id || '',
    );
    const status = String(
      queryParams?.status || payload?.status || '',
    ).toUpperCase();

    if (!valId && !tranId) {
      return {
        success: false,
        provider: this.providerName,
        transactionReference: tranId,
        amount: 0,
        currency: 'BDT',
        rawStatus: status || 'MISSING_DATA',
        errorMessage: 'Missing val_id and tran_id from SSLCommerz',
      };
    }

    if (this.isSimulated() || valId.startsWith('sim_ssl_')) {
      const isSuccess = status === 'VALID' || status === 'SUCCESS' || !status;
      return {
        success: isSuccess,
        provider: this.providerName,
        transactionReference: tranId || valId,
        amount: Number(payload?.amount ?? 0),
        currency: 'BDT',
        rawStatus: isSuccess ? 'VALID' : status,
        bankTrxId: `SIM_SSL_${randomUUID().slice(0, 10).toUpperCase()}`,
        paymentMethodUsed: 'SSLCommerz (Simulated)',
        metadata: { simulated: true, valId, tranId, status },
        errorMessage: isSuccess ? undefined : `SSLCommerz status: ${status}`,
      };
    }

    if (status === 'FAILED' || status === 'CANCELLED') {
      return {
        success: false,
        provider: this.providerName,
        transactionReference: tranId,
        amount: 0,
        currency: 'BDT',
        rawStatus: status,
        errorMessage: `Payment was ${status.toLowerCase()}`,
      };
    }

    try {
      const validationUrl = new URL(
        `${this.baseUrl}/validator/api/validationserverAPI.php`,
      );
      validationUrl.searchParams.set('val_id', valId);
      validationUrl.searchParams.set('store_id', this.storeId);
      validationUrl.searchParams.set('store_passwd', this.storePassword);
      validationUrl.searchParams.set('v', '1');
      validationUrl.searchParams.set('format', 'json');

      const response = await fetch(validationUrl.toString(), {
        method: 'GET',
      });

      const data = (await response.json()) as {
        status?: string;
        tran_id?: string;
        val_id?: string;
        amount?: string;
        currency?: string;
        bank_tran_id?: string;
        card_type?: string;
        card_brand?: string;
        error?: string;
      };

      const isValid =
        data.status === 'VALID' || data.status === 'VALIDATED';

      return {
        success: isValid,
        provider: this.providerName,
        transactionReference: data.tran_id || tranId,
        amount: Number(data.amount ?? 0),
        currency: data.currency || 'BDT',
        rawStatus: data.status || 'UNKNOWN',
        bankTrxId: data.bank_tran_id,
        paymentMethodUsed: data.card_type || data.card_brand || 'SSLCommerz',
        metadata: data as Record<string, unknown>,
        errorMessage: isValid ? undefined : data.error || 'Payment validation failed',
      };
    } catch (err) {
      this.logger.error('SSLCommerz validation error', err);
      return {
        success: false,
        provider: this.providerName,
        transactionReference: tranId,
        amount: 0,
        currency: 'BDT',
        rawStatus: 'VALIDATION_EXCEPTION',
        errorMessage: (err as Error).message,
      };
    }
  }

  async queryPayment(providerReference: string): Promise<PaymentVerifyResult> {
    return this.verifyPayment({ val_id: providerReference, tran_id: providerReference });
  }
}
