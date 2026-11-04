"use client";

import { useState } from "react";
import { shopRequest, type Order } from "../lib/shop-client";

export function GatewayPayment({ order }: { order: Order }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="shopping-stack" style={{ margin: "1rem 0" }}>
      <p>
        Complete your payment with{" "}
        {order.paymentMethod === "BKASH" ? "bKash" : "SSLCommerz"}.
      </p>
      <button
        type="button"
        className="primary-button"
        disabled={busy}
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            const result = await shopRequest<{ redirectUrl: string }>(
              `orders/${order.id}/gateway-payment`,
              { gateway: order.paymentMethod },
            );
            window.location.assign(result.redirectUrl);
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        {busy ? "Opening payment..." : "Continue to payment"}
      </button>
      {error && (
        <p className="shop-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
