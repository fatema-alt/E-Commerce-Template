import Link from "next/link";
import { money, type Order } from "../lib/shop-client";
import { statusLabel } from "./shopping-ui";

export function OrderSuccess({ order }: { order: Order }) {
  const submission = order.manualPayments?.[0];
  const pending = submission?.status === "awaiting_verification";
  const partial = order.paymentPlan === "PARTIAL_ADVANCE";
  const submitted = Number(submission?.amountDueNow || 0);
  const deliveryDue =
    order.amountDueOnDelivery ?? submission?.amountDueOnDelivery;
  const cancelled = ["CANCELLED", "RETURNED"].includes(order.status);
  const paid = Number(order.paidTotal || 0);
  const address = order.addresses?.[0];
  return (
    <section
      className="shop-panel order-success"
      aria-labelledby="order-success-title"
    >
      <span className="success-symbol" aria-hidden="true">
        {cancelled ? "—" : "✓"}
      </span>
      <p className="eyebrow">DS Mart · Order confirmation</p>
      <h1 id="order-success-title">
        {cancelled
          ? `Order ${statusLabel(order.status)}`
          : pending
            ? "Order Received – Payment Verification Pending"
            : "Order Placed Successfully!"}
      </h1>
      <p>
        {pending
          ? partial
            ? `Your advance of ${money(submitted)} has been submitted for verification. After verification, ${money(deliveryDue || 0)} will be payable on delivery.`
            : "Your payment reference has been received. We will confirm your payment after verifying the transfer."
          : cancelled
            ? "Review the current order details below."
            : "Thank you for shopping with us. Your current payment and delivery details are below."}
      </p>
      <dl className="success-facts">
        <div>
          <dt>Order ID</dt>
          <dd>{order.orderNumber || order.id}</dd>
        </div>
        <div>
          <dt>Order date</dt>
          <dd>
            {new Date(order.createdAt).toLocaleDateString("en-BD", {
              timeZone: "Asia/Dhaka",
              dateStyle: "medium",
            })}
          </dd>
        </div>
        <div>
          <dt>Payment method</dt>
          <dd>
            {submission?.methodSnapshot.name ||
              statusLabel(order.paymentMethod)}
          </dd>
        </div>
        <div>
          <dt>Payment status</dt>
          <dd>
            {pending
              ? "Awaiting Verification"
              : submission?.status === "rejected"
                ? "Verification rejected"
                : statusLabel(order.paymentStatus)}
          </dd>
        </div>
        <div>
          <dt>Order total</dt>
          <dd>{money(order.grandTotal)}</dd>
        </div>
        {pending && (
          <div>
            <dt>
              {partial
                ? "Advance submitted — verification pending"
                : "Payment submitted — verification pending"}
            </dt>
            <dd>{money(submitted)}</dd>
          </div>
        )}
        <div>
          <dt>Verified amount paid</dt>
          <dd>{money(paid)}</dd>
        </div>
        {pending ||
        ((partial || order.paymentPlan === "COD") &&
          submission?.status !== "rejected") ? (
          <div>
            <dt>
              {pending && partial
                ? "Pay on delivery — after advance verification"
                : "Pay on delivery"}
            </dt>
            <dd>{money(deliveryDue || 0)}</dd>
          </div>
        ) : (
          <div>
            <dt>Remaining balance</dt>
            <dd>{money(Math.max(0, Number(order.grandTotal) - paid))}</dd>
          </div>
        )}
        {pending && (
          <div>
            <dt>Submitted transaction reference</dt>
            <dd>{submission.reference}</dd>
          </div>
        )}
        {address && (
          <div>
            <dt>Delivery address</dt>
            <dd>
              {[
                address.recipientName,
                address.line1,
                address.line2,
                address.city,
                address.district,
                address.postalCode,
              ]
                .filter(Boolean)
                .join(", ")}
            </dd>
          </div>
        )}
      </dl>
      <div className="payment-categories">
        <Link
          className="primary-button"
          href={`/orders/${encodeURIComponent(order.id)}`}
        >
          Track Your Order
        </Link>
        <Link className="secondary-button" href="/shop">
          Continue Shopping
        </Link>
      </div>
    </section>
  );
}
