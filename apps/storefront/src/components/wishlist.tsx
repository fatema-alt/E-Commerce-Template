"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Product } from "../lib/storefront";
import { ProductCard } from "./home-sections";
export function Wishlist() {
  const [items, setItems] = useState<Product[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        const value = JSON.parse(
          localStorage.getItem("commerce-wishlist-v1") || "[]",
        );
        if (Array.isArray(value))
          setItems(
            value
              .filter(
                (p) =>
                  p &&
                  typeof p.id === "string" &&
                  typeof p.name === "string" &&
                  typeof p.slug === "string" &&
                  typeof p.price === "number",
              )
              .slice(0, 100),
          );
      } catch {
        setError("Wishlist storage is unavailable.");
      }
    });
  }, []);
  return (
    <main id="main" className="container main-content">
      <h1>Your wishlist</h1>
      <p className="muted">
        Saved on this browser. Current prices and availability are confirmed on
        the product page.
      </p>
      {error && (
        <p role="alert" className="shop-error">
          {error}
        </p>
      )}
      {items.length ? (
        <div className="products-grid">
          {items.map((product) => (
            <div key={product.id}>
              <ProductCard product={product} />
              <button
                className="text-button"
                onClick={() => {
                  try {
                    const next = items.filter((p) => p.id !== product.id);
                    localStorage.setItem(
                      "commerce-wishlist-v1",
                      JSON.stringify(next),
                    );
                    setItems(next);
                  } catch {
                    setError("Unable to update wishlist.");
                  }
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-content">
          <p>No saved products yet.</p>
          <Link href="/shop" className="primary-button">
            Explore products
          </Link>
        </div>
      )}
    </main>
  );
}
