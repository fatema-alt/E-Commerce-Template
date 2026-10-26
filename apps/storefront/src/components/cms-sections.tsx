/* eslint-disable @next/next/no-img-element -- Validated CMS assets support local/S3 public URLs. */
import Link from "next/link";
import type { CSSProperties } from "react";
import {
  assetSource,
  safeHref,
  sectionProducts,
  type Asset,
  type Image,
  type Section,
} from "../lib/cms";
import { getCategories } from "../lib/storefront";
import { ProductCard } from "./home-sections";
import { BannerSlider, SaleCountdown } from "./cms-interactive";
import { Newsletter } from './newsletter';
import { BrandArtwork } from "./brand-artwork";
import { HeroBanner } from "./hero-banner";
function Picture({ image, assets }: { image?: Image; assets: Asset[] }) {
  const src = assetSource(assets, image?.assetId);
  if (!src) return null;
  const picture = (
    <img
      className="cms-image"
      src={src}
      alt={image?.alt || ""}
      loading="lazy"
    />
  );
  const href = safeHref(image?.href);
  return href ? <Link href={href}>{picture}</Link> : picture;
}
function Button({ button }: { button?: { label: string; href: string } }) {
  const href = safeHref(button?.href);
  return href && button ? (
    <Link className="primary-button" href={href}>
      {button.label}
    </Link>
  ) : null;
}
function Hero({
  config,
  assets,
}: {
  config: Record<string, unknown>;
  assets: Asset[];
}) {
  return (
    <div
      className="hero cms-hero"
      style={{
        textAlign: (config.align || "left") as CSSProperties["textAlign"],
      }}
    >
      <div className="hero-content">
        <h2>{String(config.title || "")}</h2>
        {typeof config.subtitle === "string" && <p>{config.subtitle}</p>}
        <Button button={config.button as { label: string; href: string }} />
      </div>
      {assetSource(assets, (config.image as Image | undefined)?.assetId)
        ? <Picture image={config.image as Image} assets={assets} />
        : <BrandArtwork />}
    </div>
  );
}
type Tile = { name: string; image?: Image; href?: string };
async function Block({
  section,
  assets,
}: {
  section: Section;
  assets: Asset[];
}) {
  const c = section.config;
  const title = typeof c.title === "string" ? <h2>{c.title}</h2> : null;
  if (section.type === "hero") return <HeroBanner config={c} assets={assets} />;
  if (section.type === "bannerSlider")
    return (
      <BannerSlider
        seconds={Number(c.intervalSeconds || 6)}
        slides={(c.slides as Record<string, unknown>[]).map((slide, i) => (
          <Hero key={i} config={slide} assets={assets} />
        ))}
      />
    );
  if (["productGrid", "productCarousel", "flashSale"].includes(section.type)) {
    // Server rendering intentionally evaluates expiry once for this request.
    const expired =
      section.type === "flashSale" &&
      // eslint-disable-next-line react-hooks/purity
      new Date(String(c.endsAt)).getTime() <= Date.now();
    const products = expired ? [] : await sectionProducts(c);
    return (
      <>
        <div className="section-head">
          {title}
          {section.type === "flashSale" && (
            <SaleCountdown endsAt={String(c.endsAt)} />
          )}
        </div>
        {products.length ? (
          <div
            className={
              section.type === "productCarousel"
                ? "cms-carousel"
                : "products-grid cms-grid"
            }
            style={{ "--columns": Number(c.columns || 4) } as CSSProperties}
          >
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <p className="empty-content">
            {expired
              ? "This sale event has ended."
              : "No products are available in this collection yet."}
          </p>
        )}
      </>
    );
  }
  if (section.type === "categoryGrid") {
    const rawCategoryIds = Array.isArray(c.categoryIds) ? (c.categoryIds as string[]) : [];
    const all = await getCategories(rawCategoryIds.length > 0 ? rawCategoryIds : undefined);
    const selected =
      rawCategoryIds.length > 0
        ? rawCategoryIds
            .map((id) => all.find((category) => category.id === id))
            .filter((category): category is (typeof all)[number] => category !== undefined)
        : all.slice(0, 12);
    return (
      <>
        {title}
        <div
          className="categories-grid cms-grid"
          style={{ "--columns": Number(c.columns || 4) } as CSSProperties}
        >
          {selected.map((category) => (
            <Link
              key={category.id}
              href={`/category/${encodeURIComponent(category.slug)}`}
              className="category-card"
            >
              {category.imageUrl && (
                <img
                  src={category.imageUrl}
                  alt=""
                  className="cms-image"
                  loading="lazy"
                />
              )}
              <span>{category.name}</span>
            </Link>
          ))}
        </div>
        {!selected.length && (
          <p className="empty-content">No categories are available yet.</p>
        )}
      </>
    );
  }
  if (
    section.type === "featuredCollections" ||
    section.type === "brandShowcase"
  ) {
    const tiles = (c.collections || c.brands) as Tile[];
    return (
      <>
        {title}
        <div className="cms-tiles">
          {tiles.map((tile, i) => (
            <article key={i} className="cms-tile">
              <Picture image={tile.image} assets={assets} />
              {safeHref(tile.href) ? (
                <Link href={safeHref(tile.href)!}>{tile.name}</Link>
              ) : (
                <p>{tile.name}</p>
              )}
            </article>
          ))}
        </div>
      </>
    );
  }
  if (section.type === "promoBanner")
    return (
      <div className="cms-promo">
        {title}
        {typeof c.description === "string" && <p>{c.description}</p>}
        <Picture image={c.image as Image} assets={assets} />
        <Button button={c.button as { label: string; href: string }} />
      </div>
    );
  if (section.type === "imageText")
    return (
      <div
        className={`cms-image-text ${c.imagePosition === "right" ? "image-right" : ""}`}
      >
        <Picture image={c.image as Image} assets={assets} />
        <div>
          {title}
          {(c.paragraphs as string[]).map((text, i) => (
            <p key={i}>{text}</p>
          ))}
          <Button button={c.button as { label: string; href: string }} />
        </div>
      </div>
    );
  if (section.type === "richText")
    return (
      <div className="cms-prose">
        {title}
        {(c.paragraphs as string[]).map((text, i) => (
          <p key={i}>{text}</p>
        ))}
      </div>
    );
  if (section.type === "faq")
    return (
      <div className="cms-faq">
        {title}
        {(c.items as { question: string; answer: string }[]).map((item, i) => (
          <details key={i}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    );
  if (section.type === "newsletter")
    return (
      <div className="cms-promo">
        {title}
        <p>{String(c.description || "")}</p>
          <Newsletter buttonLabel={String(c.buttonLabel)} consentText={String(c.consentText || '')} />
        {safeHref(String(c.privacyHref)) && (
          <Link
            href={safeHref(String(c.privacyHref))!}
          >
              Privacy information
          </Link>
        )}
      </div>
    );
  if (section.type === "trustFeatures") {
    const icons: Record<string, string> = {
      shield: "◇",
      truck: "↗",
      return: "↶",
      support: "☏",
      payment: "▣",
      quality: "★",
    };
    return (
      <>
        {title}
        <div className="cms-tiles">
          {(
            c.items as { title: string; description: string; icon: string }[]
          ).map((item, i) => (
            <article key={i} className="cms-tile">
              <span aria-hidden="true" className="trust-icon">
                {icons[item.icon]}
              </span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </>
    );
  }
  return null;
}
export function CmsSections({
  sections,
  assets,
}: {
  sections: Section[];
  assets: Asset[];
}) {
  const supported = new Set([
    "hero",
    "bannerSlider",
    "categoryGrid",
    "productGrid",
    "productCarousel",
    "featuredCollections",
    "brandShowcase",
    "flashSale",
    "promoBanner",
    "imageText",
    "richText",
    "faq",
    "newsletter",
    "trustFeatures",
  ]);
  return (
    <>
      {sections
        .filter((section) => section.visible && supported.has(section.type))
        .map((section) => (
          <section
            key={section.id}
            className={`cms-section ${section.responsive?.width === "full" ? "cms-full" : "container"} ${section.responsive?.mobile === false ? "cms-hide-mobile" : ""} ${section.responsive?.tablet === false ? "cms-hide-tablet" : ""} ${section.responsive?.desktop === false ? "cms-hide-desktop" : ""}`}
            style={
              {
                "--section-padding": `${section.responsive?.padding ?? 4}rem`,
              } as CSSProperties
            }
          >
            <Block section={section} assets={assets} />
          </section>
        ))}
    </>
  );
}
