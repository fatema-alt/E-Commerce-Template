"use client";
import Link from "next/link";
import { useEffect } from "react";
export default function Page() {
  useEffect(() => {
    window.dispatchEvent(new Event("ds-open-cart"));
  }, []);
  return (
    <main id="main" className="container main-content">
      <h1>Your shopping bag</h1>
      <p>Your cart is available in the drawer.</p>
      <button
        className="primary-button"
        onClick={() => window.dispatchEvent(new Event("ds-open-cart"))}
      >
        Open shopping bag
      </button>{" "}
      <Link className="secondary-button" href="/shop">
        Continue Shopping
      </Link>
    </main>
  );
}
