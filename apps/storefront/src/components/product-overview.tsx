"use client";

import { useEffect, useState } from "react";
import { repairSimpleCart } from "../lib/cart";
import type { Product } from "../lib/storefront";
import { ProductGallery } from "./product-gallery";
import { ProductReviewRating } from "./product-feedback";
import { ProductPurchase } from "./product-purchase";

export function ProductOverview({ product }: { product: Product }) {
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

  const images = product.images || [];
  const matching = images.filter((image) => image.variantId === variantId);
  const gallery = matching.length
    ? [...matching, ...images.filter((image) => !image.variantId)]
    : images;

  return (
    <div className="product-detail-grid pdp-overview w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[52%_48%] gap-8 xl:gap-12 items-start pt-2 pb-8">
      {/* 1. Left Column: 52% — Product Image Gallery */}
      <div className="pdp-gallery-column w-full lg:sticky lg:top-24">
        <ProductGallery key={variantId} images={gallery} name={product.name} />
      </div>

      {/* 2. Right Column: 48% — Product Information Hierarchy */}
      <section
        className="pdp-information w-full flex flex-col gap-3.5"
        aria-labelledby="product-title"
      >
        {/* Step 1: Brand name — small, elegant label */}
        <div className="pdp-brand-row">
          <span className="pdp-brand-badge inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[var(--c-muted)] text-[11px] font-bold uppercase tracking-wider border border-[var(--c-line)]">
            {product.brand || "DS Mart"}
          </span>

          {product.category && (
            <span className="text-xs text-[var(--c-muted)]">
              • {product.category.name}
            </span>
          )}
        </div>

        {/* Step 2: Product title — bold but not disproportionately large */}
        <h1
          id="product-title"
          className="text-2xl sm:text-3xl lg:text-[32px] font-extrabold text-[var(--c-ink)] leading-snug tracking-tight m-0"
        >
          {product.name}
        </h1>

        <ProductReviewRating />
        {product.shortDescription && (
          <p className="pdp-intro">{product.shortDescription}</p>
        )}

        {/* Step 4-10: Price, Short Description, Stock, Variants, Stepper, CTAs, Benefits */}
        <ProductPurchase
          product={product}
          variantId={variantId}
          onVariantChange={setVariant}
        />
      </section>
    </div>
  );
}
