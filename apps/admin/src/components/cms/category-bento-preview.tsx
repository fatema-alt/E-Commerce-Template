/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { type Asset, request } from "./cms-api";
import { type CategoryItem } from "./category-bento-inspector";

const DEFAULT_PREVIEW_DEPARTMENTS = [
  {
    id: "electronics",
    name: "Electronics",
    subtitle: "Gadgets, accessories & more for a smarter everyday life.",
    productCount: 5200,
    imageUrl: "/brand/categories/electronics.jpg",
  },
  {
    id: "lifestyle",
    name: "Lifestyle",
    subtitle: "Home, decor, wellness & more.",
    productCount: 3400,
    imageUrl: "/brand/categories/lifestyle.jpg",
  },
  {
    id: "spices",
    name: "Spices",
    subtitle: "Pure spices for richer, healthier meals.",
    productCount: 800,
    imageUrl: "/brand/categories/spices.jpg",
  },
  {
    id: "kids-toys",
    name: "Kids Toys",
    subtitle: "Fun, safe & creative toys for growing minds.",
    productCount: 1200,
    imageUrl: "/brand/categories/kids-toys.jpg",
  },
  {
    id: "kids-books",
    name: "Kids Learning Books",
    subtitle: "Engaging books for curious young learners.",
    productCount: 950,
    imageUrl: "/brand/categories/kids-books.jpg",
  },
  {
    id: "groceries",
    name: "Groceries",
    subtitle: "Daily essentials, fresh and trusted.",
    productCount: 4800,
    imageUrl: "/brand/categories/groceries.jpg",
  },
];

interface CategoryBentoPreviewProps {
  config: Record<string, any>;
  assets?: Asset[];
  viewport: "desktop" | "tablet" | "mobile";
}

export function CategoryBentoPreview({
  config,
  viewport,
}: CategoryBentoPreviewProps) {
  const title = String(config.title || "Shop by Department");
  const subtitle = String(
    config.subtitle || "Explore curated collections across everyday essentials.",
  );
  const layoutType = (config.layoutType as "adaptive" | "equal" | "featured") || "adaptive";
  const selectionMode = (config.selectionMode as "auto" | "manual") || (Array.isArray(config.categoryIds) && config.categoryIds.length > 0 ? "manual" : "auto");
  const categoryIds = (Array.isArray(config.categoryIds) ? config.categoryIds : []) as string[];
  const featuredCategoryId = String(config.featuredCategoryId || "");
  const columns = Number(config.columns || 4);
  const limit = String(config.limit || "6");
  const showViewAll = config.showViewAll !== false;

  const [dbCategories, setDbCategories] = useState<CategoryItem[]>([]);

  useEffect(() => {
    let active = true;
    request<{ items: CategoryItem[]; total: number }>(
      "/categories?paginated=true&page=1&pageSize=50",
    )
      .then((res) => {
        if (!active) return;
        setDbCategories(res.items || []);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  // Resolve categories to show
  let displayedItems: CategoryItem[] = [];

  if (selectionMode === "manual" && categoryIds.length > 0) {
    displayedItems = categoryIds
      .map((id) => dbCategories.find((c) => c.id === id) || { id, name: "Category" })
      .filter(Boolean);
  } else if (dbCategories.length > 0) {
    displayedItems = [...dbCategories].sort(
      (a, b) => (b.productCount || 0) - (a.productCount || 0),
    );
  }

  // Fallback to defaults if no categories exist
  if (displayedItems.length === 0) {
    displayedItems = DEFAULT_PREVIEW_DEPARTMENTS;
  }

  // Apply limit
  const maxItems = limit === "all" ? Infinity : Number(limit || 6);
  if (maxItems !== Infinity) {
    displayedItems = displayedItems.slice(0, maxItems);
  }

  // Featured re-ordering if featuredCategoryId is set
  if (featuredCategoryId && displayedItems.some((d) => d.id === featuredCategoryId)) {
    const featIdx = displayedItems.findIndex((d) => d.id === featuredCategoryId);
    if (featIdx > 0) {
      const [feat] = displayedItems.splice(featIdx, 1);
      displayedItems.unshift(feat);
    }
  }

  const total = displayedItems.length;

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
      {/* Header with Lime Accent Pill */}
      <div className="mb-4">
        <div className="w-8 h-1.5 rounded-full bg-[#c6f53a] mb-2" />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#c6f53a]/25 text-slate-800 dark:text-[#c6f53a] border border-[#c6f53a]/60 capitalize">
              {layoutType === "adaptive"
                ? `Adaptive Bento (${total} slots)`
                : layoutType === "equal"
                ? `Equal Grid (${columns} cols)`
                : "Featured Grid"}
            </span>
            {showViewAll && (
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 inline-flex items-center gap-1">
                <span>All Categories</span>
                <span>→</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Grid Layout Canvas */}
      <div
        className={
          layoutType === "equal"
            ? `grid gap-2.5 ${
                viewport === "mobile"
                  ? "grid-cols-2"
                  : viewport === "tablet"
                  ? "grid-cols-2 sm:grid-cols-3"
                  : columns === 3
                  ? "grid-cols-3"
                  : columns === 6
                  ? "grid-cols-6"
                  : "grid-cols-4"
              }`
            : viewport === "mobile"
            ? "flex flex-col gap-2.5"
            : viewport === "tablet"
            ? "grid grid-cols-6 gap-2.5"
            : "grid grid-cols-12 gap-2.5"
        }
      >
        {displayedItems.map((item, idx) => {
          const isFeatured = featuredCategoryId ? item.id === featuredCategoryId : idx === 0;

          // Default fallback images
          const fallback =
            DEFAULT_PREVIEW_DEPARTMENTS[idx % DEFAULT_PREVIEW_DEPARTMENTS.length].imageUrl;
          const imgSrc = item.imageUrl || fallback;

          // Compute grid spans for adaptive layout
          let spanClass = "col-span-4";
          let heightClass = "aspect-[336/148]";

          if (layoutType === "equal") {
            spanClass = "";
            heightClass = "aspect-[16/10]";
          } else if (layoutType === "featured") {
            if (isFeatured) {
              spanClass = viewport === "tablet" ? "col-span-6" : "col-span-12";
              heightClass = "aspect-[21/7]";
            } else {
              spanClass = viewport === "tablet" ? "col-span-3" : "col-span-4";
              heightClass = "aspect-[16/10]";
            }
          } else {
            // Adaptive layout
            if (viewport === "tablet") {
              if (idx === 0) {
                spanClass = "col-span-6";
                heightClass = "aspect-[612/274]";
              } else {
                spanClass = "col-span-3";
                heightClass = "aspect-[336/132]";
              }
            } else if (viewport !== "mobile") {
              // Desktop 12-col matrix
              if (idx === 0) {
                spanClass = "col-span-8 row-span-2";
                heightClass = "aspect-[612/274]";
              } else if (idx === 1 || idx === 2) {
                spanClass = "col-span-4";
                heightClass = "aspect-[336/132]";
              } else if (total === 4) {
                spanClass = "col-span-12";
                heightClass = "aspect-[21/6]";
              } else if (total === 5) {
                spanClass = "col-span-6";
                heightClass = "aspect-[301/148]";
              } else if (total === 7) {
                spanClass = "col-span-3";
                heightClass = "aspect-[280/148]";
              } else if (total === 8 && idx >= 6) {
                spanClass = "col-span-6";
                heightClass = "aspect-[301/148]";
              } else if (total === 10 && idx >= 6) {
                spanClass = "col-span-3";
                heightClass = "aspect-[280/148]";
              } else {
                spanClass = "col-span-4";
                heightClass = "aspect-[301/148]";
              }
            }
          }

          return (
            <div
              key={item.id}
              className={`relative overflow-hidden rounded-xl bg-[#111714] border border-white/10 select-none group shadow-sm transition hover:border-[#c6f53a]/60 ${spanClass} ${heightClass}`}
            >
              <img
                src={imgSrc}
                alt={item.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = fallback;
                }}
              />

              {/* Title overlay for clarity */}
              <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-end justify-between gap-2">
                <span className="font-extrabold text-xs text-white truncate drop-shadow-sm">
                  {item.name}
                </span>
                {item.productCount ? (
                  <span className="text-[10px] font-bold text-[#c6f53a] whitespace-nowrap">
                    {item.productCount.toLocaleString()}+
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
