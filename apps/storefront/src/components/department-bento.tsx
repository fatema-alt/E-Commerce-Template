import Image from "next/image";
import Link from "next/link";
import type { Category } from "../lib/storefront";

export interface BentoLayoutRule {
  desktopColSpan: number;
  desktopRowSpan: number;
  mobileColSpan: number;
  minHeight: string;
  isLead: boolean;
}

/**
 * Calculates the exact desktop (12-column) and mobile (2-column) grid span rules
 * for any count from 1 to 8 tiles, ensuring 0 empty slots or holes across all breakpoints.
 */
export function getBentoLayoutRule(totalCount: number, index: number): BentoLayoutRule {
  const count = Math.min(Math.max(totalCount, 1), 8);
  const isLead = index === 0;

  // Mobile 2-column rule:
  // Lead tile spans 2 columns.
  // When the remaining tile count after the lead tile is odd, the last tile spans 2 columns.
  const remainingCount = count - 1;
  const isRemainingOdd = remainingCount % 2 === 1;
  const isLastTile = index === count - 1;
  const mobileColSpan = isLead || (isRemainingOdd && isLastTile) ? 2 : 1;

  switch (count) {
    case 1:
      return {
        desktopColSpan: 12,
        desktopRowSpan: 1,
        mobileColSpan: 2,
        minHeight: "min-h-[280px] sm:min-h-[340px]",
        isLead: true,
      };

    case 2:
      return {
        desktopColSpan: 6,
        desktopRowSpan: 1,
        mobileColSpan: 2, // Both tiles span 2 cols on mobile (stacked)
        minHeight: "min-h-[240px] sm:min-h-[300px]",
        isLead,
      };

    case 3:
      if (index === 0) {
        return {
          desktopColSpan: 7,
          desktopRowSpan: 2,
          mobileColSpan: 2,
          minHeight: "min-h-[300px] lg:min-h-[420px]",
          isLead: true,
        };
      }
      return {
        desktopColSpan: 5,
        desktopRowSpan: 1,
        mobileColSpan: 1,
        minHeight: "min-h-[180px] lg:min-h-[198px]",
        isLead: false,
      };

    case 4:
      if (index === 0) {
        return {
          desktopColSpan: 6,
          desktopRowSpan: 2,
          mobileColSpan: 2,
          minHeight: "min-h-[300px] lg:min-h-[420px]",
          isLead: true,
        };
      }
      if (index === 1) {
        return {
          desktopColSpan: 6,
          desktopRowSpan: 1,
          mobileColSpan: 1,
          minHeight: "min-h-[180px] lg:min-h-[198px]",
          isLead: false,
        };
      }
      return {
        desktopColSpan: 3,
        desktopRowSpan: 1,
        mobileColSpan: index === 3 ? 2 : 1, // index 3 is last tile (remaining count 3 is odd)
        minHeight: "min-h-[180px] lg:min-h-[198px]",
        isLead: false,
      };

    case 5:
      if (index === 0) {
        return {
          desktopColSpan: 7,
          desktopRowSpan: 1,
          mobileColSpan: 2,
          minHeight: "min-h-[240px] lg:min-h-[280px]",
          isLead: true,
        };
      }
      if (index === 1) {
        return {
          desktopColSpan: 5,
          desktopRowSpan: 1,
          mobileColSpan: 1,
          minHeight: "min-h-[240px] lg:min-h-[280px]",
          isLead: false,
        };
      }
      return {
        desktopColSpan: 4,
        desktopRowSpan: 1,
        mobileColSpan: 1,
        minHeight: "min-h-[180px] lg:min-h-[200px]",
        isLead: false,
      };

    case 6:
      if (index === 0) {
        return {
          desktopColSpan: 8,
          desktopRowSpan: 1,
          mobileColSpan: 2,
          minHeight: "min-h-[260px] lg:min-h-[300px]",
          isLead: true,
        };
      }
      if (index === 1) {
        return {
          desktopColSpan: 4,
          desktopRowSpan: 1,
          mobileColSpan: 1,
          minHeight: "min-h-[260px] lg:min-h-[300px]",
          isLead: false,
        };
      }
      return {
        desktopColSpan: 3,
        desktopRowSpan: 1,
        mobileColSpan: index === 5 ? 2 : 1, // index 5 is last tile (remaining count 5 is odd)
        minHeight: "min-h-[180px] lg:min-h-[200px]",
        isLead: false,
      };

    case 7:
      if (index === 0) {
        return {
          desktopColSpan: 7,
          desktopRowSpan: 1,
          mobileColSpan: 2,
          minHeight: "min-h-[240px] lg:min-h-[280px]",
          isLead: true,
        };
      }
      if (index === 1) {
        return {
          desktopColSpan: 5,
          desktopRowSpan: 1,
          mobileColSpan: 1,
          minHeight: "min-h-[240px] lg:min-h-[280px]",
          isLead: false,
        };
      }
      if (index >= 2 && index <= 4) {
        return {
          desktopColSpan: 4,
          desktopRowSpan: 1,
          mobileColSpan: 1,
          minHeight: "min-h-[180px] lg:min-h-[200px]",
          isLead: false,
        };
      }
      return {
        desktopColSpan: 6,
        desktopRowSpan: 1,
        mobileColSpan: 1,
        minHeight: "min-h-[180px] lg:min-h-[210px]",
        isLead: false,
      };

    case 8:
    default:
      if (index === 0) {
        return {
          desktopColSpan: 8,
          desktopRowSpan: 1,
          mobileColSpan: 2,
          minHeight: "min-h-[260px] lg:min-h-[300px]",
          isLead: true,
        };
      }
      if (index === 1) {
        return {
          desktopColSpan: 4,
          desktopRowSpan: 1,
          mobileColSpan: 1,
          minHeight: "min-h-[260px] lg:min-h-[300px]",
          isLead: false,
        };
      }
      return {
        desktopColSpan: 4,
        desktopRowSpan: 1,
        mobileColSpan: index === 7 ? 2 : 1, // index 7 is last tile (remaining count 7 is odd)
        minHeight: "min-h-[180px] lg:min-h-[200px]",
        isLead: false,
      };
  }
}

export function DepartmentBento({
  categories,
  title = "Shop by Department",
  hasMore = categories.length > 8,
}: {
  categories: Category[];
  title?: string;
  hasMore?: boolean;
}) {
  // Hide empty categories only when product counts are known
  const filtered = categories.filter(
    (c) => c.productCount === undefined || c.productCount > 0,
  );

  // Bento grid handles up to 8 tiles gracefully
  const tiles = filtered.slice(0, 8);

  if (!tiles.length) {
    return (
      <section className="department-bento-section" aria-labelledby="department-heading">
        <div className="department-bento-heading">
          <h2 id="department-heading">{title}</h2>
        </div>
        <p className="empty-content">No categories are available yet.</p>
      </section>
    );
  }

  return (
    <section className="department-bento-section" aria-labelledby="department-heading">
      <div className="department-bento-heading">
        <div>
          <h2 id="department-heading">{title}</h2>
          <p>Explore curated collections and everyday essentials</p>
        </div>
        {hasMore && (
          <Link href="/categories" className="department-bento-all">
            <span>All Categories</span>
            <span aria-hidden="true">↗</span>
          </Link>
        )}
      </div>

      <div className="department-bento-grid">
        {tiles.map((cat, idx) => {
          const rule = getBentoLayoutRule(tiles.length, idx);
          const hasImage = Boolean(cat.imageUrl);
          const spanClasses = `bento-m-col-${rule.mobileColSpan} bento-d-col-${rule.desktopColSpan} bento-d-row-${rule.desktopRowSpan} ${rule.minHeight}`;
          const isLead = rule.isLead;

          return (
            <Link
              key={cat.id}
              href={`/category/${encodeURIComponent(cat.slug)}`}
              className={`bento-card ${spanClasses} ${
                hasImage ? "bento-card-has-image" : "bento-card-typographic"
              }`}
            >
              {/* Photo background with dark legibility gradient */}
              {hasImage && (
                <>
                  <div className="bento-image-wrap">
                    <Image
                      src={cat.imageUrl!}
                      alt=""
                      fill
                      sizes={
                        rule.desktopColSpan >= 8
                          ? "(max-width: 1024px) 100vw, 880px"
                          : rule.desktopColSpan >= 6
                          ? "(max-width: 1024px) 100vw, 660px"
                          : "(max-width: 1024px) 50vw, 420px"
                      }
                      priority={idx === 0}
                      loading={idx === 0 ? "eager" : "lazy"}
                      className="bento-image"
                      unoptimized={cat.imageUrl!.startsWith("http:") || cat.imageUrl!.startsWith("data:")}
                    />
                  </div>
                  <div className="bento-overlay" aria-hidden="true" />
                </>
              )}

              {/* Top metadata strip: item count badge (only when real data exists) & arrow */}
              <div className="bento-top-bar">
                {typeof cat.productCount === "number" && cat.productCount > 0 ? (
                  <span
                    className={`bento-count-badge ${
                      hasImage ? "bento-badge-image" : "bento-badge-typo"
                    }`}
                  >
                    {cat.productCount} {cat.productCount === 1 ? "item" : "items"}
                  </span>
                ) : (
                  <span />
                )}

                <div
                  aria-hidden="true"
                  className={`bento-arrow-btn ${
                    hasImage ? "bento-arrow-image" : "bento-arrow-typo"
                  }`}
                >
                  ↗
                </div>
              </div>

              {/* Bottom content: category title and explore link */}
              <div className="bento-content">
                <h3
                  className={`bento-title ${
                    isLead ? "bento-title-lead" : "bento-title-normal"
                  } ${hasImage ? "bento-title-image" : "bento-title-typo"}`}
                >
                  {cat.name}
                </h3>
                <span
                  className={`bento-explore ${
                    hasImage ? "bento-explore-image" : "bento-explore-typo"
                  }`}
                >
                  <span>Explore department</span>
                  <span aria-hidden="true">→</span>
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
