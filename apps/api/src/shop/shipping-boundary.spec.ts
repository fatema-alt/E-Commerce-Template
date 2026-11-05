import { Prisma } from '../generated/prisma/client.js';
import { ShopService } from './shop.service.js';
import { defaultPlanSettings } from '../payments/plan-pricing.js';
import { getShippingRates } from './shipping.config.js';

describe('Quoted free-delivery eligibility after discounts', () => {
  beforeEach(() => {
    // Deliberately non-default configuration: tests must follow the configured rates.
    vi.stubEnv('SHIPPING_FREE_ABOVE', '3456');
    vi.stubEnv('SHIPPING_INSIDE_DHAKA', '93');
    vi.stubEnv('SHIPPING_OUTSIDE_DHAKA', '171');
  });
  afterEach(() => vi.unstubAllEnvs());

  async function quote(
    subtotal: number,
    couponDiscount = 0,
    paymentOption?: 'FULL_PAYMENT',
  ) {
    const db = {
      product: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'boundary-product',
          type: 'SIMPLE',
          name: 'Boundary product',
          slug: 'boundary-product',
          categoryId: 'category',
          currency: 'BDT',
          price: new Prisma.Decimal(subtotal),
          salePrice: null,
          trackInventory: false,
          variants: [],
          images: [],
        }),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ count: 0n }]),
    };
    const promotions = {
      evaluateCoupon: vi.fn().mockResolvedValue({
        code: 'BOUNDARY',
        type: 'FIXED_AMOUNT',
        value: couponDiscount,
        discountAmount: new Prisma.Decimal(couponDiscount),
      }),
    };
    const service = new ShopService(
      db as never,
      {} as never,
      {
        settings: vi
          .fn()
          .mockResolvedValue({ ...defaultPlanSettings, discountValue: 5 }),
      } as never,
      promotions as never,
    );
    const result = await service.quote(
      {
        items: [{ productId: 'boundary-product', quantity: 1 }],
        city: 'Dhaka',
        paymentOption,
        ...(couponDiscount ? { couponCode: 'BOUNDARY' } : {}),
      },
      'boundary-session',
    );
    if (couponDiscount) expect(promotions.evaluateCoupon).toHaveBeenCalled();
    return result;
  }

  it('grants free delivery exactly at the configured threshold', async () => {
    const rates = getShippingRates();
    const result = await quote(rates.freeAbove);
    expect(result.shipping).toBe('0.00');
    expect(result.shippingRates).toEqual(rates);
  });

  it('does not apply a prepaid discount until full payment is explicitly selected', async () => {
    const neutral = await quote(1000);
    expect(neutral.prepaidDiscount).toBe('0.00');
    expect(neutral.discount).toBe('0.00');
    const prepaid = await quote(1000, 0, 'FULL_PAYMENT');
    expect(prepaid.prepaidDiscount).toBe('50.00');
    expect(Number(prepaid.total)).toBeLessThan(Number(neutral.total));
  });
  it.each([1999, 2000, 2500, 5000])(
    'keeps delivery charges and partial advance available for a %s order without a configured promotion',
    async (subtotal) => {
      vi.stubEnv('SHIPPING_FREE_ABOVE', undefined);
      const result = await quote(subtotal);
      expect(result.shipping).toBe('93.00');
      expect(
        result.plans.find((plan) => plan.plan === 'PARTIAL_ADVANCE'),
      ).toMatchObject({
        available: true,
        shipping: '93.00',
        payableNow: '93.00',
        amountDueOnDelivery: subtotal.toFixed(2),
      });
    },
  );
  it('charges delivery one unit below the configured threshold', async () => {
    const rates = getShippingRates();
    expect((await quote(rates.freeAbove - 1)).shipping).toBe(
      rates.insideDhaka.toFixed(2),
    );
  });
  it('uses the post-coupon subtotal: below threshold costs delivery, exactly at it is free', async () => {
    const rates = getShippingRates();
    const discount = 100;
    const below = await quote(rates.freeAbove, discount);
    expect(below.discount).toBe(discount.toFixed(2));
    expect(below.shipping).toBe(rates.insideDhaka.toFixed(2));
    expect((await quote(rates.freeAbove + discount, discount)).shipping).toBe(
      '0.00',
    );
  });
});
