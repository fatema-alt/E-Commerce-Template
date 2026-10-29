"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type MouseEvent } from "react";
import type { Product } from "../lib/storefront";
import { useCart } from "../lib/cart";
import { getTrackingItemId, trackAddToCart } from "../lib/gtm";

const money = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  maximumFractionDigits: 2,
});

const slug = (value: string) => encodeURIComponent(value);

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

function SafeProductImage({ src, alt }: { src?: string | null; alt: string }) {
  if (src && /^(https?:\/\/|\/)/i.test(src)) {
    return (
      <img
        className="product-image"
        src={src}
        alt={alt}
        loading="lazy"
      />
    );
  }
  return (
    <div className="image-placeholder" aria-hidden="true">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </svg>
    </div>
  );
}

export function ProductCard({
  product,
  compact = false,
}: {
  product: Product;
  compact?: boolean;
}) {
  const cart = useCart();
  const [adding, setAdding] = useState(false);
  const [addedNotice, setAddedNotice] = useState(false);
  const [cartError, setCartError] = useState("");

  const rawWishlist = useSyncExternalStore(
    wishlistSubscribe,
    wishlistSnapshot,
    () => "[]",
  );

  let isWishlisted = false;
  try {
    const list = JSON.parse(rawWishlist);
    isWishlisted = Array.isArray(list) && list.some((p) => p?.id === product.id);
  } catch {
    // Corrupt storage will be recovered on next write
  }

  const handleToggleWishlist = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      let current: Product[] = [];
      try {
        current = JSON.parse(localStorage.getItem(wishlistKey) || "[]");
        if (!Array.isArray(current)) current = [];
      } catch {
        current = [];
      }
      const exists = current.some((p) => p.id === product.id);
      const next = exists
        ? current.filter((p) => p.id !== product.id)
        : [...current, product];
      localStorage.setItem(wishlistKey, JSON.stringify(next));
      window.dispatchEvent(new Event(wishlistEvent));
    } catch {
      // Storage unavailable
    }
  };

  const handleQuickAddToCart = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.inStock || product.availableStock <= 0) return;

    setAdding(true);
    setCartError("");

    try {
      // If variable product without default variant, route to detail page
      if (product.type === "VARIABLE" && (!product.variants || product.variants.length > 1)) {
        window.location.href = `/product/${slug(product.slug)}`;
        return;
      }

      const defaultVariant = product.variants?.[0];
      cart.add(
        {
          productId: product.id,
          variantId: defaultVariant?.id,
          slug: product.slug,
          name: product.name,
          variantName: defaultVariant?.name,
          quantity: 1,
          price: defaultVariant?.price ?? product.price,
          imageUrl: product.imageUrl,
          sku: defaultVariant?.sku || product.sku,
        },
        product.availableStock,
      );

      setAddedNotice(true);
      setTimeout(() => setAddedNotice(false), 2000);

      try {
        const itemId = getTrackingItemId({
          sku: defaultVariant?.sku || product.sku,
          productId: product.id,
          id: defaultVariant?.id,
        });
        trackAddToCart({
          items: [
            {
              item_id: itemId,
              item_name: product.name,
              price: defaultVariant?.price ?? product.price,
              quantity: 1,
              item_brand: product.brand || "DS Mart",
              item_category: product.category?.name || "General",
              item_variant: defaultVariant?.name || undefined,
              currency: "BDT",
            },
          ],
        });
      } catch {
        // Safe push wrapper
      }
    } catch (err) {
      setCartError((err as Error).message);
      setTimeout(() => setCartError(""), 3500);
    } finally {
      setAdding(false);
    }
  };

  // Pricing & Discounts
  const hasDiscount =
    typeof product.compareAtPrice === "number" &&
    product.compareAtPrice > product.price;

  const discountPercent = hasDiscount
    ? Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)
    : 0;


  return (
    <article className={`product-card ${compact ? "product-card-compact" : ""}`}>
      {/* Visual Image Wrap with Badges & Wishlist Action */}
      <div className="product-image-container">
        <Link
          href={`/product/${slug(product.slug)}`}
          className="product-image-wrap"
          aria-label={product.name}
        >
          <SafeProductImage src={product.imageUrl} alt={product.name} />
        </Link>

        {/* Floating Badges (Top-Left) */}
        <div className="product-card-badges">
          {hasDiscount && discountPercent > 0 && (
            <span className="card-badge badge-sale">
              -{discountPercent}%
            </span>
          )}
          {!product.inStock && (
            <span className="card-badge badge-out">
              Out of Stock
            </span>
          )}
        </div>

        {/* Floating Wishlist Button (Top-Right) */}
        <button
          type="button"
          onClick={handleToggleWishlist}
          aria-label={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
          className={`card-wishlist-btn ${isWishlisted ? "active" : ""}`}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill={isWishlisted ? "#ef4444" : "none"}
            stroke={isWishlisted ? "#ef4444" : "currentColor"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
        </button>

        {/* Quick Add To Cart Floating Button (Bottom Center of Image) */}
        {product.inStock && (
          <div className="card-quick-add-wrap">
            <button
              type="button"
              disabled={adding}
              onClick={handleQuickAddToCart}
              className={`card-quick-add-btn ${addedNotice ? "success" : ""}`}
            >
              {addedNotice ? (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Added to Cart!</span>
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8" cy="21" r="1" />
                    <circle cx="19" cy="21" r="1" />
                    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                  </svg>
                  <span>Quick Add</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Product Information Body */}
      <div className="product-body">
        {product.brand ? (
          <span className="product-brand">{product.brand}</span>
        ) : null}

        <Link
          className="product-name"
          href={`/product/${slug(product.slug)}`}
          title={product.name}
        >
          {product.name}
        </Link>

        {/* Price Row */}
        <div className="price-row">
          <strong className="current-price">{money.format(product.price)}</strong>
          {hasDiscount && discountPercent > 0 && (
            <del className="compare-price">{money.format(product.compareAtPrice!)}</del>
          )}
        </div>

        {/* Stock / Availability Indicator */}
        <div className="product-card-footer">
          <span className={`stock-indicator ${product.inStock ? "in-stock" : "out-of-stock"}`}>
            <span className="stock-dot" />
            {product.inStock ? "In Stock" : "Unavailable"}
          </span>

          {cartError && (
            <p className="card-cart-error" role="alert">
              {cartError}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
