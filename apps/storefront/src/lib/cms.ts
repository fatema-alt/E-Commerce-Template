import { cache } from "react";
import type { ContactSettings, RibbonSettings } from "./engagement";
import {
  fallbackConfig,
  imageUrl,
  product,
  type StorefrontConfig,
  type Product,
} from "./storefront";
export type MenuItem = {
  id: string;
  label: string;
  href: string;
  children?: MenuItem[];
};
export type Asset = { id: string; url: string | null; altText: string | null };
export type Image = { assetId: string; alt: string; href?: string };
export type Section = {
  id: string;
  type: string;
  visible: boolean;
  responsive?: {
    desktop?: boolean;
    tablet?: boolean;
    mobile?: boolean;
    width?: string;
    padding?: number;
  };
  config: Record<string, unknown>;
};
export type CmsPage = {
  title: string;
  seo?: {
    title?: string;
    description?: string;
    canonicalUrl?: string;
    noIndex?: boolean;
  };
  sections: Section[];
};
export type Settings = {
  announcementRibbon?: RibbonSettings;
  contactWidget?: ContactSettings;
  homePageKey?: string;
  storeName?: string;
  tagline?: string;
  locale?: string;
  currency?: string;
  logoAssetId?: string;
  faviconAssetId?: string;
  announcement?: { enabled: boolean; text: string; href?: string };
  header?: {
    layout: string;
    searchPlacement: string;
    menuKey?: string;
    categoryMenuKey?: string;
  };
  footer?: {
    columns: { title: string; menuKey: string }[];
    copyright?: string;
  };
  contact?: { email?: string; phone?: string; address?: string };
  socialLinks?: { label: string; href: string }[];
  legalLinks?: { label: string; href: string }[];
};
type Published<T> = { content: T; assets: Asset[]; version: number };
const base = (
  process.env.STOREFRONT_API_BASE_URL || "http://localhost:4000/api/v1"
).replace(/\/$/, "");
const keyPattern = /^[a-z0-9][a-z0-9_-]{0,63}$/;
export const published = cache(
  async <T>(kind: string, key: string): Promise<Published<T> | null> => {
    if (!keyPattern.test(key)) return null;
    const response = await fetch(`${base}/storefront/cms/${kind}/${key}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 404) return null;
    if (!response.ok)
      throw new Error(
        "Published storefront content is temporarily unavailable",
      );
    return response.json();
  },
);
export type CmsConfig = StorefrontConfig & {
  renderedAt?: number;
  settings: Settings;
  tokens: Record<string, string | number>;
  menus: Record<string, MenuItem[]>;
  assets: Asset[];
};
export const getCmsConfig = cache(async (): Promise<CmsConfig> => {
  const [settingsDoc, themeDoc] = await Promise.all([
    published<Settings>(
      "SITE_SETTINGS",
      process.env.CMS_SETTINGS_KEY || "default",
    ),
    published<Record<string, string | number>>(
      "THEME",
      process.env.CMS_THEME_KEY || "default",
    ),
  ]);
  const settings = settingsDoc?.content ?? {};
  const tokens = {
    ...themeDoc?.content,
    primary: fallbackConfig.theme.primary,
    background: fallbackConfig.theme.background,
    heading: fallbackConfig.theme.foreground,
    surface: "#FFFFFF",
    secondarySurface: "#FFFFFF",
    border: fallbackConfig.theme.border,
    accent: "#E8F7FF",
    text: "#243B56",
    muted: "#60738A",
    secondary: "#00AEEF",
  };
  const menuKeys = [
    ...new Set(
      [
        settings.header?.menuKey || "main",
        settings.header?.categoryMenuKey,
        ...(settings.footer?.columns.map((column) => column.menuKey) ?? []),
      ].filter((key): key is string => Boolean(key)),
    ),
  ];
  const entries = await Promise.all(
    menuKeys.map(
      async (key) =>
        [
          key,
          (await published<{ items: MenuItem[] }>("NAVIGATION", key))?.content
            .items ?? [],
        ] as const,
    ),
  );
  const menus = Object.fromEntries(entries);
  return {
    ...fallbackConfig,
    renderedAt: Date.now(),
    siteName: fallbackConfig.siteName,
    announcement: settingsDoc
      ? settings.announcement?.enabled
        ? settings.announcement.text
        : undefined
      : fallbackConfig.announcement,
    navigation: menus[settings.header?.menuKey || "main"] ?? [],
    footerNavigation: settings.legalLinks ?? [],
    theme: {
      primary: String(tokens.primary || fallbackConfig.theme.primary),
      background: String(tokens.background || fallbackConfig.theme.background),
      foreground: String(tokens.heading || fallbackConfig.theme.foreground),
      surface: String(tokens.secondarySurface || fallbackConfig.theme.surface),
      border: String(tokens.border || fallbackConfig.theme.border),
    },
    settings,
    tokens,
    menus,
    assets: settingsDoc?.assets ?? [],
  };
});
export const getCmsPage = (key: string) => published<CmsPage>("PAGE", key);
export const getHomePage = cache(async () => {
  const config = await getCmsConfig();
  return getCmsPage(
    config.settings.homePageKey || process.env.CMS_HOME_KEY || "home",
  );
});
export function assetSource(assets: Asset[], id?: string) {
  return imageUrl(assets.find((asset) => asset.id === id)?.url);
}
export async function sectionProducts(
  config: Record<string, unknown>,
): Promise<Product[]> {
  const query = new URLSearchParams({
    pageSize: String(Math.min(100, Math.max(1, Number(config.limit) || 12))),
    source: String(config.source || "latest"),
  });
  if (typeof config.categoryId === "string")
    query.set("categoryId", config.categoryId);
  if (Array.isArray(config.productIds))
    query.set("ids", config.productIds.join(","));
  const response = await fetch(`${base}/storefront/products?${query}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok)
    throw new Error("Storefront products are temporarily unavailable");
  const data = await response.json();
  return (data.items as unknown[])
    .map(product)
    .filter((item): item is Product => item !== null);
}
export function safeHref(href?: string) {
  if (!href || /[\u0000-\u0020\u007f\\]/.test(href)) return undefined;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const url = new URL(href);
    if (url.protocol === "https:" && !url.username && !url.password)
      return href;
  } catch {}
  return undefined;
}
