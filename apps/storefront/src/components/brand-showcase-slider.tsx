/* eslint-disable @next/next/no-img-element -- Validated CMS images with responsive cover/contain styling */
"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { type Asset, type Image, assetSource, safeHref } from "../lib/cms";
import { imageUrl } from "../lib/storefront";

export type BrandTile = {
  name?: string;
  image?: Image;
  href?: string;
};

interface BrandShowcaseSliderProps {
  title?: ReactNode;
  brands: BrandTile[];
  assets: Asset[];
}

export function BrandShowcaseSlider({
  title,
  brands,
  assets,
}: BrandShowcaseSliderProps) {
  if (!brands || brands.length === 0) return null;

  // Duplicate items so that the infinite track smoothly scrolls seamlessly without empty gaps
  const repeatCount = brands.length < 4 ? 4 : brands.length < 8 ? 3 : 2;
  const loopBrands: BrandTile[] = [];
  for (let r = 0; r < repeatCount; r++) {
    loopBrands.push(...brands);
  }

  const getImgSrc = (image?: Image) => {
    const imgWithUrl = image as (Image & { url?: string }) | undefined;
    return (
      (imgWithUrl?.url ? imageUrl(imgWithUrl.url) : null) ||
      assetSource(assets, image?.assetId)
    );
  };

  return (
    <section className="brand-slider-section" aria-label="Top Brands">
      {title && <div className="section-head">{title}</div>}
      <div className="brand-slider-wrapper">
        <div className="brand-slider-fade brand-slider-fade-left" aria-hidden="true" />
        <div className="brand-slider-track">
          {loopBrands.map((brand, idx) => {
            const src = getImgSrc(brand.image);
            const href = safeHref(brand.href);
            const altText = brand.image?.alt || brand.name || "Brand logo";
            const content = (
              <article className="brand-card">
                <div className="brand-card-img-wrapper">
                  {src ? (
                    <img
                      src={src}
                      alt={altText}
                      className="brand-card-img"
                      loading="lazy"
                    />
                  ) : (
                    <div className="brand-card-placeholder">
                      {(brand.name || "B").charAt(0)}
                    </div>
                  )}
                </div>
              </article>
            );

            return href ? (
              <Link
                key={`brand-${idx}`}
                href={href}
                className="brand-card-link"
                title={brand.name || altText}
              >
                {content}
              </Link>
            ) : (
              <div key={`brand-${idx}`} className="brand-card-link">
                {content}
              </div>
            );
          })}
        </div>
        <div className="brand-slider-fade brand-slider-fade-right" aria-hidden="true" />
      </div>
    </section>
  );
}
