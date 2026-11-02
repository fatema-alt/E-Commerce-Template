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
 * Resolves category slugs against dynamic database categories.
 * Preserves the pristine visual design and avoids mismatched slot assignments.
 */
function resolveDepartments(categories: Category[] = []): DepartmentItem[] {
  return DEFAULT_DEPARTMENTS.map((def) => {
    const match = categories.find((c) => {
      const s = (c.slug || "").toLowerCase();
      const n = (c.name || "").toLowerCase();
      if (def.id === "electronics") {
        return s.includes("elect") || n.includes("elect") || s.includes("gadget");
      }
      if (def.id === "lifestyle") {
        return s.includes("life") || s.includes("home") || n.includes("living") || n.includes("decor");
      }
      if (def.id === "spices") {
        return s.includes("spice") || n.includes("spice");
      }
      if (def.id === "kids-toys") {
        return (s.includes("toy") || n.includes("toy")) && !s.includes("book");
      }
      if (def.id === "kids-books") {
        return s.includes("book") || n.includes("book") || s.includes("learn");
      }
      if (def.id === "groceries") {
        return s.includes("groc") || n.includes("groc") || s.includes("fresh") || s.includes("food");
      }
      return false;
    });

    return {
      ...def,
      id: match?.id || def.id,
      slug: match?.slug || def.slug,
    };
  });
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
      {/* Header with Lime Accent Pill */}
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

      {/* Pristine 6-Slot Bento Grid: zero double buttons, zero double text, zero murky shadows */}
      <div className="department-bento-grid">
        {departments.map((dept) => {
          const isFeatured = dept.isFeatured;
          const href = `/category/${encodeURIComponent(dept.slug)}`;

          return (
            <Link
              key={dept.id}
              href={href}
              className={`bento-card ${dept.gridClass} group`}
              aria-label={`${dept.name} — ${dept.subtitle}`}
            >
              {/* Pristine Artwork Tile */}
              <div className="bento-image-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={dept.imageUrl}
                  alt={dept.name}
                  loading={isFeatured ? "eager" : "lazy"}
                  className="bento-image-bg"
                />
              </div>

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
