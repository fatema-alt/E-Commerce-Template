"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { money } from "../lib/shop-client";
import { imageUrl } from "../lib/storefront";

export function SectionCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`shop-panel ${className}`}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function ProductThumbnail({
  src,
  name,
  href,
}: {
  src?: string | null;
  name: string;
  href?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const resolvedSrc = imageUrl(src);
  // Catalog media can come from merchant-configured origins; keep the existing
  // direct-media behavior while reserving dimensions with Next Image.
  const image =
    resolvedSrc &&
    failed !== resolvedSrc &&
    /^(https?:\/\/|\/(?!\/))/.test(resolvedSrc) ? (
      <Image
        src={resolvedSrc}
        alt={name}
        width={112}
        height={112}
        className="cart-thumbnail"
        unoptimized
        onError={() => setFailed(resolvedSrc)}
      />
    ) : (
      <span
        className="image-unavailable"
        aria-label="Product image unavailable"
      >
        <svg
          width="30"
          height="30"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M5 7h14v14H5zM9 7V5a3 3 0 0 1 6 0v2" />
        </svg>
      </span>
    );
  return href ? (
    <Link className="cart-image-link" href={href} aria-label={`View ${name}`}>
      {image}
    </Link>
  ) : (
    <div className="cart-image-link">{image}</div>
  );
}

export function PriceSummary({
  subtotal,
  shipping,
  tax,
  total,
  discount,
  coupon,
  onlinePaymentDiscount,
  couponDiscount,
  shippingPending = false,
  totalLabel,
}: {
  subtotal: string;
  shipping: string;
  tax: string;
  total: string;
  discount?: string;
  coupon?: string;
  onlinePaymentDiscount?: string;
  couponDiscount?: string;
  shippingPending?: boolean;
  totalLabel?: string;
}) {
  return (
    <dl className="summary-details">
      <div>
        <dt>Subtotal</dt>
        <dd>{money(subtotal)}</dd>
      </div>
      {Number(couponDiscount ?? discount) > 0 && (
        <div className="summary-discount">
          <dt>Discount{coupon ? ` (${coupon})` : ""}</dt>
          <dd>−{money(couponDiscount ?? discount!)}</dd>
        </div>
      )}
      {Number(onlinePaymentDiscount) > 0 && (
        <div className="summary-discount">
          <dt>Full Payment discount</dt>
          <dd>−{money(onlinePaymentDiscount!)}</dd>
        </div>
      )}
      <div>
        <dt>Delivery</dt>
        <dd>
          {shippingPending
            ? "Select delivery area"
            : Number(shipping) === 0
              ? "Free"
              : money(shipping)}
        </dd>
      </div>
      <div>
        <dt>Tax</dt>
        <dd>{money(tax)}</dd>
      </div>
      <div className="summary-total">
        <dt>{totalLabel || "Grand total"}</dt>
        <dd>
          {money(shippingPending ? Number(total) - Number(shipping) : total)}
        </dd>
      </div>
    </dl>
  );
}

const labels: Record<string, string> = {
  COD: "Cash on Delivery",
  BKASH: "bKash",
  SSLCOMMERZ: "SSLCommerz",
  BANK_TRANSFER: "Bank Transfer",
  OPTION_A: "Pay delivery charge now, rest on delivery",
  OPTION_B: "Pay full amount",
  OPTION_C: "Pay full amount with configured discount",
  RETURN_REQUESTED: "Return requested",
  RETURN_APPROVED: "Return approved",
  PARTIALLY_PAID: "Partially paid",
  PARTIALLY_REFUNDED: "Partially refunded",
};
export function statusLabel(value: string) {
  return (
    labels[value] ||
    value
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/^./, (letter) => letter.toUpperCase())
  );
}
export function StatusBadge({ status }: { status: string }) {
  const tone = ["PAID", "DELIVERED"].includes(status)
    ? "positive"
    : ["CANCELLED", "RETURNED", "REFUNDED"].includes(status)
      ? "neutral"
      : "pending";
  return (
    <span className={`status-badge status-${tone}`}>{statusLabel(status)}</span>
  );
}
