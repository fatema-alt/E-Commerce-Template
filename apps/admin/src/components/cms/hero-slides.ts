import type { Value } from "./cms-api";

// Promote a legacy hero into an editable list without inventing campaign data.
export function editableHeroSlides(config: Record<string, Value>): Value[] {
  if (Array.isArray(config.slides)) return structuredClone(config.slides);
  const primary = Object.fromEntries(Object.entries(config).filter(([key]) => ["title", "subtitle", "image", "bannerLink", "button", "secondaryButton", "badge", "theme"].includes(key)));
  return [{ ...primary, title: config.title || "", enabled: true, slideType: config.bannerType === "without_button" ? "full_banner" : "split_content" }];
}
