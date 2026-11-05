/**
 * Bangladesh delivery rate configuration.
 *
 * Rules (evaluated top-to-bottom, first match wins):
 *  1. freeAbove  – if order subtotal (after coupon) >= this value, shipping = 0.
 *  2. An explicitly selected delivery area uses its configured rate.
 *  3. Legacy requests infer the rate from Dhaka city zones or other districts.
 *
 * Admin can override these in .env; no DB migration needed for the MVP.
 * Values are in BDT, stored as plain numbers (converted to Decimal in service).
 */

export interface ShippingRates {
  /** Minimum subtotal (BDT) for free delivery. 0 = never free. */
  freeAbove: number;
  /** Delivery fee inside Dhaka metropolitan area (BDT). */
  insideDhaka: number;
  /** Delivery fee outside Dhaka (rest of BD) (BDT). */
  outsideDhaka: number;
}

/** Canonical lower-case city/district names that count as "inside Dhaka". */
export const DHAKA_ZONES = new Set([
  'dhaka',
  'ঢাকা',
  'dhaka city',
  'dhaka metropolitan',
  'mirpur',
  'uttara',
  'dhanmondi',
  'mohammadpur',
  'gulshan',
  'banani',
  'motijheel',
  'tejgaon',
  'badda',
  'khilgaon',
  'rampura',
  'demra',
  'lalbagh',
  'hazaribagh',
  'shyamoli',
  'kafrul',
  'pallabi',
  'cantonment',
  'adabor',
  'savar',
  'keraniganj',
  'narayanganj',
]);

export function getShippingRates(): ShippingRates {
  // Free delivery is opt-in; an unset threshold must not waive delivery fees
  // or remove the delivery-charge-only advance plan on larger orders.
  const freeAbove = Number(process.env.SHIPPING_FREE_ABOVE ?? '0');
  const insideDhaka = parseFloat(process.env.SHIPPING_INSIDE_DHAKA ?? '80');
  const outsideDhaka = parseFloat(process.env.SHIPPING_OUTSIDE_DHAKA ?? '150');
  return {
    freeAbove: isFinite(freeAbove) && freeAbove >= 0 ? freeAbove : 0,
    insideDhaka: isFinite(insideDhaka) && insideDhaka >= 0 ? insideDhaka : 80,
    outsideDhaka:
      isFinite(outsideDhaka) && outsideDhaka >= 0 ? outsideDhaka : 150,
  };
}

/**
 * Calculate shipping fee for a given subtotal + destination.
 *
 * @param subtotalAfterDiscount  – net subtotal in BDT (after coupon).
 * @param city                   – city field from shipping address.
 * @param district               – optional district field.
 * @returns shipping fee in BDT (integer, never negative).
 */
export function calcShipping(
  subtotalAfterDiscount: number,
  city?: string,
  district?: string,
  deliveryArea?: 'inside_dhaka' | 'outside_dhaka',
): number {
  const rates = getShippingRates();

  // Free shipping threshold
  if (rates.freeAbove > 0 && subtotalAfterDiscount >= rates.freeAbove) {
    return 0;
  }

  if (deliveryArea === 'inside_dhaka') return rates.insideDhaka;
  if (deliveryArea === 'outside_dhaka') return rates.outsideDhaka;

  const normalize = (s?: string) => (s ?? '').trim().toLowerCase();
  const loc = normalize(city);
  const dist = normalize(district);

  const isInsideDhaka =
    DHAKA_ZONES.has(loc) ||
    DHAKA_ZONES.has(dist) ||
    loc.includes('dhaka') ||
    loc.includes('ঢাকা') ||
    dist.includes('dhaka') ||
    dist.includes('ঢাকা');

  return isInsideDhaka ? rates.insideDhaka : rates.outsideDhaka;
}
