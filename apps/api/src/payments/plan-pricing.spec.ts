import { describe, expect, it } from 'vitest';
import {
  defaultPlanSettings,
  pricePlan,
  type Plan,
  type PlanSettings,
  type PricingCoupon,
} from './plan-pricing.js';

const price = (
  plan: Plan = 'FULL_PAYMENT',
  settings: Partial<PlanSettings> = {},
  coupon?: PricingCoupon,
  shipping = 100,
  subtotal = '1000',
) =>
  pricePlan(
    subtotal,
    plan,
    { ...defaultPlanSettings, ...settings },
    () => shipping,
    coupon,
  );
describe('Shared checkout pricing', () => {
  it('full payment includes shipping, with no delivery balance', () => {
    const p = price();
    expect(p.total.toFixed(2)).toBe('1100.00');
    expect(p.payableNow.equals(p.total)).toBe(true);
    expect(p.amountDueOnDelivery.isZero()).toBe(true);
  });
  it('discounts products only, including fixed discounts above the product subtotal', () => {
    const p = price('FULL_PAYMENT', {
      discountType: 'fixed',
      discountValue: 1200,
    });
    expect(p.total.toFixed(2)).toBe('100.00');
    expect(p.prepaidDiscount.toFixed(2)).toBe('1000.00');
  });
  it('caps percentage prepaid discount', () => {
    expect(
      price('FULL_PAYMENT', {
        discountValue: 20,
        maxDiscountCap: 80,
      }).prepaidDiscount.toFixed(2),
    ).toBe('80.00');
  });
  it('pays only delivery in the delivery advance plan', () => {
    const p = price('PARTIAL_ADVANCE');
    expect(p.payableNow.toFixed(2)).toBe('100.00');
    expect(p.amountDueOnDelivery.toFixed(2)).toBe('1000.00');
  });
  it('hides delivery-only advance when delivery is free', () => {
    expect(price('PARTIAL_ADVANCE', {}, undefined, 0).available).toBe(false);
  });
  it.each(['fixed_amount', 'percentage_of_order'])(
    'keeps %s advance for free delivery',
    (advanceType) => {
      expect(
        price(
          'PARTIAL_ADVANCE',
          { advanceType, advanceValue: 10 },
          undefined,
          0,
        ).available,
      ).toBe(true);
    },
  );
  it('calculates percentage advance on post-coupon total including delivery, without a prepaid discount', () => {
    const p = price(
      'PARTIAL_ADVANCE',
      {
        advanceType: 'percentage_of_order',
        advanceValue: 25,
        discountValue: 90,
      },
      { type: 'PERCENTAGE', value: 10 },
    );
    expect(p.payableNow.toFixed(2)).toBe('250.00');
    expect(p.prepaidDiscount.isZero()).toBe(true);
  });
  it('clamps excessive advance at the total and hides a zero advance', () => {
    expect(
      price('PARTIAL_ADVANCE', {
        advanceType: 'fixed_amount',
        advanceValue: 9000,
      }).payableNow.toFixed(2),
    ).toBe('1100.00');
    expect(
      price('PARTIAL_ADVANCE', { advanceType: 'fixed_amount', advanceValue: 0 })
        .available,
    ).toBe(false);
  });
  it('COD defaults off and uses only enabled toggle and inclusive total limits', () => {
    expect(price('COD').available).toBe(false);
    const p = price('COD', { codEnabled: true, codMin: 1100, codMax: 1100 });
    expect(p.available).toBe(true);
    expect(p.payableNow.isZero()).toBe(true);
    expect(p.amountDueOnDelivery.toFixed(2)).toBe('1100.00');
    expect(price('COD', { codEnabled: true, codMax: 1099 }).available).toBe(
      false,
    );
  });
  it.each([
    [5, '100.00', '0.00'],
    [20, '0.00', '200.00'],
    [10, '100.00', '0.00'],
  ])(
    'larger actual discount wins without stacking (%s%% prepaid)',
    (discountValue, couponAmount, prepaidAmount) => {
      const p = price(
        'FULL_PAYMENT',
        { discountValue },
        { type: 'PERCENTAGE', value: 10 },
      );
      expect(p.couponDiscount.toFixed(2)).toBe(couponAmount);
      expect(p.prepaidDiscount.toFixed(2)).toBe(prepaidAmount);
      expect(p.discountMessage).not.toBe('');
    },
  );
  it.each([true, false])(
    'stacks sequentially with global=%s or coupon permission',
    (global) => {
      const p = price(
        'FULL_PAYMENT',
        { discountValue: 5, allowStacking: global },
        { type: 'PERCENTAGE', value: 10, combineWithPrepaidDiscount: !global },
      );
      expect(p.couponDiscount.toFixed(2)).toBe('100.00');
      expect(p.prepaidDiscount.toFixed(2)).toBe('45.00');
      expect(p.total.toFixed(2)).toBe('955.00');
    },
  );
  it('caps combined discounts without reducing delivery', () => {
    const p = price(
      'FULL_PAYMENT',
      { discountValue: 50, allowStacking: true, maxTotalDiscountPercent: 12 },
      { type: 'PERCENTAGE', value: 10 },
    );
    expect(p.couponDiscount.toFixed(2)).toBe('100.00');
    expect(p.prepaidDiscount.toFixed(2)).toBe('20.00');
    expect(p.total.toFixed(2)).toBe('980.00');
  });
  it('caps an existing coupon too when combined cap is below its discount', () => {
    const p = price(
      'FULL_PAYMENT',
      { discountValue: 10, allowStacking: true, maxTotalDiscountPercent: 5 },
      { type: 'FIXED_AMOUNT', value: 200 },
    );
    expect(p.discount.toFixed(2)).toBe('50.00');
    expect(p.prepaidDiscount.isZero()).toBe(true);
  });
  it('free shipping always combines with prepaid, and hides delivery-only partial', () => {
    const coupon = { type: 'FREE_SHIPPING', value: 0 };
    const p = price('FULL_PAYMENT', { discountValue: 5 }, coupon);
    expect(p.shipping.isZero()).toBe(true);
    expect(p.total.toFixed(2)).toBe('950.00');
    expect(price('PARTIAL_ADVANCE', {}, coupon).available).toBe(false);
  });
  it('rounds each discount to two decimals consistently', () => {
    const p = price(
      'FULL_PAYMENT',
      { discountValue: 5, allowStacking: true },
      { type: 'PERCENTAGE', value: 10 },
      100,
      '999.99',
    );
    expect(p.couponDiscount.toFixed(2)).toBe('100.00');
    expect(p.prepaidDiscount.toFixed(2)).toBe('45.00');
    expect(p.total.toFixed(2)).toBe('954.99');
  });
  it('respects each plan toggle', () => {
    expect(price('FULL_PAYMENT', { fullEnabled: false }).available).toBe(false);
    expect(price('PARTIAL_ADVANCE', { partialEnabled: false }).available).toBe(
      false,
    );
  });
});
