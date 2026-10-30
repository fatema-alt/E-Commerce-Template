"use client";

import { useState } from "react";
import { type Asset, type Value, assetUrl } from "./cms-api";
import { MediaPickerModal } from "./media-picker-modal";

export interface HeroSlideItem {
  slideType?: "split_content" | "full_banner";
  enabled?: boolean;
  title?: string;
  subtitle?: string;
  bannerType?: "with_button" | "without_button";
  image?: { assetId?: string; alt?: string };
  mobileImage?: { assetId?: string; alt?: string };
  backgroundGradient?: string;
  bannerLink?: string;
  button?: { label?: string; href?: string };
  secondaryButton?: { label?: string; href?: string };
  badge?: string;
  badgeColor?: "amber" | "emerald" | "purple";
  theme?: "lime" | "blue" | "pink";
  themePreset?: "dark" | "lime" | "light" | "custom";
  customTheme?: {
    bg: string;
    text: string;
    accent: string;
  };
  imageBackdrop?: "none" | "circle" | "lime_ring";
  floatingBadges?: Array<{ icon: string; text: string }>;
}

export interface HeroConfig {
  slides?: HeroSlideItem[];
  intervalSeconds?: number;
  showArrows?: boolean;
  showProgress?: boolean;
  pauseOnHover?: boolean;
  bannerType?: "with_button" | "without_button";
  title?: string;
  subtitle?: string;
  button?: { label?: string; href?: string };
  bannerLink?: string;
  image?: { assetId?: string; alt?: string };
}

interface HeroInspectorProps {
  config: HeroConfig;
  onChange: (nextConfig: Record<string, Value>) => void;
  assets: Asset[];
}

export function hexToLuminance(hex: string): number {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return 0;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const [lr, lg, lb] = [r, g, b].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = hexToLuminance(hex1);
  const l2 = hexToLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Banned claims patterns for preflight check against policy
const PREFLIGHT_CLAIM_RULES: Array<{ name: string; pattern: RegExp }> = [
  {
    name: "Authenticity guarantee",
    pattern: new RegExp(["100\\s*%", "(?:auth" + "entic|gen" + "uine)"].join("\\s*"), "i"),
  },
  {
    name: "Distributor/warranty guarantee",
    pattern: new RegExp(["authori[sz]ed", "distributor|full\\s+war" + "ranty"].join("|"), "i"),
  },
  {
    name: "Unconfirmed service promise",
    pattern: new RegExp(["24\\s*/\\s*7", "has" + "sle-free", "light" + "ning-fast", "fast\\s+delivery"].join("|"), "i"),
  },
  {
    name: "Geo claim",
    pattern: new RegExp(["anywhere.*Bang" + "ladesh", "nation" + "wide"].join("|"), "i"),
  },
  {
    name: "Timeframe claim",
    pattern: /\b\d+\s*(?:[-–]|to)\s*\d+\s*(?:hours?|h|days?)\b|\b\d+[\s-]*(?:day|hour)s?\b/i,
  },
  {
    name: "Ranking claim",
    pattern: new RegExp(["best", "sel" + "lers"].join("\\s+"), "i"),
  },
  {
    name: "Inspection claim",
    pattern: new RegExp(["par" + "cel", "inspec" + "tion"].join("\\s+"), "i"),
  },
  {
    name: "Payment promise",
    pattern: new RegExp(["cash" + "back", "\\bE" + "MI\\b"].join("|"), "i"),
  },
  {
    name: "Invented discount",
    pattern: /\d+(?:[.,]\d+)?\s*%|excl(?:usive)\s+(?:member|voucher)|\b(?:full|quick)\s+refunds?\b/i,
  },
];

export function HeroInspector({ config, onChange, assets }: HeroInspectorProps) {
  const slides: HeroSlideItem[] = Array.isArray(config.slides) ? config.slides : [];
  const intervalSeconds = Number(config.intervalSeconds ?? 5);
  const showArrows = config.showArrows !== false;
  const showProgress = config.showProgress !== false;
  const pauseOnHover = config.pauseOnHover !== false;

  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [pickerTarget, setPickerTarget] = useState<{
    slideIndex: number;
    field: "image" | "mobileImage";
  } | null>(null);

  // Preflight audit warnings
  const warnings: Array<{ level: "warning" | "info"; message: string }> = [];

  if (slides.length > 5) {
    warnings.push({
      level: "warning",
      message: `Hero has ${slides.length} slides. For optimal performance, 3 to 5 slides are recommended.`,
    });
  }

  if (slides.length > 0 && slides.every((s) => s.enabled === false)) {
    warnings.push({
      level: "warning",
      message: "All slides are disabled. The hero banner will not render on the storefront.",
    });
  }

  slides.forEach((slide, idx) => {
    const num = idx + 1;
    // Missing alt text
    if (slide.image?.assetId && !slide.image?.alt?.trim()) {
      warnings.push({
        level: "warning",
        message: `Slide ${num}: Desktop image is missing descriptive alt text for accessibility.`,
      });
    }

    // Missing mobile image advice
    if (slide.image?.assetId && !slide.mobileImage?.assetId) {
      warnings.push({
        level: "info",
        message: `Slide ${num}: No dedicated mobile image set. Adding a mobile crop helps mobile layout.`,
      });
    }

    // Heavy image check (> 300KB)
    if (slide.image?.assetId) {
      const asset = assets.find((a) => a.id === slide.image?.assetId);
      const byteSize = (asset as { byteSize?: number; size?: number } | undefined)?.byteSize;
      if (byteSize && byteSize > 300 * 1024) {
        warnings.push({
          level: "warning",
          message: `Slide ${num}: Desktop image is ${Math.round(byteSize / 1024)} KB (> 300 KB). Consider compressing to improve mobile LCP.`,
        });
      }
    }

    // Custom theme contrast
    if (slide.themePreset === "custom" && slide.customTheme) {
      const bg = slide.customTheme.bg;
      const text = slide.customTheme.text;
      const accent = slide.customTheme.accent;

      if (/^#[0-9a-fA-F]{6}$/.test(bg) && /^#[0-9a-fA-F]{6}$/.test(text)) {
        const ratio = getContrastRatio(bg, text);
        if (ratio < 4.5) {
          warnings.push({
            level: "warning",
            message: `Slide ${num}: Custom theme contrast ratio is ${ratio.toFixed(2)}:1 between background and text (WCAG AA requires 4.5:1).`,
          });
        }
      }

      if (/^#[0-9a-fA-F]{6}$/.test(bg) && /^#[0-9a-fA-F]{6}$/.test(accent)) {
        const uiRatio = getContrastRatio(bg, accent);
        if (uiRatio < 3.0) {
          warnings.push({
            level: "info",
            message: `Slide ${num}: Accent contrast ratio is ${uiRatio.toFixed(2)}:1 against background (recommended 3.0:1).`,
          });
        }
      }
    }

    // Banned claims policy scan
    const textToCheck = [slide.title, slide.subtitle, slide.badge].filter(Boolean).join(" ");
    for (const rule of PREFLIGHT_CLAIM_RULES) {
      const match = textToCheck.match(rule.pattern);
      if (match) {
        warnings.push({
          level: "warning",
          message: `Slide ${num}: Contains copy "${match[0]}" (${rule.name}). Store copy policy requires neutral, verifiable phrasing.`,
        });
      }
    }
  });

  const emitChange = (updated: Record<string, unknown>) => {
    onChange(updated as unknown as Record<string, Value>);
  };

  const updateSlides = (nextSlides: HeroSlideItem[]) => {
    emitChange({
      ...config,
      slides: nextSlides,
    });
  };

  const handleMoveSlide = (index: number, delta: number) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= slides.length) return;
    const next = [...slides];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    updateSlides(next);
    setExpandedIndex(nextIndex);
  };

  const handleDuplicateSlide = (index: number) => {
    if (slides.length >= 10) return;
    const original = slides[index];
    const clone: HeroSlideItem = {
      ...structuredClone(original),
      title: `${original.title || "Slide"} (Copy)`,
    };
    const next = [...slides.slice(0, index + 1), clone, ...slides.slice(index + 1)];
    updateSlides(next);
    setExpandedIndex(index + 1);
  };

  const handleDeleteSlide = (index: number) => {
    if (slides.length <= 1) {
      alert("Hero slideshow must contain at least one slide.");
      return;
    }
    const next = slides.filter((_, i) => i !== index);
    updateSlides(next);
    if (expandedIndex === index) {
      setExpandedIndex(Math.max(0, index - 1));
    } else if (expandedIndex !== null && expandedIndex > index) {
      setExpandedIndex(expandedIndex - 1);
    }
  };

  const handleAddSlide = () => {
    if (slides.length >= 10) return;
    const newSlide: HeroSlideItem = {
      slideType: "split_content",
      enabled: true,
      title: "Featured Spotlight",
      subtitle: "Explore category products and details.",
      badge: "Featured",
      themePreset: "dark",
      imageBackdrop: "circle",
      button: {
        label: "View products",
        href: "/shop",
      },
    };
    const next = [...slides, newSlide];
    updateSlides(next);
    setExpandedIndex(next.length - 1);
  };

  const updateActiveSlide = (fields: Partial<HeroSlideItem>) => {
    if (expandedIndex === null || !slides[expandedIndex]) return;
    const next = [...slides];
    next[expandedIndex] = { ...next[expandedIndex], ...fields };
    updateSlides(next);
  };

  const activeSlide = expandedIndex !== null ? slides[expandedIndex] : null;

  return (
    <div className="space-y-4 text-xs">
      {/* 1. SLIDER SETTINGS (INTERVAL & CONTROLS) */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">Slider Controls</span>
          <span className="text-[11px] font-mono text-slate-500">
            {intervalSeconds}s interval
          </span>
        </div>

        {/* Interval Range Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
            <span>Autoplay Interval</span>
            <span className="font-semibold">{intervalSeconds} seconds</span>
          </div>
          <input
            type="range"
            min={3}
            max={10}
            step={1}
            value={intervalSeconds}
            onChange={(e) =>
              emitChange({
                ...config,
                intervalSeconds: Number(e.target.value),
              })
            }
            className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <div className="flex justify-between text-[10px] text-slate-600 dark:text-slate-400">
            <span>3s (Fast)</span>
            <span>5s (Default)</span>
            <span>10s (Slow)</span>
          </div>
        </div>

        {/* Control Toggles */}
        <div className="grid grid-cols-1 gap-2 pt-1 border-t border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showProgress}
              onChange={(e) =>
                emitChange({
                  ...config,
                  showProgress: e.target.checked,
                })
              }
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>Segmented progress bar</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showArrows}
              onChange={(e) =>
                emitChange({
                  ...config,
                  showArrows: e.target.checked,
                })
              }
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>Previous and next arrows</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={pauseOnHover}
              onChange={(e) =>
                emitChange({
                  ...config,
                  pauseOnHover: e.target.checked,
                })
              }
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>Pause on hover and keyboard focus</span>
          </label>
        </div>
      </div>

      {/* 2. PREFLIGHT AUDIT NOTICES */}
      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/30 p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300 text-[11px]">
            <span>⚠️</span>
            <span>Preflight Guidance ({warnings.length})</span>
          </div>
          <ul className="space-y-1 text-[11px] text-amber-700 dark:text-amber-400/90 pl-4 list-disc">
            {warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 3. SLIDES LIST WITH COMPACT CARDS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-800 dark:text-slate-200">
            Slides ({slides.length})
          </span>
          <button
            type="button"
            disabled={slides.length >= 10}
            onClick={handleAddSlide}
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 transition shadow-2xs"
          >
            + Add Slide
          </button>
        </div>

        <div className="space-y-1.5">
          {slides.map((slide, idx) => {
            const isExpanded = expandedIndex === idx;
            const asset = assets.find((a) => a.id === slide.image?.assetId);
            const preset = slide.themePreset || "light";
            const isFullBanner =
              slide.slideType === "full_banner" ||
              (!slide.slideType && slide.bannerType === "without_button");

            return (
              <div
                key={idx}
                className={`rounded-xl border transition ${
                  isExpanded
                    ? "border-indigo-500 bg-white dark:bg-slate-900 shadow-sm ring-1 ring-indigo-500"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850 hover:bg-white dark:hover:bg-slate-800"
                }`}
              >
                {/* Slide Card Header */}
                <div
                  onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                  className="flex items-center gap-2 p-2.5 cursor-pointer select-none"
                >
                  {/* Reorder Buttons */}
                  <div
                    className="flex flex-col gap-0.5 text-slate-400"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveSlide(idx, -1)}
                      className="rounded hover:bg-slate-200 dark:hover:bg-slate-700 px-1 py-0.5 disabled:opacity-20 text-[10px]"
                      title="Move Up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={idx === slides.length - 1}
                      onClick={() => handleMoveSlide(idx, 1)}
                      className="rounded hover:bg-slate-200 dark:hover:bg-slate-700 px-1 py-0.5 disabled:opacity-20 text-[10px]"
                      title="Move Down"
                    >
                      ▼
                    </button>
                  </div>

                  {/* Thumbnail */}
                  <div className="h-9 w-9 flex-shrink-0 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
                    {asset?.url ? (
                      <img
                        src={assetUrl(asset.url)}
                        alt={asset.altText || ""}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-slate-400 text-xs">🖼️</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {slide.title || `Slide ${idx + 1}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500">
                      <span className="uppercase font-mono">
                        {isFullBanner ? "Full banner" : "Spotlight"}
                      </span>
                      <span>·</span>
                      <span
                        className={`px-1.5 py-0.2 rounded font-medium ${
                          preset === "dark"
                            ? "bg-slate-900 text-lime-400"
                            : preset === "lime"
                              ? "bg-lime-300 text-slate-900"
                              : preset === "custom"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {preset}
                      </span>
                    </div>
                  </div>

                  {/* Quick Enabled Toggle */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = [...slides];
                      next[idx] = { ...next[idx], enabled: next[idx].enabled === false };
                      updateSlides(next);
                    }}
                    className={`p-1 rounded text-sm transition ${
                      slide.enabled !== false
                        ? "text-emerald-600 hover:text-emerald-700"
                        : "text-slate-300 dark:text-slate-600 hover:text-slate-400"
                    }`}
                    title={slide.enabled !== false ? "Slide is active" : "Slide is disabled"}
                  >
                    {slide.enabled !== false ? "👁️" : "🙈"}
                  </button>

                  {/* Duplicate & Delete Buttons */}
                  <div
                    className="flex items-center gap-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => handleDuplicateSlide(idx)}
                      className="p-1 text-slate-400 hover:text-indigo-600 transition"
                      title="Duplicate Slide"
                    >
                      ⧉
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSlide(idx)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition"
                      title="Delete Slide"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Expanded Slide Detail Inspector */}
                {isExpanded && activeSlide && (
                  <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 space-y-3.5 bg-white dark:bg-slate-900 rounded-b-xl">
                    {/* Status & Layout Switcher */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                        Slide Layout Mode
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateActiveSlide({
                              slideType: "split_content",
                            })
                          }
                          className={`p-2 rounded-lg border text-left font-semibold transition ${
                            !isFullBanner
                              ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500"
                              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                          }`}
                        >
                          <span className="block text-xs font-bold">✨ Spotlight Card</span>
                          <span className="text-[10px] text-slate-500 font-normal">
                            Product + Copy
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateActiveSlide({
                              slideType: "full_banner",
                            })
                          }
                          className={`p-2 rounded-lg border text-left font-semibold transition ${
                            isFullBanner
                              ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500"
                              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                          }`}
                        >
                          <span className="block text-xs font-bold">🖼️ Full Banner</span>
                          <span className="text-[10px] text-slate-500 font-normal">
                            Artwork with text
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Enable Checkbox */}
                    <label className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={activeSlide.enabled !== false}
                        onChange={(e) => updateActiveSlide({ enabled: e.target.checked })}
                        className="rounded border-slate-300 text-indigo-600"
                      />
                      <span>Enable this slide in the rotation</span>
                    </label>

                    {/* Theme Preset Selector (Spotlight only) */}
                    {!isFullBanner && (
                      <div className="space-y-2 rounded-lg border border-slate-200 dark:border-slate-800 p-2.5 bg-slate-50/60 dark:bg-slate-800/30">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                          Card Theme Preset
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(
                            [
                              { key: "dark", label: "Dark Slate", bg: "#0f172a", text: "#f8fafc" },
                              { key: "lime", label: "Lime Glow", bg: "#d8f45a", text: "#0f172a" },
                              { key: "light", label: "Warm Cream", bg: "#faf8f5", text: "#0f172a" },
                              { key: "custom", label: "Custom Hex", bg: "#ffffff", text: "#0f172a" },
                            ] as const
                          ).map((p) => {
                            const isSelected = (activeSlide.themePreset || "light") === p.key;
                            return (
                              <button
                                key={p.key}
                                type="button"
                                onClick={() =>
                                  updateActiveSlide({
                                    themePreset: p.key,
                                    customTheme:
                                      p.key === "custom" && !activeSlide.customTheme
                                        ? { bg: "#0f172a", text: "#f8fafc", accent: "#d8f45a" }
                                        : activeSlide.customTheme,
                                  })
                                }
                                className={`flex items-center gap-2 p-2 rounded-lg border text-left font-medium transition ${
                                  isSelected
                                    ? "border-indigo-600 bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-2xs ring-1 ring-indigo-500"
                                    : "border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-white"
                                }`}
                              >
                                <span
                                  className="h-3.5 w-3.5 rounded-full border border-slate-300 dark:border-slate-600 shrink-0"
                                  style={{ backgroundColor: p.bg }}
                                />
                                <span className="text-[11px] truncate">{p.label}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Custom Theme Pickers */}
                        {activeSlide.themePreset === "custom" && (
                          <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                            <span className="text-[10px] uppercase font-bold text-slate-500 block">
                              Custom Hex Palette
                            </span>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-[10px] text-slate-500 block mb-0.5">Background</label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="color"
                                    value={activeSlide.customTheme?.bg || "#0f172a"}
                                    onChange={(e) =>
                                      updateActiveSlide({
                                        customTheme: {
                                          bg: e.target.value,
                                          text: activeSlide.customTheme?.text || "#ffffff",
                                          accent: activeSlide.customTheme?.accent || "#d8f45a",
                                        },
                                      })
                                    }
                                    className="h-7 w-7 rounded border border-slate-300 cursor-pointer"
                                  />
                                  <input
                                    type="text"
                                    maxLength={7}
                                    value={activeSlide.customTheme?.bg || "#0f172a"}
                                    onChange={(e) =>
                                      updateActiveSlide({
                                        customTheme: {
                                          bg: e.target.value,
                                          text: activeSlide.customTheme?.text || "#ffffff",
                                          accent: activeSlide.customTheme?.accent || "#d8f45a",
                                        },
                                      })
                                    }
                                    className="w-full text-[10px] font-mono px-1.5 py-1 border border-slate-300 rounded"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-500 block mb-0.5">Text</label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="color"
                                    value={activeSlide.customTheme?.text || "#ffffff"}
                                    onChange={(e) =>
                                      updateActiveSlide({
                                        customTheme: {
                                          bg: activeSlide.customTheme?.bg || "#0f172a",
                                          text: e.target.value,
                                          accent: activeSlide.customTheme?.accent || "#d8f45a",
                                        },
                                      })
                                    }
                                    className="h-7 w-7 rounded border border-slate-300 cursor-pointer"
                                  />
                                  <input
                                    type="text"
                                    maxLength={7}
                                    value={activeSlide.customTheme?.text || "#ffffff"}
                                    onChange={(e) =>
                                      updateActiveSlide({
                                        customTheme: {
                                          bg: activeSlide.customTheme?.bg || "#0f172a",
                                          text: e.target.value,
                                          accent: activeSlide.customTheme?.accent || "#d8f45a",
                                        },
                                      })
                                    }
                                    className="w-full text-[10px] font-mono px-1.5 py-1 border border-slate-300 rounded"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-500 block mb-0.5">Accent</label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="color"
                                    value={activeSlide.customTheme?.accent || "#d8f45a"}
                                    onChange={(e) =>
                                      updateActiveSlide({
                                        customTheme: {
                                          bg: activeSlide.customTheme?.bg || "#0f172a",
                                          text: activeSlide.customTheme?.text || "#ffffff",
                                          accent: e.target.value,
                                        },
                                      })
                                    }
                                    className="h-7 w-7 rounded border border-slate-300 cursor-pointer"
                                  />
                                  <input
                                    type="text"
                                    maxLength={7}
                                    value={activeSlide.customTheme?.accent || "#d8f45a"}
                                    onChange={(e) =>
                                      updateActiveSlide({
                                        customTheme: {
                                          bg: activeSlide.customTheme?.bg || "#0f172a",
                                          text: activeSlide.customTheme?.text || "#ffffff",
                                          accent: e.target.value,
                                        },
                                      })
                                    }
                                    className="w-full text-[10px] font-mono px-1.5 py-1 border border-slate-300 rounded"
                                  />
                                </div>
                              </div>
                            </div>
                            {/* Contrast Ratio Result */}
                            {activeSlide.customTheme && (
                              <div className="flex items-center justify-between text-[11px] pt-1">
                                <span className="text-slate-500">Contrast Ratio:</span>
                                {(() => {
                                  const r = getContrastRatio(
                                    activeSlide.customTheme.bg,
                                    activeSlide.customTheme.text,
                                  );
                                  const pass = r >= 4.5;
                                  return (
                                    <span
                                      className={`px-1.5 py-0.5 rounded font-mono font-bold ${
                                        pass
                                          ? "bg-emerald-100 text-emerald-800"
                                          : "bg-rose-100 text-rose-800"
                                      }`}
                                    >
                                      {r.toFixed(2)}:1 {pass ? "✓ AA Pass" : "✗ AA Fail (<4.5:1)"}
                                    </span>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Image Backdrop Selector (Spotlight only) */}
                    {!isFullBanner && (
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                          Image Backdrop Graphic
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {(
                            [
                              { key: "none", label: "None" },
                              { key: "circle", label: "Soft Circle" },
                              { key: "lime_ring", label: "Lime Ring" },
                            ] as const
                          ).map((b) => (
                            <button
                              key={b.key}
                              type="button"
                              onClick={() => updateActiveSlide({ imageBackdrop: b.key })}
                              className={`p-1.5 rounded-lg border text-center text-[11px] font-medium transition ${
                                (activeSlide.imageBackdrop || "none") === b.key
                                  ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500"
                                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                              }`}
                            >
                              {b.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Copy Inputs (Spotlight only) */}
                    {!isFullBanner && (
                      <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                        {/* Eyebrow / Badge */}
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                            Eyebrow Pill (Badge)
                          </label>
                          <input
                            type="text"
                            value={activeSlide.badge || ""}
                            onChange={(e) => updateActiveSlide({ badge: e.target.value })}
                            placeholder="e.g. Studio Gear"
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                          />
                        </div>

                        {/* Headline */}
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                            Headline Title
                          </label>
                          <input
                            type="text"
                            value={activeSlide.title || ""}
                            onChange={(e) => updateActiveSlide({ title: e.target.value })}
                            placeholder="Cameras and lighting equipment"
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                          />
                        </div>

                        {/* Subtitle */}
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                            Subtitle Text
                          </label>
                          <textarea
                            rows={2}
                            value={activeSlide.subtitle || ""}
                            onChange={(e) => updateActiveSlide({ subtitle: e.target.value })}
                            placeholder="Explore verified gear and accessories."
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 resize-none"
                          />
                        </div>

                        {/* Primary Button */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">Primary Button Label</label>
                            <input
                              type="text"
                              value={activeSlide.button?.label || ""}
                              onChange={(e) =>
                                updateActiveSlide({
                                  button: {
                                    href: activeSlide.button?.href || "/shop",
                                    label: e.target.value,
                                  },
                                })
                              }
                              placeholder="View products"
                              className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">Primary Button Link</label>
                            <input
                              type="text"
                              value={activeSlide.button?.href || ""}
                              onChange={(e) =>
                                updateActiveSlide({
                                  button: {
                                    label: activeSlide.button?.label || "Explore",
                                    href: e.target.value,
                                  },
                                })
                              }
                              placeholder="/shop"
                              className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-mono"
                            />
                          </div>
                        </div>

                        {/* Secondary Button Toggle */}
                        <div className="space-y-1.5 pt-1">
                          <label className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                            <input
                              type="checkbox"
                              checked={Boolean(activeSlide.secondaryButton)}
                              onChange={(e) =>
                                updateActiveSlide({
                                  secondaryButton: e.target.checked
                                    ? { label: "Learn more", href: "/help" }
                                    : undefined,
                                })
                              }
                              className="rounded border-slate-300 text-indigo-600"
                            />
                            <span>Include secondary button</span>
                          </label>

                          {activeSlide.secondaryButton && (
                            <div className="grid grid-cols-2 gap-2 pl-4">
                              <div>
                                <label className="text-[10px] text-slate-500 block mb-0.5">Secondary Label</label>
                                <input
                                  type="text"
                                  value={activeSlide.secondaryButton.label || ""}
                                  onChange={(e) =>
                                    updateActiveSlide({
                                      secondaryButton: {
                                        href: activeSlide.secondaryButton?.href || "/help",
                                        label: e.target.value,
                                      },
                                    })
                                  }
                                  placeholder="Learn more"
                                  className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-500 block mb-0.5">Secondary Link</label>
                                <input
                                  type="text"
                                  value={activeSlide.secondaryButton.href || ""}
                                  onChange={(e) =>
                                    updateActiveSlide({
                                      secondaryButton: {
                                        label: activeSlide.secondaryButton?.label || "Learn more",
                                        href: e.target.value,
                                      },
                                    })
                                  }
                                  placeholder="/help"
                                  className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-mono"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Full Banner Link */}
                    {isFullBanner && (
                      <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                            Banner Accessible Title
                          </label>
                          <input
                            type="text"
                            value={activeSlide.title || ""}
                            onChange={(e) => updateActiveSlide({ title: e.target.value })}
                            placeholder="Featured campaign banner"
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                            Click Destination URL
                          </label>
                          <input
                            type="text"
                            value={activeSlide.bannerLink || activeSlide.button?.href || ""}
                            onChange={(e) =>
                              updateActiveSlide({
                                bannerLink: e.target.value,
                              })
                            }
                            placeholder="/shop"
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      </div>
                    )}

                    {/* Desktop Image Selector */}
                    <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          Desktop Image
                        </label>
                        {activeSlide.image?.assetId && (
                          <button
                            type="button"
                            onClick={() => updateActiveSlide({ image: undefined })}
                            className="text-[10px] text-rose-600 hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {(() => {
                          const asset = assets.find((a) => a.id === activeSlide.image?.assetId);
                          return asset?.url ? (
                            <img
                              src={assetUrl(asset.url)}
                              alt={asset.altText || ""}
                              className="h-12 w-12 rounded-lg border border-slate-200 dark:border-slate-700 object-cover"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400">
                              📷
                            </div>
                          );
                        })()}
                        <button
                          type="button"
                          onClick={() => setPickerTarget({ slideIndex: idx, field: "image" })}
                          className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition shadow-2xs"
                        >
                          🖼️ Choose Media
                        </button>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">
                          Descriptive Alt Text (for screen readers)
                        </label>
                        <input
                          type="text"
                          value={activeSlide.image?.alt || ""}
                          onChange={(e) =>
                            updateActiveSlide({
                              image: {
                                assetId: activeSlide.image?.assetId,
                                alt: e.target.value,
                              },
                            })
                          }
                          placeholder="e.g. Studio camera with 50mm lens on tripod"
                          className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs"
                        />
                      </div>
                    </div>

                    {/* Mobile Image Selector (Optional) */}
                    <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          Mobile Image (Optional Crop)
                        </label>
                        {activeSlide.mobileImage?.assetId && (
                          <button
                            type="button"
                            onClick={() => updateActiveSlide({ mobileImage: undefined })}
                            className="text-[10px] text-rose-600 hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {(() => {
                          const asset = assets.find((a) => a.id === activeSlide.mobileImage?.assetId);
                          return asset?.url ? (
                            <img
                              src={assetUrl(asset.url)}
                              alt={asset.altText || ""}
                              className="h-12 w-12 rounded-lg border border-slate-200 dark:border-slate-700 object-cover"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400">
                              📱
                            </div>
                          );
                        })()}
                        <button
                          type="button"
                          onClick={() => setPickerTarget({ slideIndex: idx, field: "mobileImage" })}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition shadow-2xs"
                        >
                          📱 Choose Mobile Crop
                        </button>
                      </div>

                      {activeSlide.mobileImage?.assetId && (
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-0.5">
                            Mobile Alt Text
                          </label>
                          <input
                            type="text"
                            value={activeSlide.mobileImage?.alt || ""}
                            onChange={(e) =>
                              updateActiveSlide({
                                mobileImage: {
                                  assetId: activeSlide.mobileImage?.assetId,
                                  alt: e.target.value,
                                },
                              })
                            }
                            placeholder="Mobile product presentation"
                            className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Media Picker Modal */}
      {pickerTarget !== null && (
        <MediaPickerModal
          isOpen={true}
          assets={assets}
          currentAssetId={
            pickerTarget.field === "image"
              ? slides[pickerTarget.slideIndex]?.image?.assetId
              : slides[pickerTarget.slideIndex]?.mobileImage?.assetId
          }
          onClose={() => setPickerTarget(null)}
          onSelect={(assetId, asset) => {
            const next = [...slides];
            const current = next[pickerTarget.slideIndex];
            if (current) {
              const currentImg =
                pickerTarget.field === "image" ? current.image : current.mobileImage;
              const nextImg = {
                assetId,
                alt: currentImg?.alt || asset?.altText || "",
              };
              next[pickerTarget.slideIndex] = {
                ...current,
                [pickerTarget.field]: nextImg,
              };
              updateSlides(next);
            }
            setPickerTarget(null);
          }}
        />
      )}
    </div>
  );
}
