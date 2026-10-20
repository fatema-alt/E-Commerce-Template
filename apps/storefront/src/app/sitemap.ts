import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getCmsConfig } from "../lib/cms";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const origin = (
    process.env.STOREFRONT_ORIGIN || "http://localhost:3000"
  ).replace(/\/$/, "");
  const api = (
    process.env.STOREFRONT_API_BASE_URL || "http://localhost:4000/api/v1"
  ).replace(/\/$/, "");
  const result: MetadataRoute.Sitemap = [
    "/",
    "/shop",
    "/categories",
    "/contact",
    "/help",
  ].map((path) => ({ url: origin + path }));
  const config = await getCmsConfig();
  const homeKey =
    config.settings.homePageKey || process.env.CMS_HOME_KEY || "home";
  for (let page = 1; page <= 200; page++) {
    const response = await fetch(
      `${api}/storefront/sitemap?page=${page}&pageSize=100`,
      { cache: "no-store", signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok) throw new Error("Sitemap data unavailable");
    const rows = (await response.json()) as {
      entity: string;
      slug: string;
      updatedAt: string;
    }[];
    for (const row of rows)
      result.push({
        url: `${origin}/${row.entity === "product" ? "product" : "category"}/${encodeURIComponent(row.slug)}`,
        lastModified: new Date(row.updatedAt),
      });
    if (rows.length < 100) break;
  }
  const reserved = new Set([
    "shop",
    "categories",
    "contact",
    "help",
    "account",
    "cart",
    "checkout",
    "orders",
    "wishlist",
    "search",
  ]);
  for (let page = 1; page <= 200; page++) {
    const response = await fetch(
      `${api}/storefront/cms/pages?page=${page}&limit=100`,
      { cache: "no-store", signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok) throw new Error("CMS sitemap unavailable");
    const data = (await response.json()) as {
      items: { key: string; publishedAt: string }[];
      hasMore: boolean;
    };
    for (const row of data.items)
      if (row.key !== homeKey && !reserved.has(row.key))
        result.push({
          url: `${origin}/${encodeURIComponent(row.key)}`,
          lastModified: row.publishedAt ? new Date(row.publishedAt) : undefined,
        });
    if (!data.hasMore) break;
  }
  return result;
}
