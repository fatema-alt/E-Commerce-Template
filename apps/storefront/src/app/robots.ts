import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const origin = process.env.STOREFRONT_ORIGIN || "http://localhost:3000";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/account",
        "/cart",
        "/checkout",
        "/orders",
        "/wishlist",
        "/search",
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
