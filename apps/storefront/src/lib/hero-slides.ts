import { assetSource, safeHref, type Asset, type Image } from "./cms";
import type { HeroBlock } from "./storefront";

type Button = { label: string; href: string };
export type HeroSlide = {
  id: string; type: "full_banner" | "split_content"; title: string; description: string;
  imageSrc: string | null; mobileSrc: string | null; alt: string; mobileAlt: string;
  href?: string; primary?: Button; secondary?: Button; gradient: string;
  badge?: string; badgeColor: string;
};
function button(value: unknown): Button | undefined {
  const data = value as Partial<Button> | undefined;
  const href = safeHref(data?.href);
  return data?.label && href ? { label: data.label, href } : undefined;
}
export function heroSlides(config: Record<string, unknown> = {}, assets: Asset[] = [], block?: HeroBlock): HeroSlide[] {
  // Legacy pages remain editable without manufacturing extra campaign slides.
  const rows = Array.isArray(config.slides) ? config.slides as Record<string, unknown>[] : [{
    ...config, title: config.title ?? block?.title, subtitle: config.subtitle ?? block?.description,
    button: config.button ?? (block?.ctaLabel ? { label: block.ctaLabel, href: block.ctaHref } : undefined),
  }];
  return rows.filter((row) => row.enabled !== false).map((row, index) => {
    const image = row.image as Image | undefined;
    const mobile = row.mobileImage as Image | undefined;
    const colors: Record<string, string> = { lime: "#eef5d5", blue: "#dff3fc", pink: "#fae6ef" };
    const custom = typeof row.backgroundGradient === "string" && /^(linear|radial)-gradient\([#%(),.\s\w-]+\)$/.test(row.backgroundGradient) ? row.backgroundGradient : undefined;
    return {
      id: `hero-${index}`,
      type: row.slideType === "full_banner" || (!row.slideType && (row.bannerType ?? config.bannerType) === "without_button") ? "full_banner" : "split_content",
      title: String(row.title || ""), description: String(row.subtitle || ""),
      imageSrc: assetSource(assets, image?.assetId), mobileSrc: assetSource(assets, mobile?.assetId),
      alt: image?.alt || String(row.title || "Featured offer"), mobileAlt: mobile?.alt || "",
      href: safeHref(row.bannerLink as string | undefined), primary: button(row.button), secondary: button(row.secondaryButton),
      badge: typeof row.badge === "string" ? row.badge : undefined,
      badgeColor: ["amber", "emerald", "purple"].includes(String(row.badgeColor)) ? String(row.badgeColor) : "amber",
      gradient: custom || `linear-gradient(115deg, ${colors[String(row.theme)] || colors.lime}, var(--glass-solid))`,
    };
  });
}
