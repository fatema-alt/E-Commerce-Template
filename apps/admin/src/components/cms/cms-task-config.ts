import type { Value } from "./cms-api";
export const CMS_AREAS = [
  {
    id: "store",
    title: "Store info",
    href: "/cms/settings",
    kind: "SITE_SETTINGS",
  },
  { id: "look", title: "Look", href: "/cms/theme", kind: "THEME" },
  { id: "homepage", title: "Homepage", href: "/cms/homepage", kind: "PAGE" },
  { id: "pages", title: "Pages", href: "/cms/pages", kind: "PAGE" },
  { id: "menus", title: "Menus", href: "/cms/navigation", kind: "NAVIGATION" },
] as const;
export const THEME_PRESETS = [
  {
    name: "DS Fresh",
    description: "Blue and lime with clean rounded cards",
    values: {
      primary: "#00AEEF",
      background: "#F1F6F2",
      heading: "#101911",
      secondarySurface: "#E8F0EA",
      accent: "#D8F45A",
      fontFamily: "sans",
      headingFontFamily: "sans",
      buttonStyle: "solid",
    },
  },
  {
    name: "Warm Market",
    description: "Soft cream with forest green accents",
    values: {
      primary: "#48725C",
      background: "#F8F7F2",
      heading: "#203E33",
      secondarySurface: "#E5EFE6",
      accent: "#F3DED0",
      fontFamily: "system",
      headingFontFamily: "serif",
      buttonStyle: "soft",
    },
  },
  {
    name: "Modern Blue",
    description: "Cool neutrals and confident blue",
    values: {
      primary: "#2563EB",
      background: "#F8FAFC",
      heading: "#172554",
      secondarySurface: "#EFF6FF",
      accent: "#DBEAFE",
      fontFamily: "sans",
      headingFontFamily: "sans",
      buttonStyle: "solid",
    },
  },
  {
    name: "Quiet Minimal",
    description: "Neutral surfaces and understated buttons",
    values: {
      primary: "#334155",
      background: "#FFFFFF",
      heading: "#0F172A",
      secondarySurface: "#F1F5F9",
      accent: "#E2E8F0",
      fontFamily: "system",
      headingFontFamily: "system",
      buttonStyle: "outline",
    },
  },
] as const;
export function applyThemePreset(
  content: Record<string, Value>,
  preset: (typeof THEME_PRESETS)[number],
) {
  return { ...content, ...preset.values };
}
export const STORE_GROUPS = [
  {
    id: "identity",
    title: "Store identity",
    fields: ["storeName", "tagline", "logoAssetId", "faviconAssetId"],
  },
  {
    id: "contact",
    title: "Contact details",
    fields: ["contact", "socialLinks"],
  },
  {
    id: "announcements",
    title: "Announcement bar",
    fields: ["announcement", "announcementRibbon"],
  },
  {
    id: "contact-widget",
    title: "Floating contact widget",
    fields: ["contactWidget"],
  },
] as const;
