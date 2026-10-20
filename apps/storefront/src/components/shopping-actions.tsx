"use client";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useCart } from "../lib/cart";
import type { Product } from "../lib/storefront";

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};
export function ShoppingLinks() {
  const cart = useCart();
  return (
    <nav aria-label="Shopping" className="shopping-links">
      <Link href="/account" aria-label="Account" title="Account">
        <svg {...iconProps}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
        </svg>
      </Link>
      <Link href="/wishlist" aria-label="Wishlist" title="Wishlist">
        <svg {...iconProps}>
          <path d="M12 20.5s-8-4.9-8-11A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5c0 6.1-8 11-8 11z" />
        </svg>
      </Link>
      <Link href="/cart" aria-label={`Cart, ${cart.count} items`} title="Cart">
        <svg {...iconProps}>
          <path d="M5 8h14l-1 12H6L5 8z" />
          <path d="M9 8V7a3 3 0 0 1 6 0v1" />
        </svg>
        {cart.count > 0 && <span className="cart-count">{cart.count}</span>}
      </Link>
    </nav>
  );
}
const wishlistKey = "commerce-wishlist-v1";
const wishlistEvent = "commerce-wishlist-change";
function wishlistSnapshot() {
  try {
    return localStorage.getItem(wishlistKey) || "[]";
  } catch {
    return "[]";
  }
}
function wishlistSubscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(wishlistEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(wishlistEvent, callback);
  };
}
export function WishlistButton({ product }: { product: Product }) {
  const [notice, setNotice] = useState("");
  const raw = useSyncExternalStore(
    wishlistSubscribe,
    wishlistSnapshot,
    () => "[]",
  );
  let saved = false;
  try {
    const value = JSON.parse(raw);
    saved = Array.isArray(value) && value.some((p) => p?.id === product.id);
  } catch {
    /* Corrupt storage is replaced on the next save. */
  }
  return (
    <>
      <button
        type="button"
        aria-pressed={saved}
        className="secondary-button"
        onClick={() => {
          try {
            let current: unknown;
            try {
              current = JSON.parse(localStorage.getItem(wishlistKey) || "[]");
            } catch {
              current = [];
            }
            const exists =
              Array.isArray(current) &&
              current.some((p) => p?.id === product.id);
            const items = Array.isArray(current)
              ? current
                  .filter(
                    (p) => p && typeof p.id === "string" && p.id !== product.id,
                  )
                  .slice(-99)
              : [];
            localStorage.setItem(
              wishlistKey,
              JSON.stringify(exists ? items : [...items, product]),
            );
            window.dispatchEvent(new Event(wishlistEvent));
            setNotice(exists ? "Removed from wishlist." : "Saved to wishlist.");
          } catch {
            setNotice("Unable to save on this browser.");
          }
        }}
      >
        {saved ? "♥ Saved to wishlist" : "♡ Save to wishlist"}
      </button>
      <span className="small" role="status">
        {notice}
      </span>
    </>
  );
}