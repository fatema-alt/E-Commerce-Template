"use client";

import { useEffect, useState } from "react";
import { repairSimpleCart } from "../lib/cart";
import type { Product } from "../lib/storefront";
import { getTrackingItemId, trackViewItem } from "../lib/gtm";
import { ProductGallery } from "./product-gallery";
import { ProductReviewRating } from "./product-feedback";
import { ProductPurchase } from "./product-purchase";

export function ProductOverview({ product }: { product: Product }) {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".site-header");
    const page = document.querySelector<HTMLElement>("main.pp");
    if (!header || !page) return;
    const update = () => {
      page.style.setProperty("--pp-top", `${Math.ceil(header.getBoundingClientRect().height) + 12}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => {
      observer.disconnect();
      page.style.removeProperty("--pp-top");
    };
  }, []);

  useEffect(() => {
    try {
      repairSimpleCart(product);
    } catch {
      /* Cart controls surface storage errors on interaction. */
    }
  }, [product]);

  const variants = product.variants || [];
  const [variantId, setVariant] = useState(
    () =>
      variants.find((v) => v.isDefault && v.availableStock > 0)?.id ||
      (variants.length === 1 && variants[0].availableStock > 0
        ? variants[0].id
        : ""),
  );

  useEffect(() => {
    try {
      const activeVariant = variants.find((v) => v.id === variantId);
      const itemId = getTrackingItemId({
        sku: activeVariant?.sku || product.sku,
        productId: product.id,
        id: activeVariant?.id,
      });
      trackViewItem({
        item: {
          item_id: itemId,
          item_name: product.name,
          price: activeVariant?.price ?? product.price,
          quantity: 1,
          item_brand: product.brand || "DS Mart",
          item_category: product.category?.name || "General",
          item_variant: activeVariant?.name || undefined,
          currency: "BDT",
        },
      });
    } catch {
      // Non-blocking
    }
  }, [product.id, variantId]);

  const images = product.images || [];
  const matching = images.filter((image) => image.variantId === variantId);
  const gallery = matching.length
    ? [...matching, ...images.filter((image) => !image.variantId)]
    : images;

  return (
    <div className="pp-hero">
      <div className="pp-stage">
        <ProductGallery key={variantId} images={gallery} name={product.name} />
      </div>

      <section className="pp-info" aria-labelledby="product-title">
        <p className="pp-kicker">
          <span className="pp-dot" aria-hidden="true" />
          {product.brand || "DS Mart"}
          {product.category && <span>in {product.category.name}</span>}
        </p>
        <h1 id="product-title">{product.name}</h1>
        <ProductReviewRating />
        {product.shortDescription && (
          <p className="pdp-intro">{product.shortDescription}</p>
        )}
        <ProductPurchase
          product={product}
          variantId={variantId}
          onVariantChange={setVariant}
        />
      </section>
    </div>
  );
}
