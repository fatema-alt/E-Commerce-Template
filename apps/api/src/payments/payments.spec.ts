import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { BkashAdapter } from './adapters/bkash.adapter.js';
import { SslCommerzAdapter } from './adapters/sslcommerz.adapter.js';
import { PaymentsService } from './payments.service.js';
import { OnlinePaymentMethod } from './payments.dto.js';

describe('Payments Module Unit Tests', () => {
  describe('BkashAdapter', () => {
    it('fails closed when credentials are missing and simulation is not explicitly enabled', () => {
      const origEnv = process.env.NODE_ENV;
      const origFlag = process.env.ALLOW_SIMULATED_PAYMENTS;
      const origBkashSim = process.env.BKASH_SIMULATE;

      delete process.env.ALLOW_SIMULATED_PAYMENTS;
      delete process.env.BKASH_SIMULATE;

      const adapter = new BkashAdapter();
      expect(adapter.isConfigured()).toBe(false);
      expect(adapter.isSimulated()).toBe(false);
      expect(adapter.isEnabled()).toBe(false);

      process.env.NODE_ENV = origEnv;
      if (origFlag) process.env.ALLOW_SIMULATED_PAYMENTS = origFlag;
      if (origBkashSim) process.env.BKASH_SIMULATE = origBkashSim;
    });

    it('NEVER allows simulation in production, even if simulation flag is set', () => {
      const origEnv = process.env.NODE_ENV;
      const origFlag = process.env.ALLOW_SIMULATED_PAYMENTS;

      process.env.NODE_ENV = 'production';
      process.env.ALLOW_SIMULATED_PAYMENTS = 'true';

      const adapter = new BkashAdapter();
      expect(adapter.isSimulated()).toBe(false);
      expect(adapter.isEnabled()).toBe(false);

      process.env.NODE_ENV = origEnv;
      if (origFlag) process.env.ALLOW_SIMULATED_PAYMENTS = origFlag;
      else delete process.env.ALLOW_SIMULATED_PAYMENTS;
    });

    it('initiates simulated payment only when explicitly enabled outside production', async () => {
      const origFlag = process.env.ALLOW_SIMULATED_PAYMENTS;
      process.env.ALLOW_SIMULATED_PAYMENTS = 'true';

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

      if (origFlag) process.env.ALLOW_SIMULATED_PAYMENTS = origFlag;
      else delete process.env.ALLOW_SIMULATED_PAYMENTS;
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
    it('fails closed when credentials are missing and simulation is not explicitly enabled', () => {
      const origEnv = process.env.NODE_ENV;
      const origFlag = process.env.ALLOW_SIMULATED_PAYMENTS;
      const origSslSim = process.env.SSLCOMMERZ_SIMULATE;

      delete process.env.ALLOW_SIMULATED_PAYMENTS;
      delete process.env.SSLCOMMERZ_SIMULATE;

      const adapter = new SslCommerzAdapter();
      expect(adapter.isConfigured()).toBe(false);
      expect(adapter.isSimulated()).toBe(false);
      expect(adapter.isEnabled()).toBe(false);

      process.env.NODE_ENV = origEnv;
      if (origFlag) process.env.ALLOW_SIMULATED_PAYMENTS = origFlag;
      if (origSslSim) process.env.SSLCOMMERZ_SIMULATE = origSslSim;
    });

    it('NEVER allows simulation in production, even if simulation flag is set', () => {
      const origEnv = process.env.NODE_ENV;
      const origFlag = process.env.ALLOW_SIMULATED_PAYMENTS;

      process.env.NODE_ENV = 'production';
      process.env.ALLOW_SIMULATED_PAYMENTS = 'true';

      const adapter = new SslCommerzAdapter();
      expect(adapter.isSimulated()).toBe(false);
      expect(adapter.isEnabled()).toBe(false);

      process.env.NODE_ENV = origEnv;
      if (origFlag) process.env.ALLOW_SIMULATED_PAYMENTS = origFlag;
      else delete process.env.ALLOW_SIMULATED_PAYMENTS;
    });

    it('initiates simulated payment session only when explicitly enabled outside production', async () => {
      const origFlag = process.env.ALLOW_SIMULATED_PAYMENTS;
      process.env.ALLOW_SIMULATED_PAYMENTS = 'true';

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
        callbackUrl:
          'http://localhost:4000/api/v1/payments/sslcommerz/callback',
        ipnUrl: 'http://localhost:4000/api/v1/payments/sslcommerz/ipn',
        storefrontOrigin: 'http://localhost:3000',
      });

      expect(res.provider).toBe('SSLCOMMERZ');
      expect(res.redirectUrl).toContain('status=VALID');
      expect(res.transactionReference).toBe('ORD-SSL-999');

      if (origFlag) process.env.ALLOW_SIMULATED_PAYMENTS = origFlag;
      else delete process.env.ALLOW_SIMULATED_PAYMENTS;
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
      process.env.ALLOW_SIMULATED_PAYMENTS = 'true';
      const findOrderMock = vi.fn();
      mockDb = {
        order: {
          findUnique: findOrderMock,
          findFirst: findOrderMock,
          findUniqueOrThrow: findOrderMock,
          update: vi.fn(),
        },
        orderPaymentTransaction: {
          create: vi.fn(),
          update: vi.fn(),
          findFirst: vi.fn(),
        },
        orderEvent: {
          create: vi.fn(),
        },
        paymentGatewayConfig: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue(null),
          findFirst: vi.fn().mockResolvedValue(null),
          upsert: vi
            .fn()
            .mockImplementation((args) => Promise.resolve(args.create)),
        },
        shopperSession: {
          findFirst: vi.fn(),
        },
        storefrontThrottle: {
          upsert: vi.fn().mockResolvedValue({ count: 1 }),
        },
        $executeRaw: vi.fn().mockResolvedValue(1),
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

    it('returns and updates admin payment settings and checkout payment options', async () => {
      const settings = await service.getAdminSettings();
      expect(settings.gateways.map((gateway) => gateway.provider)).toEqual(
        expect.arrayContaining([
          'COD',
          'BKASH',
          'SSLCOMMERZ',
          'BANK_TRANSFER',
          'MANUAL_BKASH',
          'MANUAL_NAGAD',
        ]),
      );
      expect(
        settings.gateways.find((g) => g.provider === 'BKASH'),
      ).toBeDefined();
      expect(settings.paymentOptions).toBeDefined();
      expect(settings.paymentOptions.optionAEnabled).toBe(true);

      await service.updateAdminSetting('BKASH', {
        isEnabled: true,
        isSandbox: true,
        config: { appKey: 'test_app_key' },
      });
      expect(mockDb.paymentGatewayConfig.upsert).toHaveBeenCalled();

      await service.updateAdminSetting('PAYMENT_OPTIONS', {
        isEnabled: true,
        config: {
          optionAEnabled: true,
          optionBEnabled: true,
          optionCEnabled: true,
          optionCDiscountPercent: 5,
          optionCDiscountFixed: 0,
        },
      });
      expect(mockDb.paymentGatewayConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { provider: 'PAYMENT_OPTIONS' },
        }),
      );
    });

    it('initiates payment for an unpaid order with Option B (full amount)', async () => {
      mockDb.order.findUnique.mockResolvedValue({
        id: '11111111-1111-1111-1111-111111111111',
        orderNumber: 'ORD-111',
        shippingTotal: new Prisma.Decimal('120.00'),
        grandTotal: new Prisma.Decimal('1200.00'),
        currency: 'BDT',
        customerName: 'Test Customer',
        customerPhone: '01700000000',
        paymentStatus: 'UNPAID',
        status: 'PENDING',
        payments: [],
      });

      const res = await service.initiate(
        '11111111-1111-1111-1111-111111111111',
        OnlinePaymentMethod.BKASH,
        'http://localhost:3000',
        'OPTION_B',
      );

      expect(res.provider).toBe('BKASH');
      expect(res.redirectUrl).toBeDefined();
      expect(mockDb.orderPaymentTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: new Prisma.Decimal(1200),
            metadata: expect.objectContaining({ paymentOption: 'OPTION_B' }),
          }),
        }),
      );
    });

    it('Option A partial initiates only shippingTotal and ignores any client-supplied amount', async () => {
      mockDb.order.findUnique.mockResolvedValue({
        id: '11111111-1111-1111-1111-111111111111',
        orderNumber: 'ORD-111',
        shippingTotal: new Prisma.Decimal('150.00'),
        grandTotal: new Prisma.Decimal('2150.00'),
        currency: 'BDT',
        customerName: 'Test Customer',
        customerPhone: '01700000000',
        paymentStatus: 'UNPAID',
        status: 'PENDING',
        payments: [],
      });

      const res = await service.initiate(
        '11111111-1111-1111-1111-111111111111',
        OnlinePaymentMethod.BKASH,
        'http://localhost:3000',
        'OPTION_A',
      );

      expect(res.provider).toBe('BKASH');
      expect(mockDb.orderPaymentTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: new Prisma.Decimal(150),
            metadata: expect.objectContaining({
              paymentOption: 'OPTION_A',
              payableAmount: 150,
            }),
          }),
        }),
      );
    });

    it('rejects Option A when shipping is free (shippingTotal <= 0)', async () => {
      mockDb.order.findUnique.mockResolvedValue({
        id: 'free-order-id',
        orderNumber: 'ORD-FREE',
        shippingTotal: new Prisma.Decimal('0.00'),
        grandTotal: new Prisma.Decimal('1500.00'),
        currency: 'BDT',
        customerName: 'Test Customer',
        customerPhone: '01700000000',
        paymentStatus: 'UNPAID',
        status: 'PENDING',
        payments: [],
      });

      await expect(
        service.initiate(
          'free-order-id',
          OnlinePaymentMethod.BKASH,
          'http://localhost:3000',
          'OPTION_A',
        ),
      ).rejects.toThrow(
        'Advance delivery payment is not applicable for free delivery orders',
      );
    });

    it('rejects initiation if order is already PAID', async () => {
      mockDb.order.findUnique.mockResolvedValue({
        id: 'paid-order-id',
        orderNumber: 'ORD-PAID',
        shippingTotal: new Prisma.Decimal('120.00'),
        grandTotal: new Prisma.Decimal('1200.00'),
        paymentStatus: 'PAID',
        status: 'CONFIRMED',
        payments: [],
      });

      await expect(
        service.initiate(
          'paid-order-id',
          OnlinePaymentMethod.BKASH,
          'http://localhost:3000',
          'OPTION_B',
        ),
      ).rejects.toThrow('Order is already paid');
    });

    it('rejects initiation if order is CANCELLED', async () => {
      mockDb.order.findUnique.mockResolvedValue({
        id: 'cancelled-order-id',
        orderNumber: 'ORD-CANCELLED',
        shippingTotal: new Prisma.Decimal('120.00'),
        grandTotal: new Prisma.Decimal('1200.00'),
        paymentStatus: 'UNPAID',
        status: 'CANCELLED',
        payments: [],
      });

      await expect(
        service.initiate(
          'cancelled-order-id',
          OnlinePaymentMethod.BKASH,
          'http://localhost:3000',
          'OPTION_B',
        ),
      ).rejects.toThrow('Cannot initiate payment for a cancelled order');
    });

    it('Option A partial callback sets paymentStatus to PARTIALLY_PAID', async () => {
      const order = {
        id: 'order-part-1',
        orderNumber: 'ORD-PART-1',
        grandTotal: new Prisma.Decimal('1000.00'),
        paidTotal: new Prisma.Decimal('0.00'),
        currency: 'BDT',
        status: 'PENDING',
        paymentOption: 'OPTION_A',
        payments: [],
        reservations: [],
        items: [],
      };
      const pendingTxn = {
        id: 'txn-1',
        orderId: 'order-part-1',
        status: 'PENDING',
        amount: new Prisma.Decimal('100.00'),
        provider: 'BKASH',
        providerReference: 'sim_bkash_part',
        metadata: { storefrontOrigin: 'http://localhost:3000' },
      };

      mockDb.orderPaymentTransaction.findFirst.mockResolvedValue(pendingTxn);
      mockDb.order.findUnique.mockResolvedValue(order);
      // Simulate atomic increment returning paidTotal = 100.00
      mockDb.order.update
        .mockResolvedValueOnce({
          id: order.id,
          grandTotal: order.grandTotal,
          paidTotal: new Prisma.Decimal('100.00'),
          status: 'PENDING',
          confirmedAt: null,
        })
        .mockResolvedValueOnce({});

      const result = await service.processCallback(
        OnlinePaymentMethod.BKASH,
        { orderId: order.id },
        { paymentID: 'sim_bkash_part', status: 'success', amount: 100 },
      );

      expect(result.redirectUrl).toContain(
        '/orders/order-part-1?payment=success',
      );
      // Second update sets paymentStatus to PARTIALLY_PAID
      expect(mockDb.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-part-1' },
          data: expect.objectContaining({
            paymentStatus: 'PARTIALLY_PAID',
            status: 'CONFIRMED',
          }),
        }),
      );
    });

    it('Option B/C full callback sets paymentStatus to PAID', async () => {
      const order = {
        id: 'order-full-1',
        orderNumber: 'ORD-FULL-1',
        grandTotal: new Prisma.Decimal('1000.00'),
        paidTotal: new Prisma.Decimal('0.00'),
        currency: 'BDT',
        status: 'PENDING',
        paymentOption: 'OPTION_B',
        payments: [],
        reservations: [],
        items: [],
      };
      const pendingTxn = {
        id: 'txn-full-1',
        orderId: 'order-full-1',
        status: 'PENDING',
        amount: new Prisma.Decimal('1000.00'),
        provider: 'BKASH',
        providerReference: 'sim_bkash_full',
        metadata: { storefrontOrigin: 'http://localhost:3000' },
      };

      mockDb.orderPaymentTransaction.findFirst.mockResolvedValue(pendingTxn);
      mockDb.order.findUnique.mockResolvedValue(order);
      mockDb.order.update
        .mockResolvedValueOnce({
          id: order.id,
          grandTotal: order.grandTotal,
          paidTotal: new Prisma.Decimal('1000.00'),
          status: 'PENDING',
          confirmedAt: null,
        })
        .mockResolvedValueOnce({});

      await service.processCallback(
        OnlinePaymentMethod.BKASH,
        { orderId: order.id },
        { paymentID: 'sim_bkash_full', status: 'success', amount: 1000 },
      );

      expect(mockDb.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-full-1' },
          data: expect.objectContaining({
            paymentStatus: 'PAID',
            status: 'CONFIRMED',
          }),
        }),
      );
    });

    it('duplicate callback skips crediting if transaction already SUCCEEDED', async () => {
      const succeededTxn = {
        id: 'txn-done-1',
        orderId: 'order-dup-1',
        status: 'SUCCEEDED',
        amount: new Prisma.Decimal('1000.00'),
        provider: 'BKASH',
        providerReference: 'sim_bkash_done',
        metadata: { storefrontOrigin: 'http://localhost:3000' },
      };

      mockDb.orderPaymentTransaction.findFirst.mockResolvedValue(succeededTxn);
      mockDb.order.findUnique.mockResolvedValue({
        id: 'order-dup-1',
        grandTotal: new Prisma.Decimal('1000.00'),
        paidTotal: new Prisma.Decimal('1000.00'),
        payments: [succeededTxn],
        reservations: [],
        items: [],
      });

      const result = await service.processCallback(
        OnlinePaymentMethod.BKASH,
        { orderId: 'order-dup-1' },
        { paymentID: 'sim_bkash_done', status: 'success' },
      );

      expect(result.redirectUrl).toContain(
        '/orders/order-dup-1?payment=success',
      );
      // Must NOT update order.paidTotal
      expect(mockDb.order.update).not.toHaveBeenCalled();
    });

    it('concurrent callbacks acquire row lock and prevent double crediting', async () => {
      const order = {
        id: 'order-concur-1',
        grandTotal: new Prisma.Decimal('1000.00'),
        paidTotal: new Prisma.Decimal('0.00'),
        currency: 'BDT',
        status: 'PENDING',
        payments: [],
        reservations: [],
        items: [],
      };
      let txnStatus = 'PENDING';
      const txn = {
        id: 'txn-concur-1',
        orderId: 'order-concur-1',
        get status() {
          return txnStatus;
        },
        amount: new Prisma.Decimal('1000.00'),
        provider: 'BKASH',
        providerReference: 'sim_bkash_concur',
        metadata: { storefrontOrigin: 'http://localhost:3000' },
      };

      // Mock DB for transaction: the first callback will mark txn as SUCCEEDED inside tx
      mockDb.orderPaymentTransaction.findFirst.mockResolvedValue(txn);
      mockDb.order.findUnique.mockResolvedValue(order);
      mockDb.orderPaymentTransaction.update.mockImplementation(async () => {
        txnStatus = 'SUCCEEDED';
      });
      mockDb.order.update.mockResolvedValue({
        id: order.id,
        grandTotal: order.grandTotal,
        paidTotal: new Prisma.Decimal('1000.00'),
        status: 'PENDING',
        confirmedAt: null,
      });

      // Fire callback twice concurrently
      const [res1, res2] = await Promise.all([
        service.processCallback(
          OnlinePaymentMethod.BKASH,
          { orderId: order.id },
          { paymentID: 'sim_bkash_concur', status: 'success', amount: 1000 },
        ),
        service.processCallback(
          OnlinePaymentMethod.BKASH,
          { orderId: order.id },
          { paymentID: 'sim_bkash_concur', status: 'success', amount: 1000 },
        ),
      ]);

      expect(res1.redirectUrl).toBeDefined();
      expect(res2.redirectUrl).toBeDefined();
      // Verifies row-lock was requested
      expect(mockDb.$executeRaw).toHaveBeenCalled();
      // Crediting only happened once because the second found txn.status === 'SUCCEEDED'
      expect(mockDb.orderPaymentTransaction.update).toHaveBeenCalledTimes(1);
    });

    it('switchPaymentOption removes Option C discount when switching to Option A or COD', async () => {
      // Order had Option C discount of 50 BDT, subtotal 1000, shipping 80 (inside Dhaka), grandTotal 1030
      mockDb.order.findUnique.mockResolvedValue({
        id: 'order-switch-1',
        orderNumber: 'ORD-SW-1',
        subtotal: new Prisma.Decimal('1000.00'),
        shippingTotal: new Prisma.Decimal('80.00'),
        discountTotal: new Prisma.Decimal('50.00'),
        couponDiscount: new Prisma.Decimal('0.00'),
        paidTotal: new Prisma.Decimal('0.00'),
        refundedTotal: new Prisma.Decimal('0.00'),
        couponCode: null,
        taxTotal: new Prisma.Decimal('0.00'),
        grandTotal: new Prisma.Decimal('1030.00'),
        paymentStatus: 'UNPAID',
        status: 'PENDING',
        paymentOption: 'OPTION_C',
        addresses: [{ city: 'Dhaka' }],
        payments: [],
      });

      mockDb.order.update.mockResolvedValue({
        id: 'order-switch-1',
        orderNumber: 'ORD-SW-1',
        subtotal: new Prisma.Decimal('1000.00'),
        shippingTotal: new Prisma.Decimal('80.00'),
        discountTotal: new Prisma.Decimal('0.00'),
        grandTotal: new Prisma.Decimal('1080.00'),
        paidTotal: new Prisma.Decimal('0.00'),
        refundedTotal: new Prisma.Decimal('0.00'),
        paymentOption: 'OPTION_A',
      });

      const switched = await service.switchPaymentOption('order-switch-1', {
        paymentOption: 'OPTION_A',
      });

      expect(switched.paymentOption).toBe('OPTION_A');
      expect(switched.discountTotal).toBe('0.00');
      // grandTotal restored without discount: 1000 + 80 = 1080
      expect(switched.grandTotal).toBe('1080.00');
      expect(switched.payableNow).toBe('80.00');
      expect(switched.amountDueOnDelivery).toBe('1000.00');
      expect(mockDb.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-switch-1' },
          data: expect.objectContaining({
            discountTotal: new Prisma.Decimal(0),
            shippingTotal: new Prisma.Decimal(80),
            grandTotal: new Prisma.Decimal(1080),
            paymentOption: 'OPTION_A',
          }),
        }),
      );
    });

    it('rejects callback if verified amount mismatches expected amount, credits nothing', async () => {
      const order = {
        id: 'order-mismatch-1',
        orderNumber: 'ORD-MISMATCH-1',
        grandTotal: new Prisma.Decimal('1000.00'),
        paidTotal: new Prisma.Decimal('0.00'),
        currency: 'BDT',
        status: 'PENDING',
        payments: [],
      };
      const pendingTxn = {
        id: 'txn-mismatch-1',
        orderId: 'order-mismatch-1',
        status: 'PENDING',
        amount: new Prisma.Decimal('1000.00'),
        provider: 'BKASH',
        providerReference: 'sim_bkash_mismatch',
        metadata: { storefrontOrigin: 'http://localhost:3000' },
      };

      mockDb.orderPaymentTransaction.findFirst.mockResolvedValue(pendingTxn);
      mockDb.order.findUnique.mockResolvedValue(order);

      // Verify payment returns amount of 500 (mismatch vs expected 1000)
      const result = await service.processCallback(
        OnlinePaymentMethod.BKASH,
        { orderId: 'order-mismatch-1' },
        { paymentID: 'sim_bkash_mismatch', status: 'success', amount: 500 },
      );

      expect(result.redirectUrl).toContain(
        'payment=error&message=Amount+mismatch',
      );
      // Must NOT credit paidTotal
      expect(mockDb.order.update).not.toHaveBeenCalled();
      // Transaction updated to FAILED
      expect(mockDb.orderPaymentTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'txn-mismatch-1' },
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });

    it('rejects callback if verified currency mismatches expected currency, credits nothing', async () => {
      const order = {
        id: 'order-cur-mismatch-1',
        orderNumber: 'ORD-CUR-1',
        grandTotal: new Prisma.Decimal('1000.00'),
        paidTotal: new Prisma.Decimal('0.00'),
        currency: 'BDT',
        status: 'PENDING',
        payments: [],
      };
      const pendingTxn = {
        id: 'txn-cur-1',
        orderId: 'order-cur-mismatch-1',
        status: 'PENDING',
        amount: new Prisma.Decimal('1000.00'),
        provider: 'BKASH',
        providerReference: 'sim_bkash_cur',
        metadata: { storefrontOrigin: 'http://localhost:3000' },
      };

      mockDb.orderPaymentTransaction.findFirst.mockResolvedValue(pendingTxn);
      mockDb.order.findUnique.mockResolvedValue(order);

      // Currency is USD instead of BDT
      vi.spyOn(bkashAdapter, 'verifyPayment').mockResolvedValueOnce({
        success: true,
        provider: 'BKASH',
        transactionReference: 'sim_bkash_cur',
        rawStatus: 'Completed',
        amount: 1000,
        currency: 'USD',
      });

      const result = await service.processCallback(
        OnlinePaymentMethod.BKASH,
        { orderId: 'order-cur-mismatch-1' },
        { paymentID: 'sim_bkash_cur', status: 'success' },
      );

      expect(result.redirectUrl).toContain(
        'payment=error&message=Amount+mismatch',
      );
      expect(mockDb.order.update).not.toHaveBeenCalled();
      expect(mockDb.orderPaymentTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'txn-cur-1' },
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });

    it('switchPaymentOption is blocked once an advance or payment has been recorded', async () => {
      mockDb.order.findUnique.mockResolvedValue({
        id: 'order-paid-partial',
        orderNumber: 'ORD-PAID-P',
        subtotal: new Prisma.Decimal('1000.00'),
        shippingTotal: new Prisma.Decimal('100.00'),
        discountTotal: new Prisma.Decimal('0.00'),
        paidTotal: new Prisma.Decimal('100.00'),
        grandTotal: new Prisma.Decimal('1100.00'),
        paymentStatus: 'PARTIALLY_PAID',
        status: 'CONFIRMED',
        paymentOption: 'OPTION_A',
      });

      await expect(
        service.switchPaymentOption('order-paid-partial', 'OPTION_B'),
      ).rejects.toThrow(
        'Cannot switch payment option once a payment or advance has been recorded',
      );
    });

    it('switchPaymentOption rejects unauthorized caller session', async () => {
      mockDb.order.findUnique.mockResolvedValue({
        id: 'order-unauth-1',
        orderNumber: 'ORD-UNAUTH-1',
        subtotal: new Prisma.Decimal('1000.00'),
        shippingTotal: new Prisma.Decimal('100.00'),
        discountTotal: new Prisma.Decimal('0.00'),
        paidTotal: new Prisma.Decimal('0.00'),
        grandTotal: new Prisma.Decimal('1100.00'),
        paymentStatus: 'UNPAID',
        status: 'PENDING',
        paymentOption: 'OPTION_B',
      });

      // Session not found
      mockDb.shopperSession.findFirst.mockResolvedValue(null);

      await expect(
        service.switchPaymentOption(
          'order-unauth-1',
          'OPTION_A',
          undefined,
          'invalid-token',
        ),
      ).rejects.toThrow('Invalid or expired session');
    });

    it('switchPaymentOption recomputes delivery charges when Option C discount changes subtotal boundary', async () => {
      // Subtotal 2050, inside Dhaka.
      // Deliberately free delivery threshold 2000.
      vi.stubEnv('SHIPPING_FREE_ABOVE', '2000');
      vi.stubEnv('SHIPPING_INSIDE_DHAKA', '80');

      // Order initially without discount: 2050 >= 2000, shipping = 0
      mockDb.order.findUnique.mockResolvedValue({
        id: 'order-boundary-1',
        orderNumber: 'ORD-BOUND-1',
        subtotal: new Prisma.Decimal('2050.00'),
        shippingTotal: new Prisma.Decimal('0.00'),
        discountTotal: new Prisma.Decimal('0.00'),
        paidTotal: new Prisma.Decimal('0.00'),
        grandTotal: new Prisma.Decimal('2050.00'),
        paymentStatus: 'UNPAID',
        status: 'PENDING',
        paymentOption: 'OPTION_B',
        addresses: [{ city: 'Dhaka' }],
      });

      // Option C provides 100 BDT discount: post-discount subtotal is 1950 (< 2000)
      // Recalculated shipping is 80 BDT!
      vi.spyOn(service, 'getPaymentModelConfig').mockResolvedValueOnce({
        optionAEnabled: true,
        optionBEnabled: true,
        optionCEnabled: true,
        optionCDiscountPercent: 0,
        optionCDiscountFixed: 100,
      });

      mockDb.order.update.mockResolvedValue({
        id: 'order-boundary-1',
        orderNumber: 'ORD-BOUND-1',
        subtotal: new Prisma.Decimal('2050.00'),
        discountTotal: new Prisma.Decimal('100.00'),
        shippingTotal: new Prisma.Decimal('80.00'),
        grandTotal: new Prisma.Decimal('2030.00'),
        paidTotal: new Prisma.Decimal('0.00'),
        paymentOption: 'OPTION_C',
      });

      const switched = await service.switchPaymentOption(
        'order-boundary-1',
        'OPTION_C',
      );
      expect(switched.discountTotal).toBe('100.00');
      expect(switched.shippingTotal).toBe('80.00');
      expect(switched.grandTotal).toBe('2030.00');

      vi.unstubAllEnvs();
    });
  });
});
