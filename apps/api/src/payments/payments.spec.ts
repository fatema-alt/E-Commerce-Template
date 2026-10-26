import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BkashAdapter } from './adapters/bkash.adapter.js';
import { SslCommerzAdapter } from './adapters/sslcommerz.adapter.js';
import { PaymentsService } from './payments.service.js';
import { OnlinePaymentMethod } from './payments.dto.js';

describe('Payments Module Unit Tests', () => {
  describe('BkashAdapter', () => {
    it('initiates simulated payment when credentials not provided', async () => {
      const adapter = new BkashAdapter();
      expect(adapter.isEnabled()).toBe(true);
      expect(adapter.isSimulated()).toBe(true);

      const res = await adapter.initiatePayment({
        orderId: '00000000-0000-0000-0000-000000000001',
        orderNumber: 'ORD-12345',
        amount: 1500,
        currency: 'BDT',
        customerName: 'Rahim Khan',
        customerPhone: '01711000000',
        callbackUrl: 'http://localhost:4000/api/v1/payments/bkash/callback',
        ipnUrl: 'http://localhost:4000/api/v1/payments/sslcommerz/ipn',
        storefrontOrigin: 'http://localhost:3000',
      });

      expect(res.provider).toBe('BKASH');
      expect(res.redirectUrl).toContain('status=success');
      expect(res.redirectUrl).toContain('paymentID=sim_bkash_');
      expect(res.transactionReference).toContain('sim_bkash_');
    });

    it('verifies simulated payment successfully', async () => {
      const adapter = new BkashAdapter();
      const result = await adapter.verifyPayment(
        {},
        { paymentID: 'sim_bkash_123', status: 'success' },
      );

      expect(result.success).toBe(true);
      expect(result.provider).toBe('BKASH');
      expect(result.rawStatus).toBe('Completed');
      expect(result.bankTrxId).toBeDefined();
    });

    it('handles simulated payment failure', async () => {
      const adapter = new BkashAdapter();
      const result = await adapter.verifyPayment(
        {},
        { paymentID: 'sim_bkash_123', status: 'failure' },
      );

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('failure');
    });
  });

  describe('SslCommerzAdapter', () => {
    it('initiates simulated payment session', async () => {
      const adapter = new SslCommerzAdapter();
      expect(adapter.isEnabled()).toBe(true);
      expect(adapter.isSimulated()).toBe(true);

      const res = await adapter.initiatePayment({
        orderId: '00000000-0000-0000-0000-000000000002',
        orderNumber: 'ORD-SSL-999',
        amount: 2500,
        currency: 'BDT',
        customerName: 'Karim Ullah',
        customerPhone: '01811000000',
        callbackUrl: 'http://localhost:4000/api/v1/payments/sslcommerz/callback',
        ipnUrl: 'http://localhost:4000/api/v1/payments/sslcommerz/ipn',
        storefrontOrigin: 'http://localhost:3000',
      });

      expect(res.provider).toBe('SSLCOMMERZ');
      expect(res.redirectUrl).toContain('status=VALID');
      expect(res.transactionReference).toBe('ORD-SSL-999');
    });

    it('verifies simulated SSLCommerz callback', async () => {
      const adapter = new SslCommerzAdapter();
      const result = await adapter.verifyPayment(
        {},
        { val_id: 'sim_ssl_456', tran_id: 'ORD-SSL-999', status: 'VALID' },
      );

      expect(result.success).toBe(true);
      expect(result.provider).toBe('SSLCOMMERZ');
      expect(result.rawStatus).toBe('VALID');
      expect(result.bankTrxId).toBeDefined();
    });
  });

  describe('PaymentsService', () => {
    let mockDb: any;
    let bkashAdapter: BkashAdapter;
    let sslAdapter: SslCommerzAdapter;
    let service: PaymentsService;

    beforeEach(() => {
      mockDb = {
        order: {
          findUnique: vi.fn(),
          findFirst: vi.fn(),
          findUniqueOrThrow: vi.fn(),
          update: vi.fn(),
        },
        orderPaymentTransaction: {
          create: vi.fn(),
          update: vi.fn(),
        },
        orderEvent: {
          create: vi.fn(),
        },
        paymentGatewayConfig: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: vi.fn().mockImplementation((args) => Promise.resolve(args.create)),
        },
        $transaction: vi.fn(async (cb) => cb(mockDb)),
      };

      bkashAdapter = new BkashAdapter();
      sslAdapter = new SslCommerzAdapter();
      service = new PaymentsService(mockDb, bkashAdapter, sslAdapter);
    });

    it('returns enabled methods list including bKash and SSLCommerz', async () => {
      const methods = await service.getMethods();
      expect(methods.methods.some((m) => m.id === 'BKASH' && m.enabled)).toBe(
        true,
      );
      expect(
        methods.methods.some((m) => m.id === 'SSLCOMMERZ' && m.enabled),
      ).toBe(true);
      expect(methods.methods.some((m) => m.id === 'COD' && m.enabled)).toBe(
        true,
      );
    });

    it('returns and updates admin payment settings', async () => {
      const settings = await service.getAdminSettings();
      expect(settings.gateways.length).toBe(4);
      expect(settings.gateways.find((g) => g.provider === 'BKASH')).toBeDefined();

      await service.updateAdminSetting('BKASH', {
        isEnabled: true,
        isSandbox: true,
        config: { appKey: 'test_app_key' },
      });
      expect(mockDb.paymentGatewayConfig.upsert).toHaveBeenCalled();
    });

    it('initiates payment for an unpaid order', async () => {
      mockDb.order.findUnique.mockResolvedValue({
        id: '11111111-1111-1111-1111-111111111111',
        orderNumber: 'ORD-111',
        grandTotal: '1200.00',
        currency: 'BDT',
        customerName: 'Test Customer',
        customerPhone: '01700000000',
        paymentStatus: 'UNPAID',
        payments: [],
      });

      const res = await service.initiate(
        '11111111-1111-1111-1111-111111111111',
        OnlinePaymentMethod.BKASH,
      );

      expect(res.provider).toBe('BKASH');
      expect(res.redirectUrl).toBeDefined();
      expect(mockDb.orderPaymentTransaction.create).toHaveBeenCalled();
    });
  });
});
