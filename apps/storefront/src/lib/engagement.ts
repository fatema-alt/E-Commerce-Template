export type AnnouncementItem = {
  id: string;
  enabled: boolean;
  text: string;
  device: "both" | "desktop" | "mobile";
  icon?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  startsAt?: string;
  endsAt?: string;
};
export type RibbonSettings = {
  enabled: boolean;
  animation: "fade" | "slide_up" | "slide_left" | "static";
  intervalSeconds: number;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  items: AnnouncementItem[];
};
export type ContactSettings = {
  enabled: boolean;
  title: string;
  description: string;
  statusText?: string;
  supportHours?: string;
  iconStyle?: "chat" | "headset";
  position: "right" | "left";
  desktop: boolean;
  mobile: boolean;
  whatsapp?: { enabled: boolean; number?: string; message?: string };
  phone?: { enabled: boolean; number?: string };
  email?: { enabled: boolean; address?: string };
  launcherColor?: string;
  accentColor?: string;
  panelColor?: string;
  iconColor?: string;
  lightPanelColor?: string;
  lightTextColor?: string;
  darkPanelColor?: string;
  darkTextColor?: string;
  borderRadius?: number;
  animation?: "none" | "subtle";
  excludedRoutes?: string[];
  delaySeconds?: number;
  closeOnOutsideClick?: boolean;
  rememberDismissal?: boolean;
};
export type EngagementSettings = {
  announcementRibbon?: RibbonSettings;
  contactWidget?: ContactSettings;
  announcement?: { enabled: boolean; text: string; href?: string };
};
export function activeAnnouncements(
  settings: RibbonSettings,
  now: number,
  mobile: boolean,
) {
  return settings.items.filter(
    (item) =>
      item.enabled &&
      (item.device === "both" ||
        item.device === (mobile ? "mobile" : "desktop")) &&
      (!item.startsAt || Date.parse(item.startsAt) <= now) &&
      (!item.endsAt || Date.parse(item.endsAt) > now),
  );
}
export function contactChannels(settings: ContactSettings) {
  const channels: {
    id: string;
    label: string;
    detail: string;
    href: string;
  }[] = [];
  if (
    settings.whatsapp?.enabled &&
    /^\+?[1-9][0-9]{6,14}$/.test(settings.whatsapp.number || "")
  )
    channels.push({
      id: "whatsapp",
      label: "Chat on WhatsApp",
      detail: "Start a conversation with our team",
      href: `https://wa.me/${settings.whatsapp.number!.replace(/^\+/, "")}${settings.whatsapp.message ? "?text=" + encodeURIComponent(settings.whatsapp.message) : ""}`,
    });
  if (
    settings.phone?.enabled &&
    /^\+?[0-9]{7,15}$/.test(settings.phone.number || "")
  )
    channels.push({
      id: "phone",
      label: "Call Customer Support",
      detail: settings.phone.number!,
      href: `tel:${settings.phone.number}`,
    });
  if (
    settings.email?.enabled &&
    /^[^\s@?&#%<>]+@[^\s@?&#%<>]+\.[^\s@?&#%<>]+$/.test(settings.email.address || "")
  )
    channels.push({
      id: "email",
      label: "Send an Email",
      detail: settings.email.address!,
      href: `mailto:${settings.email.address}`,
    });
  return channels;
}
export function excludedContactRoute(path: string, excluded: string[] = []) {
  return excluded.some(
    (route) =>
      path === route ||
      (route !== "/" && path.startsWith(route.replace(/\/$/, "") + "/")),
  );
}
