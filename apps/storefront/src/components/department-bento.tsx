/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import type { Category } from "../lib/storefront";

export interface DepartmentItem {
  id: string;
  name: string;
  slug: string;
  subtitle: string;
  productCountFormatted: string;
  imageUrl: string;
  fallbackImageUrl?: string;
  isFeatured?: boolean;
  gridClass: string;
  gridStyle?: CSSProperties;
  isCustomImage?: boolean;
}

export const DEFAULT_DEPARTMENTS: DepartmentItem[] = [
  {
    id: "electronics",
    name: "Electronics",
    slug: "electronics",
    subtitle: "Gadgets, accessories & more for a smarter everyday life.",
    productCountFormatted: "5,200+ Products",
    imageUrl: "/brand/categories/electronics.jpg",
    isFeatured: true,
    gridClass: "bento-card-featured",
  },
  {
    id: "lifestyle",
    name: "Lifestyle",
    slug: "lifestyle",
    subtitle: "Home, decor, wellness & more.",
    productCountFormatted: "3,400+ Products",
    imageUrl: "/brand/categories/lifestyle.jpg",
    isFeatured: false,
    gridClass: "bento-card-side-1",
  },
  {
    id: "spices",
    name: "Spices",
    slug: "spices",
    subtitle: "Pure spices for richer, healthier meals.",
    productCountFormatted: "800+ Products",
    imageUrl: "/brand/categories/spices.jpg",
    isFeatured: false,
    gridClass: "bento-card-side-2",
  },
  {
    id: "kids-toys",
    name: "Kids Toys",
    slug: "kids-toys",
    subtitle: "Fun, safe & creative toys for growing minds.",
    productCountFormatted: "1,200+ Products",
    imageUrl: "/brand/categories/kids-toys.jpg",
    isFeatured: false,
    gridClass: "bento-card-bottom-1",
  },
  {
    id: "kids-books",
    name: "Kids Learning Books",
    slug: "kids-learning-books",
    subtitle: "Engaging books for curious young learners.",
    productCountFormatted: "950+ Products",
    imageUrl: "/brand/categories/kids-books.jpg",
    isFeatured: false,
    gridClass: "bento-card-bottom-2",
  },
  {
    id: "groceries",
    name: "Groceries",
    slug: "groceries",
    subtitle: "Daily essentials, fresh and trusted.",
    productCountFormatted: "4,800+ Products",
    imageUrl: "/brand/categories/groceries.jpg",
    isFeatured: false,
    gridClass: "bento-card-bottom-3",
  },
];

/**
 * Returns dynamic grid span class or style for adaptive bento matrix.
 * Ensures zero orphan gaps across any number of items (1 to 24).
 */
export function getAdaptiveSlot(index: number, total: number, isFeatured = false): {
  gridClass: string;
  gridStyle?: CSSProperties;
} {
  // Classic 6-card bento matches the original design mockup classes exactly
  if (total === 6) {
    const classes = [
      "bento-card-featured",
      "bento-card-side-1",
      "bento-card-side-2",
      "bento-card-bottom-1",
      "bento-card-bottom-2",
      "bento-card-bottom-3",
    ];
    return { gridClass: classes[index] || "bento-card-span-4" };
  }

  // 1 item: full hero
  if (total === 1) {
    return { gridClass: "bento-card-hero bento-card-span-12" };
  }

  // 2 items: 50/50 split
  if (total === 2) {
    return { gridClass: "bento-card-span-6 bento-card-half" };
  }

  // 3 items: 1 lead (span 8) + 2 stacked (span 4 each)
  if (total === 3) {
    if (index === 0 || isFeatured) return { gridClass: "bento-card-featured" };
    if (index === 1) return { gridClass: "bento-card-side-1" };
    return { gridClass: "bento-card-side-2" };
  }

  // 4 items: 1 lead (span 8) + 2 stacked (span 4 each) + 1 full-width bottom banner
  if (total === 4) {
    if (index === 0) return { gridClass: "bento-card-featured" };
    if (index === 1) return { gridClass: "bento-card-side-1" };
    if (index === 2) return { gridClass: "bento-card-side-2" };
    return { gridClass: "bento-card-span-12 bento-card-wide" };
  }

  // 5 items: 1 lead (span 8) + 2 stacked (span 4 each) + 2 half-width bottom cards (span 6 each)
  if (total === 5) {
    if (index === 0) return { gridClass: "bento-card-featured" };
    if (index === 1) return { gridClass: "bento-card-side-1" };
    if (index === 2) return { gridClass: "bento-card-side-2" };
    return { gridClass: "bento-card-span-6 bento-card-half" };
  }

  // 7 items: 1 lead (span 8) + 2 stacked (span 4 each) + 4 bottom cards (span 3 each)
  if (total === 7) {
    if (index === 0) return { gridClass: "bento-card-featured" };
    if (index === 1) return { gridClass: "bento-card-side-1" };
    if (index === 2) return { gridClass: "bento-card-side-2" };
    return { gridClass: "bento-card-span-3" };
  }

  // 8 items: 1 lead (span 8) + 2 stacked (span 4) + 3 middle (span 4) + 2 bottom (span 6)
  if (total === 8) {
    if (index === 0) return { gridClass: "bento-card-featured" };
    if (index === 1) return { gridClass: "bento-card-side-1" };
    if (index === 2) return { gridClass: "bento-card-side-2" };
    if (index < 6) return { gridClass: "bento-card-span-4" };
    return { gridClass: "bento-card-span-6 bento-card-half" };
  }

  // 9 items: 1 lead (span 8) + 2 stacked (span 4) + 6 standard (span 4)
  if (total === 9) {
    if (index === 0) return { gridClass: "bento-card-featured" };
    if (index === 1) return { gridClass: "bento-card-side-1" };
    if (index === 2) return { gridClass: "bento-card-side-2" };
    return { gridClass: "bento-card-span-4" };
  }

  // 10 items: 1 lead (span 8) + 2 stacked (span 4) + 3 middle (span 4) + 4 bottom (span 3)
  if (total === 10) {
    if (index === 0) return { gridClass: "bento-card-featured" };
    if (index === 1) return { gridClass: "bento-card-side-1" };
    if (index === 2) return { gridClass: "bento-card-side-2" };
    if (index < 6) return { gridClass: "bento-card-span-4" };
    return { gridClass: "bento-card-span-3" };
  }

  // 11+ items: 1 lead (span 8) + 2 stacked (span 4), remaining in clean 3-col or 4-col rows
  if (index === 0) return { gridClass: "bento-card-featured" };
  if (index === 1) return { gridClass: "bento-card-side-1" };
  if (index === 2) return { gridClass: "bento-card-side-2" };
  return { gridClass: "bento-card-span-4" };
}

/**
 * Resolves dynamic category list into DepartmentItem cards with fallback images
 * and assigned featured state.
 */
export function resolveDynamicDepartments(
  categories: Category[] = [],
  options?: {
    layoutType?: "adaptive" | "equal" | "featured";
    featuredCategoryId?: string;
    columns?: number;
  },
): DepartmentItem[] {
  const safeCategories = Array.isArray(categories)
    ? categories.filter((cat): cat is Category => Boolean(cat && typeof cat.id === "string"))
    : [];

  const layoutType = options?.layoutType || "adaptive";
  const featuredId = options?.featuredCategoryId;

  // If no dynamic categories are available at all, fall back to default template
  if (safeCategories.length === 0) {
    return DEFAULT_DEPARTMENTS.map((def, idx) => {
      const slot = getAdaptiveSlot(idx, DEFAULT_DEPARTMENTS.length, def.isFeatured);
      return {
        ...def,
        gridClass:
          layoutType === "equal"
            ? "bento-card-equal"
            : layoutType === "featured"
            ? idx === 0
              ? "bento-card-hero bento-card-span-12"
              : "bento-card-span-4 bento-card-sub"
            : slot.gridClass,
      };
    });
  }

  // Sort: if featuredId is specified and in list, put it first for primary hero spotlight
  let sorted = [...safeCategories];
  if (featuredId) {
    const featuredIndex = sorted.findIndex((c) => c.id === featuredId);
    if (featuredIndex > 0) {
      const [feat] = sorted.splice(featuredIndex, 1);
      sorted.unshift(feat);
    }
  }

  const total = sorted.length;

  return sorted.map((cat, idx) => {
    const isFeatured = featuredId ? cat.id === featuredId : idx === 0;

    // Check if category has its own uploaded image
    const hasCustomImage = Boolean(
      typeof cat.imageUrl === "string" && cat.imageUrl.trim().length > 0,
    );

    // Fallback image selection: match by keyword if possible, else cycle through default images
    let fallbackImage = DEFAULT_DEPARTMENTS[idx % DEFAULT_DEPARTMENTS.length].imageUrl;
    const s = typeof cat.slug === "string" ? cat.slug.toLowerCase() : "";
    const n = typeof cat.name === "string" ? cat.name.toLowerCase() : "";
    const keywordMatch = DEFAULT_DEPARTMENTS.find((def) => {
      if (def.id === "electronics" && (s.includes("elect") || n.includes("elect") || s.includes("gadget"))) return true;
      if (def.id === "lifestyle" && (s.includes("life") || s.includes("home") || n.includes("living") || n.includes("decor"))) return true;
      if (def.id === "spices" && (s.includes("spice") || n.includes("spice"))) return true;
      if (def.id === "kids-toys" && (s.includes("toy") || n.includes("toy"))) return true;
      if (def.id === "kids-books" && (s.includes("book") || n.includes("book") || s.includes("learn"))) return true;
      if (def.id === "groceries" && (s.includes("groc") || n.includes("groc") || s.includes("fresh") || s.includes("food"))) return true;
      return false;
    });
    if (keywordMatch) {
      fallbackImage = keywordMatch.imageUrl;
    }

    const resolvedImageUrl = hasCustomImage ? cat.imageUrl!.trim() : fallbackImage;

    const countText =
      typeof cat.productCount === "number" && cat.productCount > 0
        ? `${cat.productCount.toLocaleString()}+ Products`
        : DEFAULT_DEPARTMENTS[idx % DEFAULT_DEPARTMENTS.length].productCountFormatted;

    // Assign grid class depending on layout type
    let gridClass = "bento-card-span-4";
    let gridStyle: CSSProperties | undefined;

    if (layoutType === "equal") {
      gridClass = "bento-card-equal";
    } else if (layoutType === "featured") {
      if (isFeatured) {
        gridClass = "bento-card-hero bento-card-span-12";
      } else {
        const subCols = options?.columns === 3 ? "bento-card-span-4" : "bento-card-span-3";
        gridClass = `${subCols} bento-card-sub`;
      }
    } else {
      // Adaptive layout
      const slot = getAdaptiveSlot(idx, total, isFeatured);
      gridClass = slot.gridClass;
      gridStyle = slot.gridStyle;
    }

    return {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      subtitle: (cat as { description?: string }).description || `Explore curated ${cat.name} products.`,
      productCountFormatted: countText,
      imageUrl: resolvedImageUrl,
      fallbackImageUrl: fallbackImage,
      isFeatured,
      gridClass,
      gridStyle,
      isCustomImage: hasCustomImage,
    };
  });
}

export interface DepartmentBentoProps {
  categories?: Category[];
  title?: string;
  subtitle?: string;
  hasMore?: boolean;
  showViewAll?: boolean;
  layoutType?: "adaptive" | "equal" | "featured";
  columns?: number;
  featuredCategoryId?: string;
}

export function DepartmentBento({
  categories = [],
  title = "Shop by Department",
  subtitle = "Explore curated collections across everyday essentials.",
  hasMore = true,
  showViewAll = true,
  layoutType = "adaptive",
  columns = 4,
  featuredCategoryId,
}: DepartmentBentoProps) {
  const departments = resolveDynamicDepartments(categories, {
    layoutType,
    featuredCategoryId,
    columns,
  });

  const gridContainerClass =
    layoutType === "equal"
      ? "department-bento-grid bento-layout-equal"
      : layoutType === "featured"
      ? "department-bento-grid bento-layout-featured"
      : "department-bento-grid bento-layout-adaptive";

  const containerStyle =
    layoutType === "equal"
      ? ({ "--equal-cols": columns } as CSSProperties)
      : undefined;

  return (
    <section className="department-bento-section" aria-labelledby="department-heading">
      {/* Header with Lime Accent Pill & View All Button */}
      <div className="department-bento-header">
        <div className="department-bento-accent-pill" aria-hidden="true" />
        <div className="department-bento-heading-row">
          <div>
            <h2 id="department-heading" className="department-bento-title">
              {title}
            </h2>
            {subtitle && (
              <p className="department-bento-subtitle">
                {subtitle}
              </p>
            )}
          </div>
          {showViewAll && hasMore && (
            <Link href="/categories" className="department-bento-all-btn">
              <span>All Categories</span>
              <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </div>

      {/* Dynamic Adaptive Bento Grid */}
      <div className={gridContainerClass} style={containerStyle}>
        {departments.map((dept) => {
          const isFeatured = dept.isFeatured;
          const href = `/category/${encodeURIComponent(dept.slug)}`;

          return (
            <Link
              key={dept.id}
              href={href}
              className={`bento-card ${dept.gridClass} group`}
              style={dept.gridStyle}
              aria-label={`${dept.name} — ${dept.subtitle}`}
            >
              {/* Image Tile Layer with Proper Fit */}
              <div className="bento-image-wrap">
                <img
                  src={dept.imageUrl}
                  alt={dept.name}
                  loading={isFeatured ? "eager" : "lazy"}
                  className="bento-image-bg"
                  onError={(e) => {
                    if (
                      dept.fallbackImageUrl &&
                      (e.target as HTMLImageElement).src !== dept.fallbackImageUrl
                    ) {
                      (e.target as HTMLImageElement).src = dept.fallbackImageUrl;
                    }
                  }}
                />
              </div>

              {/* Title & Count overlay (enhanced for custom uploaded images) */}
              {dept.isCustomImage && (
                <div className="bento-card-caption">
                  <span className="bento-card-name">{dept.name}</span>
                  {dept.productCountFormatted && (
                    <span className="bento-card-count">{dept.productCountFormatted}</span>
                  )}
                </div>
              )}

              {/* Accessible Text for Screen Readers & SEO */}
              <span className="sr-only">
                {dept.name}: {dept.subtitle} ({dept.productCountFormatted})
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
