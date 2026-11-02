import Image from "next/image";
import Link from "next/link";
import type { Category } from "../lib/storefront";

export interface DepartmentItem {
  id: string;
  name: string;
  slug: string;
  subtitle: string;
  productCountFormatted: string;
  imageUrl: string;
  isFeatured?: boolean;
  gridClass: string;
  ctaText?: string;
}

const DEFAULT_DEPARTMENTS: DepartmentItem[] = [
  {
    id: "electronics",
    name: "Electronics",
    slug: "electronics",
    subtitle: "Gadgets, accessories & more for a smarter everyday life.",
    productCountFormatted: "5,200+ Products",
    imageUrl: "/brand/categories/electronics.jpg",
    isFeatured: true,
    gridClass: "bento-card-featured",
    ctaText: "Shop Electronics",
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
 * Merges dynamic API / CMS categories with the design mockup layout.
 * Ensures the 6-slot bento grid is always filled with premium assets while
 * picking up real database counts, custom uploaded images, or custom category slugs.
 */
function resolveDepartments(categories: Category[] = []): DepartmentItem[] {
  return DEFAULT_DEPARTMENTS.map((def, idx) => {
    // Try to match category by keywords or slug
    const match = categories.find((c) => {
      const s = c.slug.toLowerCase();
      const n = c.name.toLowerCase();
      if (def.id === "electronics") return s.includes("elect") || n.includes("elect") || s.includes("gadget");
      if (def.id === "lifestyle") return s.includes("home") || s.includes("life") || n.includes("home") || n.includes("living");
      if (def.id === "spices") return s.includes("spice") || n.includes("spice") || s.includes("food");
      if (def.id === "kids-toys") return s.includes("toy") || n.includes("toy") || s.includes("kid");
      if (def.id === "kids-books") return s.includes("book") || n.includes("book") || s.includes("learn");
      if (def.id === "groceries") return s.includes("groc") || n.includes("groc") || s.includes("fresh");
      return false;
    }) || categories[idx];

    if (!match) return def;

    const countText =
      typeof match.productCount === "number" && match.productCount > 0
        ? `${match.productCount.toLocaleString()}+ Products`
        : def.productCountFormatted;

    return {
      ...def,
      id: match.id || def.id,
      name: match.name || def.name,
      slug: match.slug || def.slug,
      productCountFormatted: countText,
      imageUrl: def.imageUrl,
    };
  });
}

function LayersIcon({ className = "bento-layers-icon" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </svg>
  );
}

function ChevronRightIcon({ className = "bento-chevron-icon" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function DepartmentBento({
  categories = [],
  title = "Shop by Department",
  hasMore = true,
}: {
  categories?: Category[];
  title?: string;
  hasMore?: boolean;
}) {
  const departments = resolveDepartments(categories);

  return (
    <section className="department-bento-section" aria-labelledby="department-heading">
      {/* Header with Lime Accent Pill and Responsive Layout */}
      <div className="department-bento-header">
        <div className="department-bento-accent-pill" aria-hidden="true" />
        <div className="department-bento-heading-row">
          <div>
            <h2 id="department-heading" className="department-bento-title">
              {title}
            </h2>
            <p className="department-bento-subtitle">
              Explore curated collections across everyday essentials.
            </p>
          </div>
          {hasMore && (
            <Link href="/categories" className="department-bento-all-btn">
              <span>All Categories</span>
              <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </div>

      {/* Smart Adaptive Bento Grid (6 slots matching design mockup) */}
      <div className="department-bento-grid">
        {departments.map((dept) => {
          const isFeatured = dept.isFeatured;
          const href = `/category/${encodeURIComponent(dept.slug)}`;

          return (
            <Link
              key={dept.id}
              href={href}
              className={`bento-card ${dept.gridClass} group`}
            >
              {/* Background Product Artwork Layer */}
              <div className="bento-image-wrap" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={dept.imageUrl}
                  alt=""
                  loading={isFeatured ? "eager" : "lazy"}
                  className="bento-image-bg"
                />
              </div>

              {/* Gradient Scrim Layer for 100% Typography Contrast */}
              <div
                className={`bento-scrim ${
                  isFeatured ? "bento-scrim-featured" : "bento-scrim-standard"
                }`}
                aria-hidden="true"
              />

              {/* Card Foreground Content */}
              {isFeatured ? (
                <div className="bento-featured-content">
                  <div className="bento-featured-top">
                    {/* DSmart Brand Badge */}
                    <div className="bento-dsmart-badge">
                      <span className="bento-dsmart-ds">DS</span>
                      <span className="bento-dsmart-mart">mart</span>
                    </div>

                    <h3 className="bento-featured-title">{dept.name}</h3>
                    <p className="bento-featured-subtitle">{dept.subtitle}</p>
                  </div>

                  <div className="bento-featured-bottom">
                    {/* Count Badge */}
                    <div className="bento-count-pill">
                      <LayersIcon className="bento-layers-icon" />
                      <span>{dept.productCountFormatted}</span>
                    </div>

                    {/* Prominent Lime CTA Pill Button */}
                    <div className="bento-featured-cta-wrap">
                      <span className="bento-featured-cta-btn">
                        <span>{dept.ctaText || `Shop ${dept.name}`}</span>
                        <ChevronRightIcon className="bento-cta-chevron" />
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bento-standard-content">
                  <div className="bento-standard-top">
                    <h3 className="bento-card-title">{dept.name}</h3>
                    <p className="bento-card-subtitle">{dept.subtitle}</p>
                  </div>

                  <div className="bento-standard-bottom-row">
                    {/* Count Badge */}
                    <div className="bento-count-pill">
                      <LayersIcon className="bento-layers-icon" />
                      <span>{dept.productCountFormatted}</span>
                    </div>

                    {/* Circular Lime Arrow Button */}
                    <div className="bento-arrow-circle" aria-hidden="true">
                      <ChevronRightIcon className="bento-circle-chevron" />
                    </div>
                  </div>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
