import { productDescriptionText } from "@commerce/product-content";
import type { Product } from "./storefront";
export function publicUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function productUrl(product: Product) {
  const explicit = publicUrl(product.canonicalUrl);
  if (explicit) return explicit;
  const origin = publicUrl(process.env.STOREFRONT_ORIGIN);
  return origin
    ? new URL(`/product/${encodeURIComponent(product.slug)}`, origin).href
    : undefined;
}
export function productStructuredData(product: Product) {
  const url = productUrl(product);
  const choices = product.variants?.length
    ? product.variants
    : [
        {
          price: product.price,
          availableStock: product.availableStock,
          sku: product.sku,
        },
      ];
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(url ? { url } : {}),
    sku: product.sku,
    description: product.shortDescription || productDescriptionText(product.description) || undefined,
    image: product.images?.map((image) => image.url),
    ...(product.brand
      ? { brand: { "@type": "Brand", name: product.brand } }
      : {}),
    ...(product.category ? { category: product.category.name } : {}),
    offers: choices.map((choice) => ({
      "@type": "Offer",
      priceCurrency: "BDT",
      price: choice.price.toFixed(2),
      availability: `https://schema.org/${choice.availableStock > 0 ? "InStock" : "OutOfStock"}`,
      sku: choice.sku,
      seller: { "@type": "Organization", name: "DS Mart" },
      ...(url ? { url } : {}),
    })),
  };
}
