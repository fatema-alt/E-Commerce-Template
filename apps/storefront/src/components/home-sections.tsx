import { DepartmentGrid } from "./department-grid";
import Link from "next/link";
import type { Category, ContentBlock, Product } from "../lib/storefront";
import { Newsletter } from "./newsletter";
import { HeroBanner } from "./hero-banner";

import { ProductCard } from "./product-card";
export { ProductCard };

export function HomeSections({
  blocks,
  categories,
  products,
}: {
  blocks: ContentBlock[];
  categories: Category[];
  products: Product[];
}) {
  return (
    <main id="main" className="container main-content space-y-12">
      {blocks.map((block) => {
        if (block.type === "hero") {
          return <HeroBanner key={block.id} block={block} />;
        }

        if (block.type === "categories") {
          return (
            <section
              key={block.id}
              className="section department-home-section"
              aria-label={block.title}
            >
              <DepartmentGrid categories={categories} title={block.title} />
            </section>
          );
        }

        if (block.type === "products") {
          return (
            <section
              key={block.id}
              className="section"
              aria-labelledby={`title-${block.id}`}
            >
              <div className="section-head">
                <div>
                  <h2 id={`title-${block.id}`}>{block.title}</h2>
                  {block.subtitle && (
                    <p className="text-sm text-slate-500 mt-1">
                      {block.subtitle}
                    </p>
                  )}
                </div>
                <Link href="/shop">Shop all</Link>
              </div>
              {products.length ? (
                <div className="products-grid">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <div className="empty-content">
                  Products will appear here when items are added to your catalog.
                </div>
              )}
            </section>
          );
        }

        if (block.type === "promoBanner") {
          return (
            <section
              key={block.id}
              className="shop-panel cms-promo"
              aria-labelledby={`title-${block.id}`}
            >
              <h2 id={`title-${block.id}`}>{block.title}</h2>
              {block.description && <p>{block.description}</p>}
              {block.ctaLabel && block.ctaHref && (
                <Link className="primary-button" href={block.ctaHref}>
                  {block.ctaLabel}
                </Link>
              )}
            </section>
          );
        }

        if (block.type === "trustBadges") {
          return (
            <section
              key={block.id}
              className="section"
              aria-labelledby={`title-${block.id}`}
            >
              {block.title && (
                <div className="section-head">
                  <h2 id={`title-${block.id}`}>{block.title}</h2>
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {(block.items || []).map((item, i) => (
                  <div
                    key={i}
                    className="shop-panel p-6 rounded-2xl flex flex-col justify-center"
                  >
                    <div className="text-2xl mb-2">
                      {item.icon === "truck"
                        ? "🚚"
                        : item.icon === "shield"
                        ? "🛡️"
                        : item.icon === "return"
                        ? "🔄"
                        : "💬"}
                    </div>
                    <h3 className="font-bold text-base mb-1">{item.title}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed m-0">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          );
        }

        if (block.type === "faq") {
          return (
            <section
              key={block.id}
              className="cms-faq"
              aria-labelledby={`title-${block.id}`}
            >
              <h2 id={`title-${block.id}`}>{block.title}</h2>
              <div className="space-y-3">
                {block.items.map((item, i) => (
                  <details key={i}>
                    <summary className="font-semibold cursor-pointer">
                      {item.question}
                    </summary>
                    <p className="mt-2 text-sm">{item.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          );
        }

        if (block.type === "newsletter") {
          return (
            <section
              key={block.id}
              className="newsletter-home-section"
            >
              <Newsletter
                title={block.title}
                description={block.description}
                buttonLabel={block.buttonLabel || "Subscribe"}
                consentText={
                  block.consentText ||
                  "I agree to receive promotional updates and discount codes."
                }
              />
            </section>
          );
        }

        return null;
      })}
    </main>
  );
}
