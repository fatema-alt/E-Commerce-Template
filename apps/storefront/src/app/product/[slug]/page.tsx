import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, permanentRedirect, unstable_rethrow } from "next/navigation";
import {
  getProduct,
  getProductPage,
  type Product,
} from "../../../lib/storefront";
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
      product.description ||
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
      <ProductOverview key={product.id} product={product} />
      <div className="pdp-details-layout">
        <section
          id="product-details"
          className="shop-panel pdp-details"
          aria-labelledby="details-title"
        >
          <p className="eyebrow">The details</p>
          <h2 id="details-title">About this product</h2>
          <p className="pdp-description">
            {product.description ||
              product.shortDescription ||
              "Have a question about this product? Contact our team before ordering and we’ll help you choose."}
          </p>
          {specifications.length > 0 && (
            <>
              <h3>Product information</h3>
              <dl className="pdp-specifications">
                {specifications.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </section>
        <section
          className="shop-panel pdp-help"
          aria-labelledby="delivery-title"
        >
          <p className="eyebrow">Good to know</p>
          <h2 id="delivery-title">Delivery & support</h2>
          <details open>
            <summary>Delivery and payment</summary>
            <p>
              Enter your delivery address at checkout to see the shipping
              charge, available payment methods and final order total before
              confirming.
            </p>
          </details>
          <details>
            <summary>Returns and product questions</summary>
            <p>
              Contact our team for return eligibility, product information or
              help with an existing order. Include your order number if you have
              one.
            </p>
            <Link href="/contact">Contact DS Mart</Link>
          </details>
          <details>
            <summary>Tracking your order</summary>
            <p>
              Signed-in customers can view account orders. For a guest order,
              use the browser you placed it from.
            </p>
            <Link href="/orders">View your orders</Link>
          </details>
          <Link className="pdp-help-link" href="/help">
            More shopping help ↗
          </Link>
        </section>
      </div>
      <ProductReviewsSection
        productId={product.id}
        productName={product.name}
      />
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