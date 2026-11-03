"use client";

import { useRef, useState } from "react";
import { type Asset, type Value, assetUrl, request } from "./cms-api";
import { MediaPickerModal } from "./media-picker-modal";

export interface HeroSlideItem {
  id?: string;
  enabled?: boolean;
  imageUrl?: string;
  image?: { assetId?: string; url?: string; alt?: string };
  href?: string;
  bannerLink?: string;
  alt?: string;
  title?: string;
  // Legacy fields kept for backward compatibility
  slideType?: "split_content" | "full_banner";
  subtitle?: string;
  bannerType?: "with_button" | "without_button";
  button?: { label?: string; href?: string };
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
  image?: { assetId?: string; url?: string; alt?: string };
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

const DEFAULT_BANNER = "/brand/hero-banner-main.png";

export function HeroInspector({ config, onChange, assets }: HeroInspectorProps) {
  // Initialize slides list
  const slides: HeroSlideItem[] = Array.isArray(config.slides) && config.slides.length > 0
    ? config.slides
    : [
        {
          id: "slide-1",
          enabled: true,
          imageUrl: DEFAULT_BANNER,
          href: "/shop",
          alt: "Shop Smart. Live Smart.",
        },
      ];

  const intervalSeconds = Number(config.intervalSeconds ?? 5);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [pickerSlideIndex, setPickerSlideIndex] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadSlideIndex, setUploadSlideIndex] = useState<number | null>(null);

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
      id: `slide-${Date.now()}`,
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
      id: `slide-${Date.now()}`,
      enabled: true,
      imageUrl: DEFAULT_BANNER,
      href: "/shop",
      alt: `Hero Banner ${slides.length + 1}`,
    };
    const next = [...slides, newSlide];
    updateSlides(next);
    setExpandedIndex(next.length - 1);
  };

  const updateActiveSlide = (index: number, fields: Partial<HeroSlideItem>) => {
    const next = [...slides];
    next[index] = { ...next[index], ...fields };
    updateSlides(next);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, slideIdx: number) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const form = new FormData();
      form.append("file", file);
      const uploaded = await request<Asset>("/admin/cms/media", {
        method: "POST",
        body: form,
      });

      if (uploaded?.url) {
        updateActiveSlide(slideIdx, {
          imageUrl: uploaded.url,
          image: { assetId: uploaded.id, url: uploaded.url },
        });
      }
    } catch (err) {
      alert("Image upload failed. Please try again or use the Media Library.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {/* 1. SLIDER AUTOPLAY SETTING */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
            Slider Autoplay Settings
          </span>
          <span className="text-[11px] font-mono text-slate-500">{intervalSeconds}s interval</span>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
            <span>Slide Duration</span>
            <span>{intervalSeconds} seconds</span>
          </div>
          <input
            type="range"
            min={3}
            max={15}
            step={1}
            value={intervalSeconds}
            onChange={(e) => emitChange({ ...config, intervalSeconds: Number(e.target.value) })}
            className="w-full accent-indigo-600 cursor-pointer"
          />
        </div>
      </div>

      {/* 2. HERO SLIDES MANAGER (IMAGE & HREF ONLY) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">
              Hero Banner Slides ({slides.length})
            </h4>
            <p className="text-[11px] text-slate-500">
              Each slide has an image and a link URL.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddSlide}
            disabled={slides.length >= 10}
            className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[11px] flex items-center gap-1 shadow-xs transition disabled:opacity-50"
          >
            <span>+</span> Add Slide
          </button>
        </div>

        {/* Hidden File Input for Direct Upload */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (uploadSlideIndex !== null) {
              handleFileUpload(e, uploadSlideIndex);
            }
          }}
        />

        <div className="space-y-2">
          {slides.map((slide, idx) => {
            const isExpanded = expandedIndex === idx;
            const asset = assets.find((a) => a.id === slide.image?.assetId);
            const currentImg =
              slide.imageUrl ||
              (asset?.url ? assetUrl(asset.url) : "") ||
              slide.image?.url ||
              DEFAULT_BANNER;
            const currentHref = slide.href || slide.bannerLink || "/shop";

            return (
              <div
                key={slide.id || idx}
                className={`rounded-xl border transition ${
                  isExpanded
                    ? "border-indigo-500 bg-white dark:bg-slate-900 shadow-sm ring-1 ring-indigo-500"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850 hover:bg-white dark:hover:bg-slate-800"
                }`}
              >
                {/* Header Row */}
                <div
                  onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                  className="flex items-center gap-2.5 p-2.5 cursor-pointer select-none"
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

                  {/* Thumbnail Preview */}
                  <div className="h-10 w-16 flex-shrink-0 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentImg}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = DEFAULT_BANNER;
                      }}
                    />
                  </div>

                  {/* Slide Info */}
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 truncate block">
                      Slide {idx + 1}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono truncate block">
                      Link: {currentHref}
                    </span>
                  </div>

                  {/* Enable / Disable Toggle */}
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
                    title={slide.enabled !== false ? "Slide is active" : "Slide is hidden"}
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

                {/* Expanded Slide Detail: Image & Link Only */}
                {isExpanded && (
                  <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 space-y-4 bg-white dark:bg-slate-900 rounded-b-xl">
                    {/* 1. IMAGE OPTION */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block">
                        Slide Banner Image
                      </label>

                      {/* Large Thumbnail Preview */}
                      <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 aspect-[16/7] bg-slate-900">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={currentImg}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = DEFAULT_BANNER;
                          }}
                        />
                      </div>

                      {/* Action Buttons: Upload or Pick Media */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPickerSlideIndex(idx)}
                          className="flex-1 py-1.5 px-3 rounded-lg border border-slate-300 dark:border-slate-700 hover:border-indigo-500 font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 text-center transition flex items-center justify-center gap-1.5"
                        >
                          <span>📁</span> Choose from Media Library
                        </button>
                        <button
                          type="button"
                          disabled={isUploading}
                          onClick={() => {
                            setUploadSlideIndex(idx);
                            fileInputRef.current?.click();
                          }}
                          className="py-1.5 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-300 transition"
                        >
                          {isUploading ? "Uploading..." : "⬆ Upload Image"}
                        </button>
                      </div>

                      {/* Direct URL Input */}
                      <div className="space-y-1 pt-1">
                        <label className="text-[10px] text-slate-500 font-medium block">
                          Or enter direct Image URL / Path:
                        </label>
                        <input
                          type="text"
                          value={slide.imageUrl || ""}
                          placeholder="/brand/hero-banner-main.png or https://..."
                          onChange={(e) =>
                            updateActiveSlide(idx, {
                              imageUrl: e.target.value,
                              image: { url: e.target.value },
                            })
                          }
                          className="w-full text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                        />
                      </div>
                    </div>

                    {/* 2. HREF OPTION */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block">
                        Link URL (href)
                      </label>
                      <input
                        type="text"
                        value={slide.href || slide.bannerLink || ""}
                        placeholder="/category/electronics, /shop, etc."
                        onChange={(e) =>
                          updateActiveSlide(idx, {
                            href: e.target.value,
                            bannerLink: e.target.value,
                          })
                        }
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                      />
                      <p className="text-[10px] text-slate-400">
                        When customers click on this banner, they will be taken to this link.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Media Picker Modal */}
      {pickerSlideIndex !== null && (
        <MediaPickerModal
          isOpen={true}
          assets={assets}
          currentAssetId={slides[pickerSlideIndex]?.image?.assetId}
          onClose={() => setPickerSlideIndex(null)}
          onSelect={(assetId, asset) => {
            if (pickerSlideIndex !== null) {
              const url = asset?.url ? assetUrl(asset.url) : "";
              updateActiveSlide(pickerSlideIndex, {
                imageUrl: url,
                image: { assetId, url },
              });
            }
            setPickerSlideIndex(null);
          }}
        />
      )}
    </div>
  );
}
