import type { Value } from "./cms-api";

// Promote hero into an editable list with image and href options
export function editableHeroSlides(config: Record<string, Value>): Value[] {
  if (Array.isArray(config.slides) && config.slides.length > 0) {
    return structuredClone(config.slides);
  }
  return [
    {
      id: "slide-1",
      enabled: true,
      imageUrl: (config.imageUrl as string) || (config.image as { url?: string })?.url || "/brand/hero-banner-main.png",
      image: config.image || { url: "/brand/hero-banner-main.png" },
      href: (config.bannerLink as string) || (config.href as string) || "/shop",
    },
  ];
}
