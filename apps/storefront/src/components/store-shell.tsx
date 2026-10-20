/* eslint-disable @next/next/no-img-element -- Public CMS images support configured media storage. */
import Link from "next/link";
import { ThemeSwitcher } from "./theme-switcher";
import { ShoppingLinks } from "./shopping-actions";
import { BrandLogo } from "./brand-logo";
import {
  safeHref,
  type CmsConfig,
  type MenuItem,
} from "../lib/cms";
function Menu({ items }: { items: MenuItem[] }) {
  return (
    <ul className="cms-menu">
      {items.map((item) => (
        <li key={item.id}>
          {safeHref(item.href) && (
            <Link href={safeHref(item.href)!}>{item.label}</Link>
          )}
          {item.children?.length ? (
            <details>
              <summary>More: {item.label}</summary>
              <Menu items={item.children} />
            </details>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
function Search() {
  return (
    <form action="/search" className="search" role="search">
      <label className="sr-only" htmlFor="search-products">
        Search products
      </label>
      <input
        id="search-products"
        name="q"
        type="search"
        placeholder="Search products…"
        minLength={1}
      />
      <button type="submit">Search</button>
    </form>
  );
}
export function Header({ config }: { config: CmsConfig }) {
  const { settings } = config;
  const menu = config.menus[settings.header?.menuKey || "main"] || [];
  const categoryMenu = settings.header?.categoryMenuKey
    ? config.menus[settings.header.categoryMenuKey]
    : [];
  return (
    <>
      {config.announcement && (
        <div className="announcement">
          {safeHref(settings.announcement?.href) ? (
            <Link href={safeHref(settings.announcement?.href)!}>
              {config.announcement}
            </Link>
          ) : (
            config.announcement
          )}
        </div>
      )}
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
            settings.header.searchPlacement === "header") && <Search />}
          <Link className="header-action" href="/shop">
            Shop all
          </Link>
          <ShoppingLinks />
          <ThemeSwitcher />
        </div>
        {settings.header?.searchPlacement === "below" && (
          <div className="container search-below">
            <Search />
          </div>
        )}
        <nav className="container category-nav" aria-label="Store navigation">
          {menu.length ? (
            <Menu items={menu} />
          ) : (
            <><Link href="/shop">Shop all</Link><Link href="/categories">Browse categories</Link><Link href="/wishlist">Your wishlist</Link><Link href="/orders">Track order</Link><Link href="/help">Shopping help</Link></>
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
  return (
    <footer className={`footer tone-${config.tokens.footerStyle || "light"}`}>
      <div className="container footer-layout">
        <div>
          <Link href="/" className="wordmark" aria-label="DS Mart homepage"><BrandLogo /></Link>
          <p className="footer-tagline">Shop smart. Live smart.</p>
          <p>Everyday essentials. Fresh discoveries.<br />A little more for your everyday.</p>
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
          <h2>Customer care</h2>
          <Link href="/help">Shopping help</Link>
          <Link href="/contact">Contact us</Link>
          <Link href="/orders">Track your order</Link>
          <Link href="/account">Your account</Link>
        </nav>
        <nav aria-label="Explore DS Mart">
          <h2>Explore DS Mart</h2>
          <Link href="/shop">All products</Link>
          <Link href="/categories">Shop by category</Link>
          <Link href="/wishlist">Saved favourites</Link>
          <Link href="/cart">Your shopping bag</Link>
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
        <span>© {new Date().getUTCFullYear()} DS Mart. All rights reserved.</span>
        <span>SHOP SMART. LIVE SMART.</span>
      </div>
    </footer>
  );
}
