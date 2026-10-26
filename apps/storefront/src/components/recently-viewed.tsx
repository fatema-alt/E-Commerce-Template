"use client";

import { useEffect, useState } from "react";
import type { Product } from "../lib/storefront";
import { ProductCard } from "./product-card";

export function trackRecentlyViewed(product: {
  id: string;
  slug: string;
  name: string;
  price: number;
  imageUrl?: string | null;
}) {
  try {
    const key = "commerce-recently-viewed";
    const raw = localStorage.getItem(key);
    let items: any[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(items)) items = [];
    items = [product, ...items.filter((item) => item.id !== product.id)].slice(0, 16);
    localStorage.setItem(key, JSON.stringify(items));
    window.dispatchEvent(new Event("commerce-recently-viewed-change"));
  } catch {
    // Storage access unavailable
  }
}

export function RecentlyViewedSection({
  title = "Recently Viewed Products",
  limit = 8,
}: {
  title?: string;
  limit?: number;
}) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    function load() {
      try {
        const raw = localStorage.getItem("commerce-recently-viewed");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setProducts(
              parsed.slice(0, limit).map((item) => ({
                id: item.id,
                slug: item.slug,
                name: item.name,
                price: Number(item.price) || 0,
                compareAtPrice: item.compareAtPrice ? Number(item.compareAtPrice) : null,
                currency: "BDT",
                imageUrl: item.imageUrl || null,
                inStock: true,
                availableStock: 100,
                type: "SIMPLE",
              })),
            );
          }
        }
      } catch {
        // Storage access error
      }
    }

    load();
    window.addEventListener("commerce-recently-viewed-change", load);
    return () => window.removeEventListener("commerce-recently-viewed-change", load);
  }, [limit]);

  if (!products.length) return null;

  return (
    <section className="section recently-viewed-section" aria-label={title}>
      <div className="section-head">
        <h2>{title}</h2>
      </div>
      <div className="products-grid cms-grid" style={{ "--columns": 4 } as any}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
