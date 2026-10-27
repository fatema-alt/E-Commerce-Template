import Link from "next/link";
import { ProductRichTextRenderer } from "../../../components/product-rich-text";
import { productDescriptionText } from "@commerce/product-content";
import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, permanentRedirect, unstable_rethrow } from "next/navigation";
import {
  getProduct,
  getProductPage,
  type Product,
} from "../../../lib/storefront";
import { ProductFeedbackProvider } from "../../../components/product-feedback";
import { ProductOverview } from "../../../components/product-overview";
import { ProductCard } from "../../../components/home-sections";
import { ProductSkeleton } from "../../../components/product-skeleton";
import { ProductReviewsSection } from "../../../components/product-reviews";
import { productStructuredData, productUrl } from "../../../lib/product-seo";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const product = await getProduct((await params).slug);
    if (!product)
      return { title: "Product not found", robots: { index: false } };
    const canonical = productUrl(product);
    const title = product.metaTitle || product.name;
    const description = (
      product.metaDescription ||
      product.shortDescription ||
      productDescriptionText(product.description) ||
      `Discover ${product.name} at DS Mart.`
    ).slice(0, 160);
    const image = product.socialImage || product.imageUrl;
    return {
      title,
      description,
      robots: { index: !product.noIndex, follow: true },
      ...(canonical ? { alternates: { canonical } } : {}),
      openGraph: {
        title: product.socialTitle || title,
        description: product.socialDescription || description,
        siteName: "DS Mart",
        type: "website",
        ...(canonical ? { url: canonical } : {}),
        ...(image ? { images: [{ url: image, alt: product.name }] } : {}),
      },
      twitter: {
        card: image ? "summary_large_image" : "summary",
        title: product.socialTitle || title,
        description: product.socialDescription || description,
        ...(image ? { images: [image] } : {}),
      },
    };
  } catch (error) {
    unstable_rethrow(error);
    return {
      title: "Product temporarily unavailable",
      robots: { index: false },
    };
  }
}
async function RelatedProducts({ product }: { product: Product }) {
  if (!product.category) return null;
  const result = await getProductPage({
    categoryId: product.category.id,
    pageSize: 6,
  });
  const related = result.items
    .filter((item) => item.id !== product.id)
    .slice(0, 4);
  if (!related.length) return null;
  return (
    <section className="section pdp-related" aria-labelledby="related-title">
      <div className="section-head">
        <div>
          <p className="eyebrow">Keep exploring</p>
          <h2 id="related-title">You might also like</h2>
        </div>
        <Link href={`/category/${encodeURIComponent(product.category.slug)}`}>
          View collection
        </Link>
      </div>
      <div className="products-grid">
        {related.map((item) => (
          <ProductCard key={item.id} product={item} />
        ))}
      </div>
    </section>
  );
}
async function Content({ params }: Props) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  if (product.slug !== slug)
    permanentRedirect(`/product/${encodeURIComponent(product.slug)}`);
  const specifications = [
    ["Brand", product.brand],
    ["SKU", product.sku],
    ["Barcode", product.barcode],
    ["Category", product.category?.name],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  return (
    <main id="main" className="container main-content pdp-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productStructuredData(product)).replace(
            /</g,
            "\\u003c",
          ),
        }}
      />
      <nav className="breadcrumbs pdp-breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/">Home</Link>
          </li>
          <li>
            <Link href="/shop">Shop</Link>
          </li>
          {product.category && (
            <li>
              <Link
                href={`/category/${encodeURIComponent(product.category.slug)}`}
              >
                {product.category.name}
              </Link>
            </li>
          )}
          <li aria-current="page">{product.name}</li>
        </ol>
      </nav>
      <ProductFeedbackProvider key={product.id}>
      <ProductOverview key={product.id} product={product} />
      <div className="pdp-details-layout grid grid-cols-1 lg:grid-cols-[1.25fr_0.75fr] gap-8 mt-10">
        {/* Left: About & Specifications */}
        <div className="space-y-6">
          <section
            id="product-details"
            className="shop-panel pdp-details p-6 sm:p-8 rounded-2xl bg-[var(--glass-solid)] border border-[var(--c-line)] shadow-xs"
            aria-labelledby="details-title"
          >
            <p className="eyebrow text-xs font-bold uppercase tracking-wider text-[var(--c-muted)] mb-2">The details</p>
            <h2 id="details-title" className="text-xl sm:text-2xl font-bold text-[var(--c-ink)] mb-4">About this product</h2>
            <ProductRichTextRenderer content={product.description || product.shortDescription || "Have a question about this product? Contact our team before ordering."} />

            {specifications.length > 0 && (
              <div className="mt-8 pt-6 border-t border-[var(--c-line)]">
                <h3 className="text-base font-bold text-[var(--c-ink)] mb-3">Product specifications</h3>
                <dl className="pdp-specifications divide-y divide-[var(--c-line)] border border-[var(--c-line)] rounded-xl overflow-hidden text-xs sm:text-sm">
                  {specifications.map(([label, value]) => (
                    <div key={label} className="flex justify-between py-3 px-4 odd:bg-black/[0.02] dark:odd:bg-white/[0.02]">
                      <dt className="text-[var(--c-muted)] font-medium">{label}</dt>
                      <dd className="font-semibold text-[var(--c-ink)] m-0 text-right">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </section>
        </div>

        {/* Right: Delivery & Support Accordions */}
        <section
          className="shop-panel pdp-help p-6 sm:p-7 rounded-2xl bg-[var(--glass-solid)] border border-[var(--c-line)] shadow-xs h-fit space-y-4"
          aria-labelledby="delivery-title"
        >
          <div>
            <p className="eyebrow text-xs font-bold uppercase tracking-wider text-[var(--c-muted)] mb-1">Good to know</p>
            <h2 id="delivery-title" className="text-xl font-bold text-[var(--c-ink)] m-0">Delivery & support</h2>
          </div>

          <div className="space-y-3 pt-2">
            <details open className="group border border-[var(--c-line)] rounded-xl p-3.5 bg-[var(--glass)] transition-all">
              <summary className="cursor-pointer font-bold text-xs sm:text-sm text-[var(--c-ink)] flex items-center justify-between select-none list-none">
                <span className="flex items-center gap-2">🚚 Delivery and payment</span>
                <span className="text-xs transition-transform group-open:rotate-180">▼</span>
              </summary>
              <p className="text-xs text-[var(--c-ink-2)] mt-2.5 mb-0 leading-relaxed">
                Review delivery charges and enabled payment methods at checkout before placing your order.
              </p>
            </details>

            <details className="group border border-[var(--c-line)] rounded-xl p-3.5 bg-[var(--glass)] transition-all">
              <summary className="cursor-pointer font-bold text-xs sm:text-sm text-[var(--c-ink)] flex items-center justify-between select-none list-none">
                <span className="flex items-center gap-2">🔄 Returns and product questions</span>
                <span className="text-xs transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="text-xs text-[var(--c-ink-2)] mt-2.5 space-y-2 leading-relaxed">
                <p className="m-0">
                  Contact the store to confirm return eligibility for this product. Include your order number when requesting support.
                </p>
                <Link href="/contact" className="inline-block text-xs font-bold underline hover:text-emerald-600">
                  Contact DS Mart support →
                </Link>
              </div>
            </details>

            <details className="group border border-[var(--c-line)] rounded-xl p-3.5 bg-[var(--glass)] transition-all">
              <summary className="cursor-pointer font-bold text-xs sm:text-sm text-[var(--c-ink)] flex items-center justify-between select-none list-none">
                <span className="flex items-center gap-2">📦 Tracking your order</span>
                <span className="text-xs transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="text-xs text-[var(--c-ink-2)] mt-2.5 space-y-2 leading-relaxed">
                <p className="m-0">
                  View order updates from your account or the same browser used for guest checkout.
                </p>
                <Link href="/orders" className="inline-block text-xs font-bold underline hover:text-emerald-600">
                  Track order status →
                </Link>
              </div>
            </details>
          </div>

          <div className="pt-2">
            <Link className="pdp-help-link text-xs font-bold text-[var(--c-ink)] hover:underline inline-flex items-center gap-1" href="/help">
              More shopping help & FAQs ↗
            </Link>
          </div>
        </section>
      </div>

      <div id="customer-reviews" className="scroll-mt-24 pt-6">
        <ProductReviewsSection
          productId={product.id}
          productName={product.name}
        />
      </div>
      </ProductFeedbackProvider>
      <Suspense fallback={null}>
        <RelatedProducts product={product} />
      </Suspense>
    </main>
  );
}
export default function Page(props: Props) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}