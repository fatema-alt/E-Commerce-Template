"use client";

import Link from "next/link";
import { SearchCombobox } from "./search-combobox";
import { AnnouncementRibbon } from "./store-engagement";
import { ThemeSwitcher } from "./theme-switcher";
import { LanguageSwitcher } from "./language-switcher";
import { ShoppingLinks } from "./shopping-actions";
import { BrandLogo } from "./brand-logo";
import { safeHref, type CmsConfig, type MenuItem } from "../lib/cms";
import { useLanguage } from "../lib/i18n";

function Menu({ items }: { items: MenuItem[] }) {
  const { t, locale } = useLanguage();

  const translateMenuLabel = (label: string): string => {
    if (locale !== "bn") return label;
    const lower = label.trim().toLowerCase();
    if (lower === "shop all" || lower === "all products" || lower === "shop") return t("nav_shop_all");
    if (lower === "categories" || lower === "browse categories" || lower === "shop by category") return t("nav_categories");
    if (lower === "wishlist" || lower === "saved favourites" || lower === "your wishlist") return t("nav_wishlist");
    if (lower === "track order" || lower === "track your order" || lower === "track") return t("nav_track");
    if (lower === "shopping help" || lower === "help" || lower === "support") return t("nav_help");
    return label;
  };

  return (
    <ul className="cms-menu">
      {items.map((item) => (
        <li key={item.id}>
          {safeHref(item.href) && (
            <Link href={safeHref(item.href)!}>{translateMenuLabel(item.label)}</Link>
          )}
          {item.children?.length ? (
            <details>
              <summary>More: {translateMenuLabel(item.label)}</summary>
              <Menu items={item.children} />
            </details>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function Header({ config }: { config: CmsConfig }) {
  const { settings } = config;
  const { t } = useLanguage();
  const menu = config.menus[settings.header?.menuKey || "main"] || [];
  const categoryMenu = settings.header?.categoryMenuKey
    ? config.menus[settings.header.categoryMenuKey]
    : [];

  return (
    <>
      <AnnouncementRibbon
        initial={{
          ...settings,
          announcement:
            settings.announcement ||
            (config.announcement
              ? { enabled: true, text: config.announcement }
              : undefined),
        }}
        initialNow={config.renderedAt || 0}
      />
      <header
        className={`site-header header-${settings.header?.layout || "classic"} tone-${config.tokens.headerStyle || "light"}`}
      >
        <div className="container header-row">
          <Link
            href="/"
            className="wordmark"
            aria-label={`${config.siteName}, homepage`}
          >
            <BrandLogo />
          </Link>
          {(!settings.header ||
            settings.header.searchPlacement === "header") && <SearchCombobox />}
          <ShoppingLinks />
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
        {settings.header?.searchPlacement === "below" && (
          <div className="container search-below">
            <SearchCombobox />
          </div>
        )}
        <nav className="container category-nav" aria-label="Store navigation">
          {menu.length ? (
            <Menu items={menu} />
          ) : (
            <>
              <Link href="/shop">{t("nav_shop_all")}</Link>
              <Link href="/categories">{t("nav_categories")}</Link>
              <Link href="/wishlist">{t("nav_wishlist")}</Link>
              <Link href="/track">{t("nav_track")}</Link>
              <Link href="/help">{t("nav_help")}</Link>
            </>
          )}
        </nav>
        {categoryMenu?.length ? (
          <nav
            className="container category-nav"
            aria-label="Product departments"
          >
            <Menu items={categoryMenu} />
          </nav>
        ) : null}
      </header>
    </>
  );
}

export function Footer({ config }: { config: CmsConfig }) {
  const { settings } = config;
  const { t, formatNumber } = useLanguage();

  return (
    <footer className={`footer tone-${config.tokens.footerStyle || "light"}`}>
      <div className="container footer-layout">
        <div>
          <Link href="/" className="wordmark" aria-label="DS Mart homepage">
            <BrandLogo />
          </Link>
          <p className="footer-tagline">{t("footer_tagline")}</p>
          <p>{t("footer_desc")}</p>
          {settings.contact?.address && <p>{settings.contact.address}</p>}
          {settings.contact?.email && (
            <p>
              <a href={`mailto:${settings.contact.email}`}>
                {settings.contact.email}
              </a>
            </p>
          )}
          {settings.contact?.phone && <p>{settings.contact.phone}</p>}
        </div>
        {settings.footer?.columns.map((column, i) => (
          <nav key={i} aria-label={column.title}>
            <h2>{column.title}</h2>
            <Menu items={config.menus[column.menuKey] || []} />
          </nav>
        ))}
        <nav aria-label="Shopping help">
          <h2>{t("footer_customer_care")}</h2>
          <Link href="/help">{t("footer_shopping_help")}</Link>
          <Link href="/contact">{t("footer_contact_us")}</Link>
          <Link href="/track">{t("footer_track_order")}</Link>
          <Link href="/account">{t("footer_your_account")}</Link>
        </nav>
        <nav aria-label="Explore DS Mart">
          <h2>{t("footer_explore")}</h2>
          <Link href="/shop">{t("footer_all_products")}</Link>
          <Link href="/categories">{t("footer_by_category")}</Link>
          <Link href="/wishlist">{t("footer_saved")}</Link>
          <Link href="/cart">{t("footer_bag")}</Link>
        </nav>
        <nav aria-label="Social and legal links">
          {[
            ...(settings.socialLinks || []),
            ...(settings.legalLinks || []),
          ].map((item, i) =>
            safeHref(item.href) ? (
              <Link key={i} href={safeHref(item.href)!}>
                {item.label}
              </Link>
            ) : null,
          )}
        </nav>
      </div>
      <div className="container footer-bottom">
        <span>
          © {formatNumber(new Date().getUTCFullYear())} DS Mart. {t("footer_rights")}
        </span>
        <span>{t("footer_tagline")}</span>
      </div>
    </footer>
  );
}
