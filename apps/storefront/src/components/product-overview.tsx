"use client";
import { useEffect, useState } from "react";
import { repairSimpleCart } from "../lib/cart";
import type { Product } from "../lib/storefront";
import { ProductGallery } from "./product-gallery";
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
    <div className="product-detail-grid pdp-overview">
      <ProductGallery key={variantId} images={gallery} name={product.name} />
      <section className="pdp-information" aria-labelledby="product-title">
        <p className="eyebrow">{product.brand || "DS Mart pick"}</p>
        <h1 id="product-title">{product.name}</h1>
        {product.shortDescription && (
          <p className="pdp-intro">{product.shortDescription}</p>
        )}
        <ProductPurchase
          product={product}
          variantId={variantId}
          onVariantChange={setVariant}
        />
        <div className="pdp-service-notes">
          <p>
            <strong>Clear totals</strong>
            <span>
              Review delivery charges and your final total before ordering.
            </span>
          </p>
          <p>
            <strong>Order updates</strong>
            <span>
              Follow your order from your account or the browser used for guest
              checkout.
            </span>
          </p>
        </div>
      </section>
    </div>
  );
}