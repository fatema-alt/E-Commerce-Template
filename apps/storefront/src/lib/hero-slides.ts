import { assetSource, safeHref, type Asset, type Image } from "./cms";
import { imageUrl, type HeroBlock } from "./storefront";

export type CustomTheme = { bg: string; text: string; accent: string };
export type ThemePreset = "dark" | "lime" | "light" | "custom";
export type ImageBackdrop = "none" | "circle" | "lime_ring";

export type HeroSlide = {
  id: string;
  imageSrc: string;
  alt: string;
  href?: string;
  themePreset?: ThemePreset;
  gradient?: string;
  customTheme?: CustomTheme;
  imageBackdrop?: ImageBackdrop;
};

const DEFAULT_HERO_IMAGE = "/brand/hero-banner-main.png";

export function heroSlides(
  config: Record<string, unknown> = {},
  assets: Asset[] = [],
  block?: HeroBlock,
): HeroSlide[] {
  const rows = Array.isArray(config.slides) && config.slides.length > 0
    ? (config.slides as Record<string, unknown>[])
    : [{
        imageSrc: DEFAULT_HERO_IMAGE,
        href: "/shop",
        alt: "Shop Smart. Live Smart.",
      }];

  const validSlides = rows
    .filter((row) => row.enabled !== false)
    .map((row, index) => {
      const image = row.image as (Image & { url?: string }) | undefined;

      // Resolve image source with prioritized fallbacks
      let imageSrc = "";
      if (typeof row.imageUrl === "string" && row.imageUrl.trim()) {
        imageSrc = imageUrl(row.imageUrl.trim()) || row.imageUrl.trim();
      } else if (typeof row.imageSrc === "string" && row.imageSrc.trim()) {
        imageSrc = imageUrl(row.imageSrc.trim()) || row.imageSrc.trim();
      } else if (typeof row.image === "string" && row.image.trim()) {
        imageSrc = imageUrl(row.image.trim()) || row.image.trim();
      } else if (image?.url) {
        imageSrc = imageUrl(image.url) || image.url;
      } else if (image?.assetId) {
        imageSrc = assetSource(assets, image.assetId) || "";
      }

      // If still empty, fall back to default banner
      if (!imageSrc) {
        imageSrc = DEFAULT_HERO_IMAGE;
      }

      const href = safeHref(
        (row.href as string) ||
        (row.bannerLink as string) ||
        (row.ctaHref as string) ||
        (row.button as { href?: string })?.href ||
        block?.ctaHref ||
        "/shop"
      );

      const colors: Record<string, string> = { lime: "#eef5d5", blue: "#dff3fc", pink: "#fae6ef" };
      const customGrad = typeof row.backgroundGradient === "string" && /^(linear|radial)-gradient\([#%(),.\s\w-]+\)$/.test(row.backgroundGradient) ? row.backgroundGradient : undefined;

      let themePreset: ThemePreset = "light";
      if (["dark", "lime", "light", "custom"].includes(String(row.themePreset))) {
        themePreset = row.themePreset as ThemePreset;
      } else if (row.theme === "lime") {
        themePreset = "lime";
      }

      const customThemeRaw = row.customTheme as Record<string, unknown> | undefined;
      const customTheme: CustomTheme | undefined = (themePreset === "custom" && customThemeRaw &&
        typeof customThemeRaw.bg === "string" && /^#[0-9a-fA-F]{6}$/.test(customThemeRaw.bg) &&
        typeof customThemeRaw.text === "string" && /^#[0-9a-fA-F]{6}$/.test(customThemeRaw.text) &&
        typeof customThemeRaw.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(customThemeRaw.accent))
        ? { bg: customThemeRaw.bg, text: customThemeRaw.text, accent: customThemeRaw.accent }
        : undefined;

      const imageBackdrop: ImageBackdrop = ["none", "circle", "lime_ring"].includes(String(row.imageBackdrop))
        ? (row.imageBackdrop as ImageBackdrop)
        : "none";

      const gradient = customGrad || (row.theme && colors[String(row.theme)] ? `linear-gradient(115deg, ${colors[String(row.theme)]}, var(--glass-solid))` : undefined);

      return {
        id: `hero-${index}`,
        imageSrc,
        alt: String(row.alt || row.title || `Hero banner ${index + 1}`),
        href,
        themePreset,
        gradient,
        customTheme,
        imageBackdrop,
      };
    });

  return validSlides.length > 0
    ? validSlides
    : [
        {
          id: "hero-default",
          imageSrc: DEFAULT_HERO_IMAGE,
          alt: "Shop Smart. Live Smart.",
          href: "/shop",
        },
      ];
}
