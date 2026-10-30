"use client";

import { useState } from "react";
import { type Asset, assetUrl } from "./cms-api";
import { type HeroConfig, type HeroSlideItem } from "./hero-inspector";

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
          slideType: config.bannerType === "without_button" ? "full_banner" : "split_content",
          title: config.title || "Shop Smart. Live Smart.",
          subtitle: config.subtitle || "Premium multi-category lifestyle and tech store.",
          badge: "Featured",
          themePreset: "dark",
          image: config.image,
          button: config.button || { label: "Start Shopping ↗", href: "/shop" },
          bannerLink: config.bannerLink || "/shop",
          enabled: true,
        },
      ];

  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const safeIndex = Math.min(activeSlideIndex, slides.length - 1);
  const slide = slides[safeIndex] || slides[0];

  const isFullBanner =
    slide.slideType === "full_banner" ||
    (!slide.slideType && slide.bannerType === "without_button");

  const desktopAsset = assets.find((a) => a.id === slide.image?.assetId);
  const mobileAsset = assets.find((a) => a.id === slide.mobileImage?.assetId);
  const currentAsset = viewport === "mobile" && mobileAsset ? mobileAsset : desktopAsset;

  const preset = slide.themePreset || "light";
  const custom = slide.customTheme;

  // Theme styling definitions
  let bgStyle = "#faf8f5";
  let textStyle = "#0f172a";
  let accentStyle = "#0f172a";
  let eyebrowBg = "#f1ede6";
  let eyebrowText = "#0f172a";
  let primaryBtnBg = "#0f172a";
  let primaryBtnText = "#ffffff";
  let secondaryBtnBorder = "#d5cebe";
  let trackBg = "rgba(0, 0, 0, 0.15)";
  let progressFill = "#0f172a";

  if (preset === "dark") {
    bgStyle = "#0f172a";
    textStyle = "#f8fafc";
    accentStyle = "#d8f45a";
    eyebrowBg = "#1e293b";
    eyebrowText = "#d8f45a";
    primaryBtnBg = "#d8f45a";
    primaryBtnText = "#0f172a";
    secondaryBtnBorder = "#334155";
    trackBg = "rgba(255, 255, 255, 0.2)";
    progressFill = "#d8f45a";
  } else if (preset === "lime") {
    bgStyle = "#d8f45a";
    textStyle = "#0f172a";
    accentStyle = "#0f172a";
    eyebrowBg = "#c5e444";
    eyebrowText = "#0f172a";
    primaryBtnBg = "#0f172a";
    primaryBtnText = "#d8f45a";
    secondaryBtnBorder = "#6c8012";
    trackBg = "rgba(0, 0, 0, 0.15)";
    progressFill = "#0f172a";
  } else if (preset === "custom" && custom) {
    bgStyle = custom.bg;
    textStyle = custom.text;
    accentStyle = custom.accent;
    eyebrowBg = "rgba(255, 255, 255, 0.12)";
    eyebrowText = custom.text;
    primaryBtnBg = custom.accent;
    primaryBtnText = custom.bg;
    secondaryBtnBorder = custom.accent;
    trackBg = "rgba(128, 128, 128, 0.3)";
    progressFill = custom.accent;
  }

  const showArrows = config.showArrows !== false;
  const showProgress = config.showProgress !== false;
  const totalSlides = slides.length;
  const formattedCounter = `${String(safeIndex + 1).padStart(2, "0")} / ${String(totalSlides).padStart(2, "0")}`;

  return (
    <div className="w-full">
      {/* 320px Spotlight Card Frame */}
      <div
        className="relative overflow-hidden rounded-[24px] border border-black/10 dark:border-white/10 transition-colors duration-300 min-h-[300px] flex flex-col justify-between"
        style={{
          backgroundColor: isFullBanner ? "#0f172a" : bgStyle,
          color: isFullBanner ? "#ffffff" : textStyle,
        }}
      >
        {/* FULL BANNER MODE */}
        {isFullBanner ? (
          <div className="relative w-full h-[320px] flex items-center justify-center bg-slate-900">
            {currentAsset?.url ? (
              <img
                src={assetUrl(currentAsset.url)}
                alt={slide.image?.alt || slide.title || ""}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center p-6 text-white space-y-2">
                <span className="text-xs font-bold text-lime-400 uppercase tracking-wider block">
                  Full Banner Artwork
                </span>
                <h3 className="text-xl font-bold">{slide.title || "Graphic Banner"}</h3>
                <p className="text-xs text-slate-300">
                  Artwork displayed edge-to-edge with overlay controls.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* SPOTLIGHT CARD MODE */
          <div
            className={`p-6 md:p-8 flex-1 flex ${
              viewport === "mobile"
                ? "flex-col-reverse justify-end gap-5"
                : "flex-row items-center justify-between gap-6"
            }`}
          >
            {/* Left Column: Copy & Actions */}
            <div
              className={`space-y-3 z-10 ${
                viewport === "mobile" ? "w-full text-center" : "max-w-[55%] text-left"
              }`}
            >
              {/* Eyebrow Pill */}
              {slide.badge && (
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                    viewport === "mobile" ? "mx-auto" : ""
                  }`}
                  style={{
                    backgroundColor: eyebrowBg,
                    color: eyebrowText,
                  }}
                >
                  <span>{slide.badge}</span>
                </div>
              )}

              {/* Headline */}
              <h2
                className={`font-extrabold tracking-tight leading-[1.15] ${
                  viewport === "mobile" ? "text-xl" : "text-2xl md:text-3xl"
                }`}
              >
                {slide.title || "Featured Collection"}
              </h2>

              {/* Subtitle */}
              {slide.subtitle && (
                <p
                  className={`text-xs md:text-sm opacity-85 leading-relaxed line-clamp-2 ${
                    viewport === "mobile" ? "max-w-xs mx-auto" : "max-w-md"
                  }`}
                >
                  {slide.subtitle}
                </p>
              )}

              {/* Action Buttons */}
              <div
                className={`flex flex-wrap items-center gap-2.5 pt-1.5 ${
                  viewport === "mobile" ? "justify-center w-full" : ""
                }`}
              >
                {slide.button?.label && (
                  <span
                    className="inline-flex items-center justify-center px-4 py-2 rounded-full text-xs font-bold shadow-xs cursor-pointer"
                    style={{
                      backgroundColor: primaryBtnBg,
                      color: primaryBtnText,
                    }}
                  >
                    {slide.button.label}
                  </span>
                )}
                {slide.secondaryButton?.label && (
                  <span
                    className="inline-flex items-center justify-center px-4 py-2 rounded-full text-xs font-semibold border cursor-pointer"
                    style={{
                      borderColor: secondaryBtnBorder,
                      color: textStyle,
                    }}
                  >
                    {slide.secondaryButton.label}
                  </span>
                )}
              </div>
            </div>

            {/* Right Column: Visual Artwork & Backdrop */}
            <div
              className={`relative flex items-center justify-center ${
                viewport === "mobile"
                  ? "w-full h-40 shrink-0"
                  : "w-1/2 h-56 shrink-0"
              }`}
            >
              {/* Backdrop Circle or Ring */}
              {slide.imageBackdrop === "circle" && (
                <div
                  className="absolute w-36 h-36 md:w-48 md:h-48 rounded-full pointer-events-none"
                  style={{
                    backgroundColor:
                      preset === "dark"
                        ? "rgba(255, 255, 255, 0.06)"
                        : "rgba(0, 0, 0, 0.05)",
                  }}
                />
              )}
              {slide.imageBackdrop === "lime_ring" && (
                <div
                  className="absolute w-36 h-36 md:w-48 md:h-48 rounded-full border-4 pointer-events-none"
                  style={{
                    borderColor:
                      preset === "lime" ? "#0f172a" : "#d8f45a",
                  }}
                />
              )}

              {/* Product Image */}
              {currentAsset?.url ? (
                <img
                  src={assetUrl(currentAsset.url)}
                  alt={slide.image?.alt || slide.title || ""}
                  className="relative z-10 max-h-40 md:max-h-52 w-auto object-contain drop-shadow-md"
                />
              ) : (
                <div className="relative z-10 h-32 w-32 rounded-2xl bg-black/5 dark:bg-white/10 flex items-center justify-center text-4xl">
                  🖼️
                </div>
              )}
            </div>
          </div>
        )}

        {/* BOTTOM CONTROLS BAR (SEGMENTED PROGRESS, COUNTER, ARROWS, PLAY/PAUSE) */}
        <div
          className={`px-6 py-3 flex items-center justify-between gap-4 select-none z-20 ${
            isFullBanner
              ? "absolute bottom-3 left-4 right-4 bg-black/60 backdrop-blur-md rounded-2xl text-white border border-white/10"
              : "border-t border-black/5 dark:border-white/5"
          }`}
        >
          {/* Segmented Progress Bars */}
          {showProgress && totalSlides > 1 && (
            <div className="flex-1 flex items-center gap-1.5 max-w-xs">
              {slides.map((_, i) => {
                const isActive = i === safeIndex;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveSlideIndex(i)}
                    className="flex-1 h-1 rounded-full overflow-hidden transition-all duration-200"
                    style={{
                      backgroundColor: isFullBanner
                        ? "rgba(255, 255, 255, 0.3)"
                        : trackBg,
                    }}
                    title={`Go to slide ${i + 1}`}
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isActive ? "w-full" : "w-0"
                      }`}
                      style={{
                        backgroundColor: isFullBanner ? "#d8f45a" : progressFill,
                      }}
                    />
                  </button>
                );
              })}
            </div>
          )}

          {/* Right Controls: Counter, Prev, Next, Play/Pause */}
          <div className="flex items-center gap-2.5 ml-auto text-xs font-mono">
            {totalSlides > 1 && (
              <span className="font-bold opacity-80 text-[11px]">
                {formattedCounter}
              </span>
            )}

            {showArrows && totalSlides > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setActiveSlideIndex((prev) => (prev > 0 ? prev - 1 : totalSlides - 1))
                  }
                  className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition text-sm font-bold"
                  title="Previous Slide"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveSlideIndex((prev) => (prev < totalSlides - 1 ? prev + 1 : 0))
                  }
                  className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition text-sm font-bold"
                  title="Next Slide"
                >
                  ›
                </button>
              </div>
            )}

            {/* Play / Pause Toggle */}
            <button
              type="button"
              onClick={() => setIsPaused(!isPaused)}
              className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition text-xs"
              title={isPaused ? "Play slideshow" : "Pause slideshow"}
            >
              {isPaused ? "▶" : "❚❚"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
