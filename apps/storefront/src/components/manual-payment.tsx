"use client";
import { useRef, useState } from "react";
import { money, shopRequest, type Order } from "../lib/shop-client";
import { SectionCard } from "./shopping-ui";

export function ManualPayment({ order }: { order: Order }) {
  const [details, setDetails] = useState(order.manualPayment);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const lock = useRef(false);
  if (
    !order.manualPayment && !['MANUAL', 'BANK_TRANSFER'].includes(order.paymentMethod) && !(order.paymentOption === 'OPTION_A' && order.paymentMethod === 'COD') && !["MANUAL_BKASH", "MANUAL_NAGAD", "BANK_TRANSFER"].includes(
      order.paymentOption || "",
    )
  )
    return null;
  const closed = ["CANCELLED", "RETURNED"].includes(order.status);
  const due = Math.max(
    0,
    Number(details?.amountDue ?? ((order.paymentOption === 'OPTION_A' ? Number(order.shippingTotal) : Number(order.grandTotal)) - Number(order.paidTotal || 0))),
  );
  const pending =
    details?.submissions.some((item) => item.status === "PENDING") || submitted;
  return (
    <SectionCard title="Manual payment">
      {closed ? (
        <p>
          This order is closed. Contact our team about any transfer already
          sent.
        </p>
      ) : due === 0 || order.paymentStatus === "PAID" ? (
        <p>{order.paymentOption === 'OPTION_A' ? `Delivery payment verified. Remaining ${money(order.amountDueOnDelivery || 0)} is due on delivery.` : 'Payment received. No transfer is needed.'}</p>
      ) : !details ? (
        <p>
          Payment instructions are unavailable. Contact our team before
          transferring.
        </p>
      ) : (
        <>
          <p>
            <strong>{details.account.label}</strong> — amount to transfer:{" "}
            <strong>{money(due)}</strong>
          </p>
          <dl className="shopping-stack" style={{ overflowWrap: "anywhere" }}>
            {details.account.bankName && (
              <div>
                <dt>Bank</dt>
                <dd>
                  {details.account.bankName}
                  {details.account.branch ? ` · ${details.account.branch}` : ""}
                </dd>
              </div>
            )}
            <div>
              <dt>Recipient</dt>
              <dd>{details.account.accountName}</dd>
            </div>
            <div>
              <dt>
                {details.account.bankName
                  ? "Account number"
                  : "Recipient number"}
              </dt>
              <dd>
                <strong>{details.account.accountNumber}</strong>
              </dd>
            </div>
            {!details.account.bankName && (
              <div>
                <dt>Transfer type</dt>
                <dd>
                  {details.account.accountType === "merchant"
                    ? "Payment (merchant account)"
                    : "Send Money (personal account)"}
                </dd>
              </div>
            )}
          </dl>
          {details.account.instructions && (
            <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {details.account.instructions}
            </p>
          )}
          <p className="small muted">
            Check the recipient name and number in your banking app before
            confirming. Submit the completed transaction reference below. Never
            share a PIN, password or OTP.
          </p>
          {pending ? (
            <p role="status">
              Transaction submitted — awaiting verification. This is not a
              payment confirmation.
            </p>
          ) : (
            <form
              className="shopping-stack"
              onSubmit={async (event) => {
                event.preventDefault();
                if (lock.current) return;
                const form = event.currentTarget;
                const values = new FormData(form);
                lock.current = true;
                setBusy(true);
                setError("");
                try {
                  await shopRequest(`orders/${order.id}/manual-payment`, {
                    sender: String(values.get("sender") || ""),
                    reference: String(values.get("reference") || ""),
                  });
                  setSubmitted(true);
                  const updated = await shopRequest<Order>(
                    `orders/${order.id}`,
                  );
                  setDetails(updated.manualPayment);
                } catch (reason) {
                  setError(
                    reason instanceof Error
                      ? reason.message
                      : "Could not submit. Try again.",
                  );
                } finally {
                  lock.current = false;
                  setBusy(false);
                }
              }}
            >
              <label>
                Sender mobile/account identifier
                <input
                  name="sender"
                  required
                  minLength={3}
                  maxLength={120}
                  autoComplete="off"
                  disabled={busy}
                />
              </label>
              <label>
                Transaction ID / bank reference
                <input
                  name="reference"
                  required
                  minLength={3}
                  maxLength={100}
                  pattern="[A-Za-z0-9][A-Za-z0-9 \-]{2,99}"
                  autoComplete="off"
                  disabled={busy}
                />
              </label>
              <button className="primary-button" type="submit" disabled={busy}>
                {busy ? "Submitting…" : "Submit transaction for verification"}
              </button>
            </form>
          )}
          {error && (
            <p className="shop-error" role="alert">
              {error}
            </p>
          )}
          {!!details.submissions.length && (
            <ul className="shopping-stack">
              {details.submissions.map((item) => (
                <li key={item.id} style={{ overflowWrap: "anywhere" }}>
                  {item.reference} · {money(item.amount)} ·{" "}
                  {item.status === "SUCCEEDED"
                    ? "Verified"
                    : item.status === "PENDING"
                      ? "Awaiting verification"
                      : "Not verified"}
                  {item.rejectionReason && <p>{item.rejectionReason}</p>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </SectionCard>
  );
}
