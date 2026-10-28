export const RESERVED_PAGE_ROUTES = new Set([
  "api",
  "account",
  "cart",
  "checkout",
  "shop",
  "search",
  "category",
  "categories",
  "product",
  "products",
  "orders",
  "wishlist",
  "contact",
  "help",
  "cms",
  "admin",
  "login",
  "robots",
  "sitemap",
  "icon",
  "favicon",
  "_next",
  "_not-found",
]);
export function pageSlug(title: string) {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64)
    .replace(/-$/, "");
  if (slug) return slug;
  if (!title.trim()) return "";
  let hash = 2166136261;
  for (const char of title.trim())
    hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619);
  return "page-" + (hash >>> 0).toString(36);
}
export function validPageSlug(value: string) {
  return (
    /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value) && !RESERVED_PAGE_ROUTES.has(value)
  );
}
