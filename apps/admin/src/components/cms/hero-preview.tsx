"use client";

import { useState } from "react";
import { type Asset, assetUrl } from "./cms-api";
import { type HeroConfig, type HeroSlideItem } from "./hero-inspector";

const DEFAULT_BANNER = "/brand/hero-banner-main.png";

interface HeroPreviewProps {
  config: HeroConfig;
  assets: Asset[];
  viewport: "desktop" | "tablet" | "mobile";
}

export function HeroSectionPreview({ config, assets, viewport }: HeroPreviewProps) {
  const slides: HeroSlideItem[] = Array.isArray(config.slides) && config.slides.length > 0
    ? config.slides
    : [
        {
          id: "slide-1",
          imageUrl: DEFAULT_BANNER,
          href: "/shop",
          alt: "Shop Smart. Live Smart.",
        },
      ];

  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const totalSlides = slides.length;
  const safeIndex = Math.min(activeSlideIndex, totalSlides - 1);
  const slide = slides[safeIndex] || slides[0];

  const asset = assets.find((a) => a.id === slide.image?.assetId);
  const currentImg =
    slide.imageUrl ||
    (asset?.url ? assetUrl(asset.url) : "") ||
    slide.image?.url ||
    DEFAULT_BANNER;

  const move = (delta: number) => {
    setActiveSlideIndex((prev) => (prev + delta + totalSlides) % totalSlides);
  };

  return (
    <div className="w-full">
      {/* Sleek Banner Frame matching storefront mockup */}
      <div
        className={`relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 shadow-lg bg-slate-900 select-none ${
          viewport === "mobile" ? "aspect-[16/9]" : "aspect-[1024/435]"
        }`}
      >
        {/* Banner Graphic Artwork */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentImg}
          alt={slide.alt || "Hero Banner"}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = DEFAULT_BANNER;
          }}
        />

        {/* Floating Circular Controls (When multiple slides exist) */}
        {totalSlides > 1 && (
          <>
            {/* Bottom-Left Frosted Circular Arrow */}
            <button
              type="button"
              onClick={() => move(-1)}
              className="absolute bottom-3 left-3 md:bottom-4 md:left-4 z-10 w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/85 hover:bg-white text-slate-800 shadow-md backdrop-blur-md border border-white/80 flex items-center justify-center text-sm md:text-base font-bold transition hover:scale-105 active:scale-95"
              title="Previous Slide"
            >
              ‹
            </button>

            {/* Bottom-Right Frosted Circular Arrow */}
            <button
              type="button"
              onClick={() => move(1)}
              className="absolute bottom-3 right-3 md:bottom-4 md:right-4 z-10 w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/85 hover:bg-white text-slate-800 shadow-md backdrop-blur-md border border-white/80 flex items-center justify-center text-sm md:text-base font-bold transition hover:scale-105 active:scale-95"
              title="Next Slide"
            >
              ›
            </button>

            {/* Bottom-Center Minimal Pagination Dots */}
            <div className="absolute bottom-3 md:bottom-5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 md:gap-2 px-2.5 py-1 rounded-full bg-white/40 backdrop-blur-md border border-white/50">
              {slides.map((_, i) => {
                const isActive = i === safeIndex;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveSlideIndex(i)}
                    className={`h-2 rounded-full transition-all duration-200 ${
                      isActive ? "w-5 bg-sky-600" : "w-2 bg-sky-300/80 hover:bg-sky-400"
                    }`}
                    title={`Go to slide ${i + 1}`}
                  />
                );
              })}
            </div>
          </>
        )}

        {/* Link destination indicator badge */}
        <div className="absolute top-2.5 right-2.5 z-10 bg-black/50 backdrop-blur-sm text-white/90 text-[10px] font-mono px-2 py-0.5 rounded-md border border-white/10">
          Href: {slide.href || slide.bannerLink || "/shop"}
        </div>
      </div>
    </div>
  );
}
