"use client";
import { useState } from "react";
import { toProductHtml } from "@commerce/product-content";
import { money, shopRequest, type Order } from "../lib/shop-client";
import { SectionCard } from "./shopping-ui";

export function OrderPaymentReview({ order }: { order: Order }) {
  const [current, setCurrent] = useState(order);
  const [sender, setSender] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const claim = current.manualPayments?.[0];
  if (!claim) return null;
  const method = claim.methodSnapshot;
  return (
    <SectionCard
      title={
        claim.status === "awaiting_verification"
          ? "Awaiting Verification"
          : claim.status === "confirmed"
            ? "Payment verified"
            : "Payment rejected"
      }
    >
      <p>
        {method.name} · {money(claim.amountDueNow)} advance ·{" "}
        {money(claim.amountDueOnDelivery)} on delivery
      </p>
      <p>Reference: {claim.reference}</p>
      {claim.status === "awaiting_verification" && (
        <p>
          Your reference has been submitted. Our team will check the receipt
          before confirming payment.
        </p>
      )}
      {claim.rejectReason && <p role="alert">{claim.rejectReason}</p>}
      {claim.status === "rejected" &&
        !["CANCELLED", "RETURNED"].includes(current.status) &&
        current.paymentStatus !== "PAID" && (
          <>
            <dl>
              {Object.entries(method.details).map(([key, value]) => (
                <div key={key}>
                  <dt>{key.replace(/([A-Z])/g, " $1")}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div
              dangerouslySetInnerHTML={{
                __html: toProductHtml(method.instruction),
              }}
            />
            <form
              className="shopping-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                if (busy) return;
                setBusy(true);
                setError("");
                try {
                  const updated = await shopRequest<Order>(
                    `orders/${order.id}/manual-payment`,
                    { sender, reference },
                  );
                  setCurrent(updated);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                {method.type === "bank"
                  ? "Sender name / account"
                  : "Sender mobile number"}
                <input
                  name="sender"
                  required
                  value={sender}
                  minLength={3}
                  maxLength={120}
                  onChange={(e) => setSender(e.target.value)}
                />
              </label>
              <label>
                New transaction reference
                <input
                  name="reference"
                  required
                  value={reference}
                  minLength={3}
                  maxLength={100}
                  onChange={(e) => setReference(e.target.value)}
                />
              </label>
              <button className="primary-button" disabled={busy}>
                Resubmit payment reference
              </button>
              {error && (
                <p className="shop-error" role="alert">
                  {error}
                </p>
              )}
            </form>
          </>
        )}
    </SectionCard>
  );
}
