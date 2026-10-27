import type { Metadata } from "next";
import { Suspense, type CSSProperties, type ReactNode } from "react";
import { Hanken_Grotesk } from "next/font/google";
import { getCmsConfig, type CmsConfig } from "../lib/cms";
import { fallbackConfig } from "../lib/storefront";
import { unstable_rethrow } from "next/navigation";
import { Footer, Header } from "../components/store-shell";
import { StoreBenefits } from "../components/store-benefits";
import { themeScript } from "../lib/theme-init";
import { connection } from "next/server";
import { FloatingContact } from "../components/store-engagement";
import { StoreAnalytics } from "../components/store-analytics";
import { CartDrawer } from "../components/cart-drawer";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "DS Mart | Shop smart. Live smart.", template: "%s | DS Mart" },
  description: "Shop electronics, fashion, home essentials and more at DS Mart. Shop smart. Live smart.",
  applicationName: "DS Mart",
  icons: { icon: "/brand/icon.svg", apple: "/brand/ds-symbol.png" },
};

const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken", display: "swap" });
const fonts: Record<string, string> = {
  system: "system-ui, sans-serif",
  sans: "Arial, sans-serif",
  serif: "Georgia, serif",
};
async function StoreFrame({ children }: { children: ReactNode }) {
  await connection();
  let config: CmsConfig;
  let unavailable = false;
  try {
    config = await getCmsConfig();
  } catch (error) {
    unstable_rethrow(error);
    unavailable = true;
    config = { ...fallbackConfig, settings: {}, tokens: {}, menus: {}, assets: [] };
  }
  const t = config.tokens;
  const vars = {
    "--brand": config.theme.primary,
    "--page": config.theme.background,
    "--ink": config.theme.foreground,
    "--surface": config.theme.surface,
    "--line": config.theme.border,
    "--accent": t.accent || "#E8F7FF",
    "--text": t.text || config.theme.foreground,
    "--muted": t.muted || "#60738A",
    "--secondary": t.secondary || config.theme.primary,
    "--radius": `${t.radius ?? 16}px`,
    "--spacing": `${t.spacing ?? 8}px`,
    "--body-size": `${t.bodyFontSize ?? 16}px`,
    "--heading-size": `${t.headingFontSize ?? 40}px`,
    "--body-font": fonts[String(t.fontFamily)] || fonts.system,
    "--heading-font": fonts[String(t.headingFontFamily)] || fonts.system,
  } as CSSProperties;
  return (
    <div
      lang={config.settings.locale || "en"}
      style={vars}
      className={`storefront button-${t.buttonStyle || "solid"} card-${t.productCardStyle || "bordered"} layout-${t.layoutPreset || "balanced"}`}
    >
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header config={config} />
      <StoreAnalytics />
      {unavailable ? <main id="main" className="container main-content"><div className="shop-panel store-unavailable"><p className="eyebrow">DS Mart</p><h1>We’ll be right back.</h1><p>Our store is temporarily unavailable. Please try again shortly.</p><a className="primary-button" href="/">Try again</a><a className="secondary-button" href="/help">Shopping help</a></div></main> : children}
      <StoreBenefits />
      <Footer config={config} />
      <FloatingContact initial={config.settings} />
      <CartDrawer />
    </div>
  );
}
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={hanken.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Suspense
          fallback={
            <main className="container main-content" role="status">
              Loading store…
            </main>
          }
        >
          <StoreFrame>{children}</StoreFrame>
        </Suspense>
      </body>
    </html>
  );
}