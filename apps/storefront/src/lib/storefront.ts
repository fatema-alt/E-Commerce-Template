/** Public catalog contracts and first-run storefront defaults. */
import { cache } from "react";
export type NavItem = { label: string; href: string };
export type Category = {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  parentId?: string | null;
};
export type Product = {
  type?: "SIMPLE" | "VARIABLE";
  id: string;
  slug: string;
  name: string;
  imageUrl?: string | null;
  price: number;
  compareAtPrice?: number | null;
  currency: "BDT";
  inStock: boolean;
  brand?: string | null;
  availableStock: number;
  description?: string | null;
  shortDescription?: string | null;
  sku?: string;
  barcode?: string;
  category?: Category;
  metaTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
  socialTitle?: string;
  socialDescription?: string;
  socialImage?: string | null;
  images?: {
    url: string;
    altText?: string | null;
    variantId?: string | null;
    isPrimary?: boolean;
  }[];
  variants?: {
    id: string;
    name: string;
    availableStock: number;
    price: number;
    compareAtPrice?: number | null;
    sku?: string;
    isDefault?: boolean;
    attributes?: Record<string, string>;
  }[];
};
export type HeroBlock = {
  type: "hero";
  id: string;
  eyebrow?: string;
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
};
export type CategoriesBlock = { type: "categories"; id: string; title: string };
export type ProductsBlock = { type: "products"; id: string; title: string };
export type ContentBlock = HeroBlock | CategoriesBlock | ProductsBlock;
export type StorefrontConfig = {
  siteName: string;
  announcement?: string;
  navigation: NavItem[];
  footerNavigation: NavItem[];
  theme: {
    primary: string;
    background: string;
    foreground: string;
    surface: string;
    border: string;
  };
  home: ContentBlock[];
};
export const fallbackConfig: StorefrontConfig = {
  siteName: "DS Mart",
  announcement: "Shop smart. Live smart. Welcome to DS Mart.",
  navigation: [
    { label: "Shop all", href: "/categories" },
    { label: "Electronics", href: "/category/electronics" },
    { label: "Fashion", href: "/category/fashion" },
    { label: "Home & Living", href: "/category/home-living" },
    { label: "Beauty", href: "/category/beauty" },
    { label: "Groceries", href: "/category/groceries" },
  ],
  footerNavigation: [
    { label: "About", href: "/about" },
    { label: "Help", href: "/help" },
    { label: "Delivery information", href: "/policies/delivery" },
    { label: "Returns", href: "/policies/returns" },
  ],
  theme: {
    primary: "#0076AB",
    background: "#F5F8FC",
    foreground: "#0B2344",
    surface: "#FFFFFF",
    border: "#DFE8F2",
  },
  home: [
    {
      type: "hero",
      id: "hero",
      eyebrow: "YOUR EVERYDAY, UPGRADED",
      title: "Shop smart. Live smart.",
      description:
        "From your next favourite gadget to the little things for home. Discover more of what you love, all at DS Mart.",
      ctaHref: "/shop",
      ctaLabel: "Start shopping",
    },
    { type: "categories", id: "departments", title: "Explore our departments" },
    { type: "products", id: "latest", title: "Latest products" },
  ],
};
function record(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}
/** API base includes /api/v1; server-side only. */
const apiBase = (
  process.env.STOREFRONT_API_BASE_URL || "http://localhost:4000/api/v1"
).replace(/\/$/, "");
async function getJson(path: string): Promise<unknown> {
  try {
    const response = await fetch(`${apiBase}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
function asDecimal(v: unknown): number | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(String(v))) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
export function imageUrl(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  if (/^https:\/\//.test(v)) return v;
  if (v.startsWith("/uploads/")) {
    try {
      return new URL(v, new URL(apiBase).origin).toString();
    } catch {
      return null;
    }
  }
  return null;
}
function category(v: unknown): Category | null {
  if (
    !record(v) ||
    typeof v.id !== "string" ||
    typeof v.name !== "string" ||
    typeof v.slug !== "string"
  )
    return null;
  return {
    id: v.id,
    name: v.name,
    slug: v.slug,
    imageUrl: imageUrl(v.imageUrl),
    parentId: typeof v.parentId === "string" ? v.parentId : null,
  };
}
export function product(v: unknown): Product | null {
  if (
    !record(v) ||
    typeof v.id !== "string" ||
    typeof v.name !== "string" ||
    typeof v.slug !== "string" ||
    v.currency !== "BDT"
  )
    return null;
  const price = asDecimal(v.effectivePrice);
  if (price === null) return null;
  const normal = asDecimal(v.price);
  const availableStock =
    typeof v.availableStock === "number" &&
    Number.isSafeInteger(v.availableStock)
      ? Math.max(0, v.availableStock)
      : 0;
  const images = Array.isArray(v.images)
    ? v.images
        .filter(record)
        .map((i) => ({
          url: imageUrl(i.url),
          altText: typeof i.altText === "string" ? i.altText : null,
          variantId: typeof i.variantId === "string" ? i.variantId : null,
          isPrimary: i.isPrimary === true,
        }))
        .filter((i): i is typeof i & { url: string } => i.url !== null)
    : [];
  const variants =
    v.type !== "SIMPLE" && Array.isArray(v.variants)
      ? v.variants
          .filter(record)
          .filter((i) => typeof i.id === "string" && typeof i.name === "string")
          .map((i) => ({
            id: i.id as string,
            name: i.name as string,
            availableStock:
              typeof i.availableStock === "number" &&
              Number.isSafeInteger(i.availableStock)
                ? Math.max(0, i.availableStock)
                : 0,
            price: asDecimal(i.salePrice) ?? asDecimal(i.price) ?? price,
            compareAtPrice:
              asDecimal(i.salePrice) !== null &&
              (asDecimal(i.price) ?? 0) > (asDecimal(i.salePrice) ?? 0)
                ? asDecimal(i.price)
                : null,
            sku: typeof i.sku === "string" ? i.sku : undefined,
            isDefault: i.isDefault === true,
            attributes: record(i.attributes)
              ? Object.fromEntries(
                  Object.entries(i.attributes).filter(
                    (entry): entry is [string, string] =>
                      typeof entry[1] === "string",
                  ),
                )
              : {},
          }))
      : [];
  return {
    type:
      v.type === "VARIABLE" || (v.type !== "SIMPLE" && variants.length > 0)
        ? "VARIABLE"
        : "SIMPLE",
    id: v.id,
    name: v.name,
    slug: v.slug,
    imageUrl:
      (images.find((image) => image.isPrimary) ?? images[0])?.url ?? null,
    images: [...images].sort(
      (a, b) => Number(b.isPrimary) - Number(a.isPrimary),
    ),
    price,
    compareAtPrice: normal !== null && normal > price ? normal : null,
    currency: "BDT",
    inStock: availableStock > 0,
    availableStock,
    brand: typeof v.brand === "string" ? v.brand : null,
    description: typeof v.description === "string" ? v.description : null,
    shortDescription:
      typeof v.shortDescription === "string" ? v.shortDescription : null,
    sku: typeof v.sku === "string" ? v.sku : undefined,
    barcode: typeof v.barcode === "string" ? v.barcode : undefined,
    category: category(v.category) ?? undefined,
    metaTitle: typeof v.metaTitle === "string" ? v.metaTitle : undefined,
    metaDescription:
      typeof v.metaDescription === "string" ? v.metaDescription : undefined,
    canonicalUrl:
      typeof v.canonicalUrl === "string" ? v.canonicalUrl : undefined,
    noIndex: v.noIndex === true,
    socialTitle: typeof v.socialTitle === "string" ? v.socialTitle : undefined,
    socialDescription:
      typeof v.socialDescription === "string" ? v.socialDescription : undefined,
    socialImage: imageUrl(v.socialImage),
    variants,
  };
}
export { getCmsConfig as getConfig } from "./cms";
export async function getCategories(ids?: string[]): Promise<Category[]> {
  const x = await getJson(
    "/storefront/categories?pageSize=100" +
      (ids?.length ? "&ids=" + encodeURIComponent(ids.join(",")) : ""),
  );
  return Array.isArray(x)
    ? x.map(category).filter((v): v is Category => v !== null)
    : [];
}
export async function getProductPage(
  opts: {
    page?: number;
    pageSize?: number;
    search?: string;
    categoryId?: string;
    sort?: string;
    min?: string;
    max?: string;
  } = {},
): Promise<{ items: Product[]; total: number; page: number }> {
  const qs = new URLSearchParams({
    page: String(opts.page ?? 1),
    pageSize: String(opts.pageSize ?? 24),
  });
  if (opts.search) qs.set("search", opts.search);
  if (opts.categoryId) qs.set("categoryId", opts.categoryId);
  if (opts.sort === "price-asc" || opts.sort === "price-desc") {
    qs.set("sortBy", "price");
    qs.set("sortDirection", opts.sort === "price-asc" ? "asc" : "desc");
  }
  if (opts.sort === "name") {
    qs.set("sortBy", "name");
    qs.set("sortDirection", "asc");
  }
  if (opts.min) qs.set("minPrice", opts.min);
  if (opts.max) qs.set("maxPrice", opts.max);
  const x = await getJson(`/storefront/products?${qs}`);
  if (!record(x) || !Array.isArray(x.items))
    return { items: [], total: 0, page: opts.page ?? 1 };
  return {
    items: x.items.map(product).filter((v): v is Product => v !== null),
    total: typeof x.total === "number" ? x.total : 0,
    page: opts.page ?? 1,
  };
}
export async function getFeaturedProducts(): Promise<Product[]> {
  return (await getProductPage({ pageSize: 20 })).items;
}
export const getProduct = cache(
  async (slug: string): Promise<Product | null> => {
    if (!slug || slug.length > 180) return null;
    const response = await fetch(
      `${apiBase}/storefront/products/${encodeURIComponent(slug)}`,
      { cache: "no-store", signal: AbortSignal.timeout(8000) },
    );
    if (response.status === 404) return null;
    if (!response.ok)
      throw new Error("Product details are temporarily unavailable.");
    const result = product(await response.json());
    if (!result)
      throw new Error("Product details are temporarily unavailable.");
    return result;
  },
);
export async function getCategory(slug: string): Promise<Category | null> {
  if (!slug || slug.length > 180) return null;
  return category(
    await getJson(`/storefront/categories/${encodeURIComponent(slug)}`),
  );
}
