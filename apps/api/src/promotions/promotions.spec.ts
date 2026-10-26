import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PromotionsService } from './promotions.service.js';
import { CouponType, Prisma } from '../generated/prisma/client.js';

const D = Prisma.Decimal;

describe('PromotionsService Unit Tests', () => {
  let mockDb: any;
  let service: PromotionsService;

  beforeEach(() => {
    mockDb = {
      coupon: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      couponUsage: {
        count: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb) =>
        Array.isArray(cb) ? Promise.all(cb) : cb(mockDb),
      ),
    };

    service = new PromotionsService(mockDb);
  });

  describe('create', () => {
    it('creates a percentage coupon with uppercase code', async () => {
      mockDb.coupon.findUnique.mockResolvedValue(null);
      mockDb.coupon.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'coupon-1', ...data }),
      );

      const result = await service.create({
        code: 'save10',
        type: CouponType.PERCENTAGE,
        value: 10,
        minOrderAmount: 500,
        perCustomerLimit: 1,
        isActive: true,
      });

      expect(result.code).toBe('SAVE10');
      expect(mockDb.coupon.create).toHaveBeenCalled();
    });

    it('rejects percentage discount greater than 100', async () => {
      mockDb.coupon.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          code: 'OVER100',
          type: CouponType.PERCENTAGE,
          value: 150,
          perCustomerLimit: 1,
          isActive: true,
        }),
      ).rejects.toThrow('Percentage coupon value must be between 1 and 100');
    });

    it('rejects duplicate coupon code', async () => {
      mockDb.coupon.findUnique.mockResolvedValue({ id: 'existing', code: 'DUP' });

      await expect(
        service.create({
          code: 'dup',
          type: CouponType.FIXED_AMOUNT,
          value: 50,
          perCustomerLimit: 1,
          isActive: true,
        }),
      ).rejects.toThrow('already exists');
    });
  });

  describe('evaluateCoupon', () => {
    it('calculates percentage discount accurately', async () => {
      mockDb.coupon.findUnique.mockResolvedValue({
        id: 'c-1',
        code: 'SAVE15',
        type: CouponType.PERCENTAGE,
        value: new D(15),
        isActive: true,
        usageCount: 0,
        perCustomerLimit: 1,
      });

      const res = await service.evaluateCoupon('save15', new D(1000));
      expect(res.discountAmount.toString()).toBe('150');
      expect(res.code).toBe('SAVE15');
    });

    it('applies max discount amount cap when configured', async () => {
      mockDb.coupon.findUnique.mockResolvedValue({
        id: 'c-2',
        code: 'MEGA50',
        type: CouponType.PERCENTAGE,
        value: new D(50),
        maxDiscountAmount: new D(200),
        isActive: true,
        usageCount: 0,
        perCustomerLimit: 1,
      });

      const res = await service.evaluateCoupon('mega50', new D(1000));
      expect(res.discountAmount.toString()).toBe('200');
    });

    it('enforces minimum order amount', async () => {
      mockDb.coupon.findUnique.mockResolvedValue({
        id: 'c-3',
        code: 'BIGSPENDER',
        type: CouponType.FIXED_AMOUNT,
        value: new D(300),
        minOrderAmount: new D(2000),
        isActive: true,
        usageCount: 0,
        perCustomerLimit: 1,
      });

      await expect(
        service.evaluateCoupon('bigspender', new D(1500)),
      ).rejects.toThrow('Minimum order amount');
    });

    it('rejects expired coupon', async () => {
      mockDb.coupon.findUnique.mockResolvedValue({
        id: 'c-4',
        code: 'EXPIRED',
        type: CouponType.PERCENTAGE,
        value: new D(10),
        expiresAt: new Date(Date.now() - 86400000),
        isActive: true,
        usageCount: 0,
        perCustomerLimit: 1,
      });

      await expect(service.evaluateCoupon('expired', new D(500))).rejects.toThrow(
        'expired',
      );
    });

    it('enforces customer usage limits', async () => {
      mockDb.coupon.findUnique.mockResolvedValue({
        id: 'c-5',
        code: 'ONCEONLY',
        type: CouponType.PERCENTAGE,
        value: new D(20),
        isActive: true,
        usageCount: 1,
        perCustomerLimit: 1,
      });
      mockDb.couponUsage.count.mockResolvedValue(1);

      await expect(
        service.evaluateCoupon('onceonly', new D(1000), {
          customerPhone: '01700000000',
        }),
      ).rejects.toThrow('maximum usage limit');
    });
  });
});
