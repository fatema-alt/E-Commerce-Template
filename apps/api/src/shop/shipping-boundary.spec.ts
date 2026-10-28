import { Prisma } from '../generated/prisma/client.js';
import { ShopService } from './shop.service.js';
import { getShippingRates } from './shipping.config.js';

describe('Quoted free-delivery eligibility after discounts', () => {
  beforeEach(() => {
    // Deliberately non-default configuration: tests must follow the configured rates.
    vi.stubEnv('SHIPPING_FREE_ABOVE', '3456');
    vi.stubEnv('SHIPPING_INSIDE_DHAKA', '93');
    vi.stubEnv('SHIPPING_OUTSIDE_DHAKA', '171');
  });
  afterEach(() => vi.unstubAllEnvs());

  async function quote(subtotal: number, couponDiscount = 0) {
    const db = {
      product: { findFirst: vi.fn().mockResolvedValue({
        id: 'boundary-product', type: 'SIMPLE', name: 'Boundary product',
        slug: 'boundary-product', categoryId: 'category', currency: 'BDT',
        price: new Prisma.Decimal(subtotal), salePrice: null,
        trackInventory: false, variants: [], images: [],
      }) },
      $queryRaw: vi.fn().mockResolvedValue([{ count: 0n }]),
    };
    const promotions = { evaluateCoupon: vi.fn().mockResolvedValue({
      code: 'BOUNDARY', discountAmount: new Prisma.Decimal(couponDiscount),
    }) };
    const service = new ShopService(db as never, {} as never, {} as never, promotions as never);
    const result = await service.quote({
      items: [{ productId: 'boundary-product', quantity: 1 }], city: 'Dhaka',
      ...(couponDiscount ? { couponCode: 'BOUNDARY' } : {}),
    }, 'boundary-session');
    if (couponDiscount) expect(promotions.evaluateCoupon).toHaveBeenCalled();
    return result;
  }

  it('grants free delivery exactly at the configured threshold', async () => {
    const rates = getShippingRates();
    const result = await quote(rates.freeAbove);
    expect(result.shipping).toBe('0.00');
    expect(result.shippingRates).toEqual(rates);
  });
  it('charges delivery one unit below the configured threshold', async () => {
    const rates = getShippingRates();
    expect((await quote(rates.freeAbove - 1)).shipping).toBe(rates.insideDhaka.toFixed(2));
  });
  it('uses the post-coupon subtotal: below threshold costs delivery, exactly at it is free', async () => {
    const rates = getShippingRates();
    const discount = 100;
    const below = await quote(rates.freeAbove, discount);
    expect(below.discount).toBe(discount.toFixed(2));
    expect(below.shipping).toBe(rates.insideDhaka.toFixed(2));
    expect((await quote(rates.freeAbove + discount, discount)).shipping).toBe('0.00');
  });
});
