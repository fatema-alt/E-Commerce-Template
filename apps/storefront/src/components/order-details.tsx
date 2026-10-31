import Link from "next/link";
import type { ReactNode } from "react";
import { money, type Order } from "../lib/shop-client";
import {
  SectionCard,
  PriceSummary,
  ProductThumbnail,
  StatusBadge,
  statusLabel,
} from "./shopping-ui";

export function OrderDetails({
  order,
  paymentAction,
}: {
  order: Order;
  paymentAction?: ReactNode;
}) {
  const reference =
    order.orderNumber && !/^[a-f\d]{8}-[a-f\d-]{27}$/i.test(order.orderNumber)
      ? order.orderNumber
      : `…${order.id.slice(-12).toUpperCase()}`;
  const events = [
    { label: "Order placed", date: order.createdAt },
    ...order.shipments.flatMap((shipment) => [
      ...(shipment.shippedAt
        ? [
            {
              label: shipment.provider
                ? `Shipped with ${shipment.provider}`
                : "Shipped",
              date: shipment.shippedAt,
            },
          ]
        : []),
      ...(shipment.deliveredAt
        ? [{ label: "Delivered", date: shipment.deliveredAt }]
        : []),
    ]),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const preparing = ["PENDING", "CONFIRMED", "PROCESSING"].includes(
    order.status,
  );
  const variantLabel = (value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.entries(value)
          .filter(
            ([, item]) => typeof item === "string" || typeof item === "number",
          )
          .map(([key, item]) => `${key}: ${item}`)
          .join(" · ")
      : "";
  return (
    <>
      <header className="order-heading">
        <div>
          <p className="order-reference" title={order.id}>
            Order {reference}
          </p>
          <p className="muted small">
            Placed{" "}
            <time dateTime={order.createdAt}>
              {new Date(order.createdAt).toLocaleDateString("en-BD", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </time>
          </p>
        </div>
        <div>
          <span className="small muted">Order status </span>
          <StatusBadge status={order.status} />
        </div>
      </header>
      <div className="checkout-grid order-details-grid">
        <div className="shopping-stack">
          <SectionCard title="Order Progress">
            <ol className="order-timeline">
              {events.map((event, i) => (
                <li key={`${event.label}:${event.date}:${i}`}>
                  <span className="timeline-dot" aria-hidden="true" />
                  <div>
                    <strong>{event.label}</strong>
                    <time dateTime={event.date}>
                      {new Date(event.date).toLocaleString("en-BD", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
            <p className="muted small">
              Current status: {statusLabel(order.status)}.{" "}
              {order.status === "CANCELLED"
                ? "This order has been cancelled."
                : order.status.startsWith("RETURN")
                  ? "Contact support for help with your return."
                  : events.length === 1
                    ? "Further tracking updates will appear when the store provides them."
                    : "Only recorded shipment updates are shown."}
            </p>
          </SectionCard>
          <SectionCard title="Items Ordered">
            <div className="ordered-products">
              {order.items.map((item, i) => (
                <article className="cart-line ordered-product" key={i}>
                  <ProductThumbnail
                    src={item.product?.images[0]?.url}
                    name={item.nameSnapshot}
                  />
                  <div className="cart-product-info">
                    <strong>{item.nameSnapshot}</strong>
                    <p className="muted small">SKU: {item.skuSnapshot}</p>
                    {variantLabel(item.variantSnapshot) && (
                      <p className="muted small">
                        {variantLabel(item.variantSnapshot)}
                      </p>
                    )}
                    <p className="muted small">
                      {money(item.unitPrice)} × {item.quantity}
                    </p>
                  </div>
                  <strong className="line-total">
                    {money(item.lineTotal)}
                  </strong>
                </article>
              ))}
            </div>
          </SectionCard>
          <SectionCard title="Delivery Address">
            {order.addresses.map((address, i) => (
              <address className="delivery-address" key={i}>
                <strong>{address.recipientName}</strong>
                {(address.phone || order.customerPhone) && (
                  <span>{address.phone || order.customerPhone}</span>
                )}
                <span>{address.line1}</span>
                {address.line2 && <span>{address.line2}</span>}
                <span>
                  {[address.city, address.district, address.postalCode]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </address>
            ))}
            {!order.addresses.length && (
              <p>Delivery address is not available. Please contact support.</p>
            )}
            {order.customerNote && (
              <p className="delivery-note">
                <strong>Delivery note</strong>
                <br />
                {order.customerNote}
              </p>
            )}
          </SectionCard>
        </div>
        <div className="shopping-stack">
          <SectionCard title="Payment Summary">
            <PriceSummary
              subtotal={order.subtotal}
              shipping={order.shippingTotal}
              tax={order.taxTotal}
              total={order.grandTotal}
              discount={order.discountTotal}
              coupon={order.couponCode}
            />
            <dl className="summary-details payment-details">
              <div>
                <dt>Payment method</dt>
                <dd>{statusLabel(order.paymentMethod)}</dd>
              </div>
              {order.paymentOption && (
                <div>
                  <dt>Payment option</dt>
                  <dd>{statusLabel(order.paymentOption)}</dd>
                </div>
              )}
              <div>
                <dt>Payment status</dt>
                <dd>
                  <StatusBadge status={order.paymentStatus} />
                </dd>
              </div>
              {order.paidTotal !== undefined && Number(order.paidTotal) > 0 && (
                <div>
                  <dt>Amount paid</dt>
                  <dd>{money(order.paidTotal)}</dd>
                </div>
              )}
              {order.amountDueOnDelivery !== undefined && (
                <div>
                  <dt>Amount due on delivery</dt>
                  <dd>
                    <strong>
                      {Number(order.amountDueOnDelivery) === 0
                        ? "BDT 0.00"
                        : money(order.amountDueOnDelivery)}
                    </strong>
                  </dd>
                </div>
              )}
            </dl>
            {paymentAction}
          </SectionCard>
          <SectionCard title="Shipment Tracking">
            {order.shipments.length ? (
              order.shipments.map((shipment, i) => (
                <dl className="shipment-details" key={i}>
                  <div>
                    <dt>Courier</dt>
                    <dd>{shipment.provider || "Not assigned"}</dd>
                  </div>
                  <div>
                    <dt>Shipment status</dt>
                    <dd>{statusLabel(shipment.status)}</dd>
                  </div>
                  <div>
                    <dt>Tracking number</dt>
                    <dd>{shipment.trackingNumber || "Not available yet"}</dd>
                  </div>
                </dl>
              ))
            ) : (
              <p className="muted">
                {preparing
                  ? "Your order is being prepared. Tracking information will appear when it becomes available."
                  : order.status === "CANCELLED"
                    ? "This order is cancelled."
                    : "No shipment tracking information is available. Contact support for an update."}
              </p>
            )}
          </SectionCard>
          <SectionCard title="Need Help With This Order?">
            <p className="muted small">
              Our team can help with payment, delivery and order questions.
            </p>
            <Link className="secondary-button" href="/contact">
              Contact Support
            </Link>
            <Link className="shopping-back" href="/orders">
              ← Back to Orders
            </Link>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
