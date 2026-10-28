"use client";
import { useEffect, useState } from "react";
import { shopRequest, type Payments } from "../lib/shop-client";

export function PaymentOptionsNote() {
  const [codEnabled, setCodEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    shopRequest<Payments>("payment-methods")
      .then(payments => { if (active) setCodEnabled(payments.methods.some(method => method.id === "COD" && method.enabled)); })
      .catch(() => { /* Keep generic wording when settings cannot be loaded. */ });
    return () => { active = false; };
  }, []);
  return <p>Check available payment methods at checkout.{codEnabled && " Cash on Delivery is available at checkout."}</p>;
}
