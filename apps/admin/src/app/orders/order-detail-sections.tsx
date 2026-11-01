"use client";
import type { ReactNode } from "react";
import {
  Activity,
  CreditCard,
  FileJson,
  Globe2,
  Laptop,
  Package,
  ShieldCheck,
} from "lucide-react";
import { formatDate, formatMoney, type OrderDetail } from "./orders-client";

export const readable = (value?: string | null) =>
  value
    ? value
        .toLowerCase()
        .replaceAll("_", " ")
        .replace(/^./, (c) => c.toUpperCase())
    : "Not recorded";
export function OrderCard({
  title,
  icon,
  aside,
  children,
  className = "",
}: {
  title: string;
  icon?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`od-card ${className}`}>
      <div className="od-card-heading">
        <h2>
          {icon && <span className="od-card-icon">{icon}</span>}
          {title}
        </h2>
        {aside}
      </div>
      <div className="od-card-body">{children}</div>
    </section>
  );
}
export function OrderBadge({
  value,
  children,
}: {
  value: string;
  children?: ReactNode;
}) {
  const status = value.toUpperCase();
  const tone = ["PAID", "CONFIRMED", "DELIVERED", "SUCCEEDED"].includes(status)
    ? "success"
    : ["REJECTED", "FAILED", "CANCELLED", "UNPAID"].includes(status)
      ? "danger"
      : ["PENDING", "AWAITING_VERIFICATION", "PARTIALLY_PAID"].includes(status)
        ? "warning"
        : "neutral";
  return (
    <span className={`od-badge od-badge-${tone}`}>
      {children || readable(value)}
    </span>
  );
}
export function InfoRows({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="od-info">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value ?? <span className="od-muted">Not recorded</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
export function JsonDetails({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  return (
    <details className="od-json">
      <summary>{label}</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}
const planLabels: Record<string, string> = {
  FULL_PAYMENT: "Full Payment",
  PARTIAL_ADVANCE: "Partial Advance + COD",
  COD: "Cash on Delivery",
  OPTION_A: "Delivery advance + COD",
  OPTION_B: "Full Payment",
  OPTION_C: "Full Payment with discount",
};
export const orderPlanLabel = (order: OrderDetail) =>
  planLabels[order.paymentPlan || order.paymentOption || order.paymentMethod] ||
  readable(order.paymentOption || order.paymentMethod);
export const orderMethodLabel = (order: OrderDetail) =>
  order.manualPayments?.[0]?.methodSnapshot.name ||
  readable(order.paymentMethod);

export function OrderItems({ order }: { order: OrderDetail }) {
  const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const storefront = (
    process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000"
  ).replace(/\/$/, "");
  const apiOrigin = (
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1"
  ).replace(/\/api\/v1\/?$/, "");
  return (
    <OrderCard
      title="Order items"
      icon={<Package size={17} />}
      aside={
        <span className="od-muted od-small">
          {order.items.length} lines / {units} units
        </span>
      }
    >
      <div className="od-items">
        {order.items.map((item) => (
          <div className="od-item" key={item.id}>
            <div className="od-item-image">
              {item.product?.images[0] ? (
                <img
                  src={
                    item.product.images[0].url.startsWith("/uploads/")
                      ? apiOrigin + item.product.images[0].url
                      : item.product.images[0].url
                  }
                  alt={item.product.images[0].altText || item.nameSnapshot}
                />
              ) : (
                <Package size={24} />
              )}
            </div>
            <div className="od-item-copy">
              <h3>{item.nameSnapshot}</h3>
              <p>
                {item.skuSnapshot}
                {item.product?.category && ` / ${item.product.category.name}`}
              </p>
              {item.product?.slug && (
                <a
                  href={`${storefront}/product/${encodeURIComponent(item.product.slug)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on store ↗
                </a>
              )}
              <p>
                {formatMoney(item.unitPrice)} × {item.quantity}
              </p>
            </div>
            <strong className="od-item-price">
              {formatMoney(item.lineTotal)}
            </strong>
          </div>
        ))}
      </div>
      <div className="od-totals">
        {(
          [
            ["Subtotal", order.subtotal],
            ["Coupon discount", order.couponDiscount],
            ["Full Payment discount", order.prepaidDiscount],
            ...(!order.couponDiscount && !order.prepaidDiscount
              ? [["Discount", order.discountTotal]]
              : []),
            ["Delivery", order.shippingTotal],
            ["Tax", order.taxTotal],
          ] as Array<[string, string | number | undefined]>
        )
          .filter(
            ([label, value]) =>
              (!label.includes("discount") && label !== "Discount") ||
              Number(value || 0) > 0,
          )
          .map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>
                {label.toLowerCase().includes("discount") ? "−" : ""}
                {formatMoney(value)}
              </strong>
            </div>
          ))}
        <div className="od-grand-total">
          <span>Grand total</span>
          <strong>{formatMoney(order.grandTotal)}</strong>
        </div>
      </div>
    </OrderCard>
  );
}

export function PaymentOverview({ order }: { order: OrderDetail }) {
  const latest = order.manualPayments?.[0];
  const legacy = order.payments.find(
    (p) => p.metadata?.verification === "CUSTOMER_CLAIM_PENDING",
  );
  const ledger = order.payments.filter(
    (p) =>
      !order.manualPayments?.some(
        (claim) =>
          claim.id === p.metadata?.manualPaymentId ||
          claim.id === p.providerReference,
      ),
  );
  return (
    <OrderCard
      title="Payment"
      icon={<CreditCard size={17} />}
      aside={<OrderBadge value={order.paymentStatus} />}
    >
      <InfoRows
        rows={[
          ["Payment method", orderMethodLabel(order)],
          ["Payment plan", orderPlanLabel(order)],
          [
            "Advance status",
            <OrderBadge
              key="advance"
              value={
                latest?.status ||
                (order.paymentMethod === "COD"
                  ? "No advance"
                  : legacy?.status || order.paymentStatus)
              }
            />,
          ],
          [
            "Transaction reference",
            latest?.reference || legacy?.providerReference || "Not submitted",
          ],
          [
            "Sender number / account",
            latest?.senderInfo || legacy?.metadata?.sender || "Not submitted",
          ],
          [
            "Amount expected",
            formatMoney(latest?.amountDueNow || order.grandTotal),
          ],
          ["Verified by", latest?.verifiedBy || "Not verified"],
          [
            "Verified at",
            latest?.verifiedAt ? formatDate(latest.verifiedAt) : "Not verified",
          ],
        ]}
      />
      {latest?.rejectReason && (
        <p className="od-notice od-notice-danger">{latest.rejectReason}</p>
      )}
      <div className="od-payment-split">
        <div>
          <span>Pay now</span>
          <strong>
            {formatMoney(
              order.amountDueNow ??
                (latest?.status === "confirmed" ? 0 : latest?.amountDueNow),
            )}
          </strong>
        </div>
        <div>
          <span>On delivery</span>
          <strong>{formatMoney(order.amountDueOnDelivery)}</strong>
        </div>
      </div>
      <div className="od-table-wrap">
        <table className="od-table">
          <thead>
            <tr>
              <th>Method / entry</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Reference</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {order.manualPayments?.map((claim) => (
              <tr key={claim.id}>
                <td>
                  {claim.methodSnapshot.name}
                  <small>Customer submission</small>
                </td>
                <td>
                  <OrderBadge value={claim.status} />
                </td>
                <td>{formatMoney(claim.amountDueNow)}</td>
                <td className="od-mono">{claim.reference}</td>
                <td>
                  {claim.verifiedAt || claim.createdAt
                    ? formatDate(claim.verifiedAt || claim.createdAt!)
                    : "Not recorded"}
                </td>
              </tr>
            ))}
            {ledger.map((payment) => (
              <tr key={payment.id}>
                <td>
                  {readable(payment.provider)}
                  <small>{readable(payment.type)}</small>
                </td>
                <td>
                  <OrderBadge value={payment.status} />
                </td>
                <td>{formatMoney(payment.amount)}</td>
                <td className="od-mono">{payment.providerReference || "—"}</td>
                <td>{formatDate(payment.createdAt)}</td>
              </tr>
            ))}
            {!order.manualPayments?.length && !ledger.length && (
              <tr>
                <td colSpan={5} className="od-empty">
                  No payment submissions or accounting entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </OrderCard>
  );
}

export function OrderTimeline({ order }: { order: OrderDetail }) {
  return (
    <OrderCard
      title="Order timeline"
      icon={<Activity size={17} />}
      aside={<span className="od-muted od-small">Oldest first</span>}
    >
      <ol className="od-timeline">
        {[...order.events]
          .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
          .map((event) => (
            <li key={event.id}>
              <span className="od-timeline-dot" />
              <div>
                <h3>{readable(event.action)}</h3>
                <p>
                  {formatDate(event.createdAt)} · {readable(event.actorType)}
                  {event.actorId ? ` / ${event.actorId}` : ""}
                </p>
                {(event.before != null || event.after != null) && (
                  <JsonDetails
                    label="Event details"
                    value={{ before: event.before, after: event.after }}
                  />
                )}
              </div>
            </li>
          ))}
      </ol>
      {!order.events.length && (
        <p className="od-empty">No timeline events recorded.</p>
      )}
    </OrderCard>
  );
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function text(...values: unknown[]): string | undefined {
  return values.find((value) => typeof value === "string" && value.trim()) as
    string | undefined;
}
export function OrderInsights({ order }: { order: OrderDetail }) {
  const campaign = record(order.campaign),
    tracking = record(campaign.tracking),
    device = record(campaign.device),
    utm = record(campaign.utm);
  const get = (key: string) => text(campaign[key], tracking[key], utm[key]);
  const source = get("utm_source") || text(campaign.source);
  const trackingEvents = order.events.filter((event) =>
    /TRACKING|PURCHASE_EVENT/.test(event.action),
  );
  return (
    <div className="od-insights-grid">
      <OrderCard
        title="Where this order came from"
        icon={<Globe2 size={17} />}
        aside={<OrderBadge value={source ? "Captured" : "Not recorded"} />}
      >
        <div className="od-source">
          <strong>
            {source ||
              (order.source ? readable(order.source) : "Source not recorded")}
          </strong>
          <p>
            {source
              ? "Attribution saved with this order"
              : "Detailed traffic attribution was not captured for this order."}
          </p>
        </div>
        <InfoRows
          rows={[
            ["Landing page", get("landingPage") || get("landing_page")],
            ["Referrer", get("referrer")],
          ]}
        />
        <div className="od-table-wrap">
          <table className="od-table">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Last touch (credited)</th>
              </tr>
            </thead>
            <tbody>
              {[
                "utm_source",
                "utm_medium",
                "utm_campaign",
                "utm_term",
                "utm_content",
                "fbclid",
                "gclid",
                "ttclid",
              ].map((key) => (
                <tr key={key}>
                  <td className="od-mono">{key}</td>
                  <td className="od-mono">{get(key) || "Not recorded"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </OrderCard>
      <div className="od-stack">
        <OrderCard
          title="OTP verification"
          icon={<ShieldCheck size={17} />}
          aside={<OrderBadge value="Not enabled" />}
        >
          <p className="od-empty">
            OTP verification is not enabled for this store. No verification
            record is available.
          </p>
        </OrderCard>
        <OrderCard
          title="Tracking events"
          icon={<Activity size={17} />}
          aside={
            <OrderBadge
              value={
                trackingEvents.length
                  ? `${trackingEvents.length} recorded`
                  : "No events"
              }
            />
          }
        >
          {trackingEvents.length ? (
            trackingEvents.map((event) => (
              <div key={event.id}>
                <strong>{readable(event.action)}</strong>
                <p className="od-muted od-small">
                  {formatDate(event.createdAt)}
                </p>
                <JsonDetails label="Event data" value={event.after} />
              </div>
            ))
          ) : (
            <p className="od-empty">
              No server-side purchase or tracking events were recorded for this
              order.
            </p>
          )}
        </OrderCard>
      </div>
      <OrderCard title="Device & technical" icon={<Laptop size={17} />}>
        <InfoRows
          rows={[
            ["Device", text(device.type, campaign.deviceType)],
            ["Operating system", text(device.os, campaign.os)],
            ["Browser", text(device.browser, campaign.browser)],
            ["IP address", get("ipAddress") || get("ip")],
            ["Facebook _fbp", get("_fbp")],
            ["Facebook _fbc", get("_fbc")],
            ["GA4 client ID", get("gaClientId") || get("ga4ClientId")],
            ["Visitor ID (hashed)", get("visitorId")],
            [
              "Idempotency key",
              order.idempotencyKeys?.[0]?.key || get("idempotencyKey"),
            ],
            [
              "Last updated",
              order.updatedAt ? formatDate(order.updatedAt) : undefined,
            ],
          ]}
        />
        <JsonDetails
          label="Full user agent"
          value={text(device.userAgent, campaign.userAgent) || "Not recorded"}
        />
      </OrderCard>
      <OrderCard title="Raw data" icon={<FileJson size={17} />}>
        <p className="od-empty">Read-only snapshots retained with the order.</p>
        <JsonDetails label="Shipping snapshot (JSON)" value={order.addresses} />
        <JsonDetails
          label="Payment method snapshots (JSON)"
          value={
            order.manualPayments?.map((payment) => ({
              id: payment.id,
              method: payment.methodSnapshot,
            })) || []
          }
        />
        <JsonDetails
          label="Attribution snapshot (JSON)"
          value={order.campaign || null}
        />
      </OrderCard>
    </div>
  );
}
