"use client";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useCart } from "../lib/cart";
import type { Product } from "../lib/storefront";

export function ShoppingLinks() {
  const cart = useCart();
  return (
    <nav aria-label="Shopping" className="shopping-links">
      <Link href="/account">Account</Link>
      <Link href="/wishlist">Wishlist</Link>
      <Link href="/cart" aria-label={`Cart, ${cart.count} items`}>
        Cart <span className="cart-count">{cart.count}</span>
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
