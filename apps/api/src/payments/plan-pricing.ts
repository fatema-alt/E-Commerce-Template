import { Prisma } from '../generated/prisma/client.js';

const D = Prisma.Decimal;
type Money = Prisma.Decimal | string | number;
export type Plan = 'FULL_PAYMENT' | 'PARTIAL_ADVANCE' | 'COD';
export interface PlanSettings {
  fullEnabled: boolean;
  discountType: string;
  discountValue: Money;
  maxDiscountCap?: Money | null;
  partialEnabled: boolean;
  advanceType: string;
  advanceValue: Money;
  codEnabled: boolean;
  codMin?: Money | null;
  codMax?: Money | null;
  allowStacking: boolean;
  maxTotalDiscountPercent?: Money | null;
}
export const defaultPlanSettings: PlanSettings = {
  fullEnabled: true,
  discountType: 'percentage',
  discountValue: 0,
  partialEnabled: true,
  advanceType: 'delivery_charge_only',
  advanceValue: 0,
  codEnabled: false,
  allowStacking: false,
};
export interface PricingCoupon {
  type: string;
  value: Money;
  maxDiscountAmount?: Money | null;
  combineWithPrepaidDiscount?: boolean;
}
const round = (v: Prisma.Decimal) => v.toDecimalPlaces(2);
const bounded = (v: Prisma.Decimal, max: Prisma.Decimal) =>
  round(D.max(0, D.min(v, max)));

/** Pure pricing boundary. No payment methods, gateway assumptions or client amounts. */
export function pricePlan(
  subtotalInput: Money,
  plan: Plan,
  settings: PlanSettings,
  delivery: (discountedSubtotal: Prisma.Decimal) => Money,
  coupon?: PricingCoupon | null,
) {
  const subtotal = round(new D(subtotalInput));
  const couponCandidate =
    !coupon || coupon.type === 'FREE_SHIPPING'
      ? new D(0)
      : bounded(
          coupon.type === 'PERCENTAGE'
            ? D.min(
                round(subtotal.mul(coupon.value).div(100)),
                coupon.maxDiscountAmount ?? subtotal,
              )
            : new D(coupon.value),
          subtotal,
        );
  const prepaid = (base: Prisma.Decimal) =>
    plan !== 'FULL_PAYMENT'
      ? new D(0)
      : bounded(
          settings.discountType === 'percentage'
            ? D.min(
                round(base.mul(settings.discountValue).div(100)),
                settings.maxDiscountCap ?? base,
              )
            : new D(settings.discountValue),
          base,
        );
  const stacking = Boolean(
    settings.allowStacking ||
    coupon?.combineWithPrepaidDiscount ||
    coupon?.type === 'FREE_SHIPPING',
  );
  let couponDiscount = couponCandidate;
  let prepaidDiscount = prepaid(
    stacking ? subtotal.minus(couponDiscount) : subtotal,
  );
  let discountMessage = '';
  if (
    !stacking &&
    plan === 'FULL_PAYMENT' &&
    couponCandidate.greaterThan(0) &&
    prepaidDiscount.greaterThan(0)
  ) {
    if (prepaidDiscount.greaterThan(couponCandidate)) {
      couponDiscount = new D(0);
      discountMessage =
        'Full Payment discount applied because it saves more than your coupon.';
    } else {
      prepaidDiscount = new D(0);
      discountMessage =
        'Coupon applied because it saves at least as much as the Full Payment discount.';
    }
  }
  if (
    stacking &&
    plan === 'FULL_PAYMENT' &&
    coupon &&
    settings.maxTotalDiscountPercent != null
  ) {
    const cap = bounded(
      round(subtotal.mul(settings.maxTotalDiscountPercent).div(100)),
      subtotal,
    );
    couponDiscount = D.min(couponDiscount, cap);
    prepaidDiscount = D.min(
      prepaidDiscount,
      D.max(0, cap.minus(couponDiscount)),
    );
  }
  const discount = couponDiscount.plus(prepaidDiscount);
  const shipping =
    coupon?.type === 'FREE_SHIPPING'
      ? new D(0)
      : round(new D(delivery(subtotal.minus(discount))));
  const total = subtotal.minus(discount).plus(shipping);
  let payableNow = total;
  let available = settings.fullEnabled;
  if (plan === 'PARTIAL_ADVANCE') {
    payableNow = bounded(
      settings.advanceType === 'delivery_charge_only'
        ? shipping
        : settings.advanceType === 'percentage_of_order'
          ? round(total.mul(settings.advanceValue).div(100))
          : new D(settings.advanceValue),
      total,
    );
    available = settings.partialEnabled && payableNow.greaterThan(0);
  } else if (plan === 'COD') {
    payableNow = new D(0);
    available =
      settings.codEnabled &&
      (settings.codMin == null ||
        total.greaterThanOrEqualTo(settings.codMin)) &&
      (settings.codMax == null || total.lessThanOrEqualTo(settings.codMax));
  }
  return {
    plan,
    available,
    subtotal,
    couponDiscount,
    prepaidDiscount,
    discount,
    shipping,
    total,
    payableNow,
    amountDueOnDelivery: total.minus(payableNow),
    discountMessage,
  };
}

export type PlanPrice = ReturnType<typeof pricePlan>;
export function publicPrice(price: PlanPrice) {
  const { plan, available, discountMessage, ...amounts } = price;
  return {
    plan,
    available,
    discountMessage,
    ...Object.fromEntries(
      Object.entries(amounts).map(([k, v]) => [k, v.toFixed(2)]),
    ),
  };
}
