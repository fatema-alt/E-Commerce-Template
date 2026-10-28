export async function shopRequest<T>(
  path: string,
  body?: unknown,
  idempotencyKey?: string,
): Promise<T> {
  const response = await fetch("/api/shop/" + path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Storefront-Request": "1",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      Array.isArray(result.message)
        ? result.message.join(", ")
        : result.message || "Request failed",
    );
  return result;
}
export const money = (value: number | string) =>
  new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT" }).format(
    Number(value),
  );
export type Quote = {
  items: {
    productId: string;
    variantId?: string;
    name: string;
    variantName?: string;
    quantity: number;
    slug: string;
    unitPrice: string;
    lineTotal: string;
  }[];
  subtotal: string;
  discount?: string;
  coupon?: {
    code: string;
    discount: string;
    description?: string | null;
  };
  shipping: string;
  tax: string;
  total: string;
  quoteToken: string;
  /** Shipping rate tiers returned by server for UI display. */
  shippingRates?: {
    insideDhaka: number;
    outsideDhaka: number;
    freeAbove: number;
  };
};
export type Shopper = {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
};
export type Order = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  createdAt: string;
  grandTotal: string;
  subtotal: string;
  discountTotal?: string;
  couponCode?: string;
  shippingTotal: string;
  taxTotal: string;
  customerName: string;
  customerPhone?: string;
  customerNote?: string | null;
  items: {
    nameSnapshot: string;
    skuSnapshot: string;
    variantSnapshot?: unknown;
    product?: { images: { url: string }[] } | null;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }[];
  addresses: {
    recipientName: string;
    phone?: string;
    line1: string;
    line2?: string;
    city: string;
    district?: string;
    postalCode?: string;
  }[];
  shipments: { provider?: string; trackingNumber?: string; status: string; shippedAt?: string | null; deliveredAt?: string | null }[];
};
export type Payments = {
  methods: { id: string; label: string; enabled: boolean }[];
  bank: {
    name: string;
    accountName: string;
    accountNumber: string;
    branch: string;
  } | null;
};
