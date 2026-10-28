import type { Quote } from "./shop-client";

/** Display only the rates supplied by the server quote; never invent a fallback rate. */
export function shippingSummary(rates: NonNullable<Quote["shippingRates"]>): string {
  const amount = (value: number) => value.toLocaleString("en-BD");
  const eligibility = rates.freeAbove > 0
    ? `Free delivery on orders of at least ৳${amount(rates.freeAbove)} after discounts. `
    : "";
  return `${eligibility}Delivery: ৳${amount(rates.insideDhaka)} inside Dhaka · ৳${amount(rates.outsideDhaka)} elsewhere.`;
}
