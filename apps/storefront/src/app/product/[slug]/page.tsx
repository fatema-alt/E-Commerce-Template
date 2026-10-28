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
import "./product-page.css";

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
    <section className="pp-related" aria-labelledby="related-title">
      <div className="pp-related-head">
        <h2 id="related-title">More from {product.category.name}</h2>
        <Link href={`/category/${encodeURIComponent(product.category.slug)}`}>
          View collection
        </Link>
      </div>
      <div className="pp-rail" role="list" tabIndex={0} aria-label="Related products">
        {related.map((item) => (
          <div role="listitem" key={item.id}>
            <ProductCard product={item} />
          </div>
        ))}
      </div>
    </section>
  );
}

const paths = {
  truck: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 018 0v3",
  chat: "M4 5h16v11H9l-5 4z",
  pin: "M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11zM12 12a2 2 0 100-4 2 2 0 000 4z",
  swap: "M4 8h14l-3-3M20 16H6l3 3",
  chev: "M6 9l6 6 6-6",
};
function Icon({ name, className }: { name: keyof typeof paths; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

const promises = [
  { icon: "truck", title: "Delivery at checkout", text: "See charges before you pay." },
  { icon: "lock", title: "Pay your way", text: "Enabled payment methods show at checkout." },
  { icon: "chat", title: "Ask before ordering", text: "Our team can answer product questions." },
  { icon: "pin", title: "Order tracking", text: "Updates in your account or checkout browser." },
] as const;

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
    <main id="main" className="container main-content pdp-page pp">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productStructuredData(product)).replace(/</g, "\\u003c"),
        }}
      />
      <nav className="pp-crumbs" aria-label="Breadcrumb">
        <ol>
          <li><Link href="/">Home</Link></li>
          <li><Link href="/shop">Shop</Link></li>
          {product.category && (
            <li>
              <Link href={`/category/${encodeURIComponent(product.category.slug)}`}>
                {product.category.name}
              </Link>
            </li>
          )}
          <li aria-current="page">{product.name}</li>
        </ol>
      </nav>

      <ProductFeedbackProvider key={product.id}>
        <ProductOverview key={product.id} product={product} />

        <ul className="pp-promises" aria-label="Shopping at DS Mart">
          {promises.map((p) => (
            <li className="pp-promise" key={p.title}>
              <Icon name={p.icon} />
              <div><b>{p.title}</b><span>{p.text}</span></div>
            </li>
          ))}
        </ul>

        <nav className="pp-jump" aria-label="Product sections">
          <a href="#product-details">About</a>
          {specifications.length > 0 && <a href="#product-specs">Specs</a>}
          <a href="#delivery-title">Delivery & support</a>
          <a href="#customer-reviews">Reviews</a>
        </nav>

        <div className="pp-layout">
          <section id="product-details" className="pp-about" aria-labelledby="details-title">
            <h2 id="details-title">About this product</h2>
            <ProductRichTextRenderer
              content={
                product.description ||
                product.shortDescription ||
                "Have a question about this product? Contact our team before ordering."
              }
            />
          </section>

          <aside className="pp-side">
            {specifications.length > 0 && (
              <section id="product-specs" className="pp-ticket" aria-labelledby="specs-title">
                <div className="pp-ticket-head">
                  <h2 id="specs-title">Product facts</h2>
                  <span>{product.name.slice(0, 22)}{product.name.length > 22 ? "…" : ""}</span>
                </div>
                <dl>
                  {specifications.map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            <section className="pp-help" aria-labelledby="delivery-title">
              <h2 id="delivery-title">Delivery & support</h2>
              <details name="pp-help" open>
                <summary>
                  <Icon name="truck" />Delivery and payment
                  <Icon name="chev" className="pp-chev" />
                </summary>
                <div className="pp-body">
                  <p>Review delivery charges and enabled payment methods at checkout before placing your order.</p>
                </div>
              </details>
              <details name="pp-help">
                <summary>
                  <Icon name="swap" />Returns and questions
                  <Icon name="chev" className="pp-chev" />
                </summary>
                <div className="pp-body">
                  <p>Questions about returns? Contact our team.</p>
                  <Link href="/contact">Contact DS Mart support</Link>
                </div>
              </details>
              <details name="pp-help">
                <summary>
                  <Icon name="pin" />Tracking your order
                  <Icon name="chev" className="pp-chev" />
                </summary>
                <div className="pp-body">
                  <p>View order updates from your account or the same browser used for guest checkout.</p>
                  <Link href="/orders">Track order status</Link>
                </div>
              </details>
              <Link className="pp-help-foot" href="/help">More shopping help and FAQs</Link>
            </section>
          </aside>
        </div>

        <div id="customer-reviews" className="pp-reviews">
          <ProductReviewsSection productId={product.id} productName={product.name} />
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
