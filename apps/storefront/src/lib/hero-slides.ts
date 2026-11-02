import { assetSource, safeHref, type Asset, type Image } from "./cms";
import type { HeroBlock } from "./storefront";

export type HeroSlide = {
  id: string;
  imageSrc: string;
  alt: string;
  href?: string;
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
        imageSrc = row.imageUrl.trim();
      } else if (typeof row.imageSrc === "string" && row.imageSrc.trim()) {
        imageSrc = row.imageSrc.trim();
      } else if (typeof row.image === "string" && row.image.trim()) {
        imageSrc = row.image.trim();
      } else if (image?.url) {
        imageSrc = image.url;
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

      return {
        id: `hero-${index}`,
        imageSrc,
        alt: String(row.alt || row.title || `Hero banner ${index + 1}`),
        href,
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
