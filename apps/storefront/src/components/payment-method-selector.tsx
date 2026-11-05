"use client";

import { useState } from "react";
import Image from "next/image";
import type { CheckoutMethod } from "../lib/shop-client";

function PaymentBrand({ method }: { method: CheckoutMethod }) {
  const [failed, setFailed] = useState(false);
  return method.logo && !failed ? (
    <Image
      src={method.logo}
      alt=""
      width={88}
      height={40}
      unoptimized
      onError={() => setFailed(true)}
    />
  ) : (
    <strong className="payment-brand">{method.name}</strong>
  );
}

export function PaymentMethodSelector({
  methods,
  selectedId,
  category,
  onCategoryChange,
  onSelect,
}: {
  methods: CheckoutMethod[];
  selectedId: string;
  category: CheckoutMethod["type"];
  onCategoryChange: (category: CheckoutMethod["type"]) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="shopping-stack">
      <div className="payment-categories" aria-label="Payment categories">
        {(["mobile_banking", "bank"] as const)
          .filter((type) => methods.some((method) => method.type === type))
          .map((type) => (
            <button
              key={type}
              type="button"
              className="secondary-button"
              aria-pressed={category === type}
              onClick={() => onCategoryChange(type)}
            >
              {type === "bank" ? "Bank Transfer" : "Mobile Banking"}
            </button>
          ))}
      </div>
      <div
        className="payment-method-grid"
        role="radiogroup"
        aria-label="Payment method"
      >
        {methods
          .filter((method) => method.type === category)
          .map((method) => (
            <label
              key={method.id}
              className={`payment-method-card ${selectedId === method.id ? "is-selected" : ""}`}
            >
              <input
                type="radio"
                name="paymentMethodId"
                value={method.id}
                checked={selectedId === method.id}
                onChange={() => onSelect(method.id)}
                required
              />
              <PaymentBrand method={method} />
              <span>
                {method.name}
                <small>
                  {method.type === "bank"
                    ? "Transfer to the configured bank account"
                    : "Pay with your mobile banking app"}
                </small>
              </span>
            </label>
          ))}
      </div>
    </div>
  );
}
