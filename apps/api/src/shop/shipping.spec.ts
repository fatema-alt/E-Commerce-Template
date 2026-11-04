import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calcShipping, getShippingRates } from './shipping.config.js';

describe('Bangladesh Shipping Calculation Rules', () => {
  beforeEach(() => {
    vi.stubEnv('SHIPPING_FREE_ABOVE', undefined);
    vi.stubEnv('SHIPPING_INSIDE_DHAKA', undefined);
    vi.stubEnv('SHIPPING_OUTSIDE_DHAKA', undefined);
  });
  afterEach(() => vi.unstubAllEnvs());

  it('charges delivery by default without an implicit free-delivery threshold', () => {
    const rates = getShippingRates();
    expect(rates.insideDhaka).toBe(80);
    expect(rates.outsideDhaka).toBe(150);
    expect(rates.freeAbove).toBe(0);
    expect(calcShipping(2000, 'Dhaka')).toBe(80);
    expect(calcShipping(5000, 'Sylhet')).toBe(150);
  });

  it('charges inside-Dhaka rate (80 BDT) for Dhaka city variations and areas', () => {
    expect(calcShipping(500, 'Dhaka')).toBe(80);
    expect(calcShipping(500, 'dhaka')).toBe(80);
    expect(calcShipping(500, 'Dhaka City')).toBe(80);
    expect(calcShipping(500, 'ঢাকা')).toBe(80);
    expect(calcShipping(500, 'Mirpur', 'Dhaka')).toBe(80);
    expect(calcShipping(500, 'Uttara', 'Dhaka')).toBe(80);
    expect(calcShipping(500, 'Gulshan')).toBe(80);
    expect(calcShipping(500, 'Banani')).toBe(80);
    expect(calcShipping(500, 'Dhanmondi')).toBe(80);
    expect(calcShipping(500, 'Savar')).toBe(80);
  });

  it('charges outside-Dhaka rate (150 BDT) for other districts', () => {
    expect(calcShipping(500, 'Chittagong', 'Chattogram')).toBe(150);
    expect(calcShipping(500, 'Sylhet')).toBe(150);
    expect(calcShipping(500, 'Rajshahi')).toBe(150);
    expect(calcShipping(500, 'Khulna')).toBe(150);
    expect(calcShipping(500, 'Barisal')).toBe(150);
    expect(calcShipping(500, 'Rangpur')).toBe(150);
    expect(calcShipping(500, "Cox's Bazar")).toBe(150);
  });

  it('defaults to outside-Dhaka rate when city is not yet specified', () => {
    expect(calcShipping(500, undefined, undefined)).toBe(150);
    expect(calcShipping(500, '', '')).toBe(150);
  });

  it('grants free delivery (0 BDT) when order subtotal meets or exceeds threshold', () => {
    vi.stubEnv('SHIPPING_FREE_ABOVE', '2000');
    expect(calcShipping(2000, 'Chittagong')).toBe(0);
    expect(calcShipping(2500, 'Sylhet')).toBe(0);
    expect(calcShipping(5000, 'Dhaka')).toBe(0);
  });

  it.each(['', 'invalid', '-1', 'Infinity', '2000invalid', '0'])(
    'does not grant free delivery for an invalid or disabled threshold (%s)',
    (threshold) => {
      vi.stubEnv('SHIPPING_FREE_ABOVE', threshold);
      expect(getShippingRates().freeAbove).toBe(0);
      expect(calcShipping(5000, 'Dhaka')).toBe(80);
    },
  );
});
