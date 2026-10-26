export interface PaymentInitiateRequest {
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  callbackUrl: string;
  ipnUrl: string;
  storefrontOrigin: string;
}

export interface PaymentInitiateResponse {
  provider: string;
  redirectUrl: string;
  transactionReference: string;
  providerSessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentVerifyResult {
  success: boolean;
  provider: string;
  transactionReference: string;
  amount: number;
  currency: string;
  rawStatus: string;
  bankTrxId?: string;
  paymentMethodUsed?: string;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
}

export interface PaymentProvider {
  readonly providerName: string;
  isEnabled(): boolean;
  isSimulated(): boolean;
  initiatePayment(req: PaymentInitiateRequest): Promise<PaymentInitiateResponse>;
  verifyPayment(
    payload: Record<string, unknown>,
    queryParams?: Record<string, string>,
  ): Promise<PaymentVerifyResult>;
  queryPayment(providerReference: string): Promise<PaymentVerifyResult>;
}
