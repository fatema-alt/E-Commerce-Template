import { Suspense } from "react";
import OrderDetailsClient from "./order-details-client";

export const instant = false;

export default function OrderDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-slate-500">
          Loading order details...
        </div>
      }
    >
      <OrderDetailsClient />
    </Suspense>
  );
}
