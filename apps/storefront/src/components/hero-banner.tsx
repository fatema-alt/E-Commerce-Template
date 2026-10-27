"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import type { Asset, Image } from "../lib/cms";
import { assetSource, safeHref } from "../lib/cms";
import type { HeroBlock } from "../lib/storefront";

interface HeroBannerProps {
  config?: Record<string, unknown>;
  assets?: Asset[];
  block?: HeroBlock;
}

interface SlideItem {
  id: string;
  bannerType: string;
  badge?: string;
  badgeColor?: string;
  title?: string;
  subtitle?: string;
  bannerLink: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  hasCustomImage: boolean;
  imageSrc?: string | null;
  imageAlt?: string;
  floatingBadges?: Array<{ icon: string; text: string }>;
  themeGradient: string;
}

export function HeroBanner({ config, assets = [], block }: HeroBannerProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Extract merchant custom values if provided in CMS or fallback block
  const cmsTitle = (config?.title as string) || block?.title;
  const cmsSubtitle = (config?.subtitle as string) || block?.description;
  const bannerType = (config?.bannerType as string) || "with_button";
  const bannerLink =
    (config?.bannerLink as string) ||
    (config?.button as { href?: string })?.href ||
    block?.ctaHref ||
    "/shop";
  const cmsButton = (config?.button as { label?: string; href?: string }) || (
    block?.ctaLabel && block?.ctaHref
      ? { label: block.ctaLabel, href: block.ctaHref }
      : undefined
  );
  const cmsImage = config?.image as Image | undefined;
  const cmsImageSrc = assetSource(assets, cmsImage?.assetId);

  // 1. Determine slides:
  // If merchant configured multi-slides array, use those.
  // Else if merchant configured a banner (has image or customized title/button), keep it as a dedicated SINGLE BANNER (do not slide away to dummy slides!).
  // Else (unconfigured demo state), show the 3 demo slides.
  const customSlides = Array.isArray(config?.slides) && config.slides.length > 0 ? (config.slides as Record<string, unknown>[]) : null;

  let slides: SlideItem[] = [];

  if (customSlides) {
    slides = customSlides.map((s, idx) => {
      const sImg = s.image as Image | undefined;
      const sImgSrc = assetSource(assets, sImg?.assetId);
      const sBtn = s.button as { label?: string; href?: string } | undefined;
      return {
        id: `slide-custom-${idx}`,
        bannerType: (s.bannerType as string) || bannerType,
        badge: (s.badge as string) || "🔥 SPECIAL CAMPAIGN",
        badgeColor: "amber",
        title: (s.title as string) || "",
        subtitle: (s.subtitle as string) || "",
        bannerLink: (s.bannerLink as string) || sBtn?.href || "/shop",
        primaryCta: sBtn ? { label: sBtn.label || "Shop Now ↗", href: sBtn.href || "/shop" } : undefined,
        hasCustomImage: Boolean(sImgSrc),
        imageSrc: sImgSrc,
        imageAlt: sImg?.alt || (s.title as string) || "Promotional banner",
        themeGradient: "linear-gradient(135deg, rgba(216,244,90,0.18), rgba(255,255,255,0.02))",
      };
    });
  } else if (cmsImageSrc || cmsTitle) {
    // Single merchant banner: DO NOT slide away to dummy slides!
    slides = [
      {
        id: "slide-merchant-primary",
        bannerType,
        badge: "🔥 MEGA SHOPPING FESTIVAL • UP TO 60% OFF",
        badgeColor: "amber",
        title: cmsTitle || "Shop Smart. Live Smart.",
        subtitle:
          cmsSubtitle ||
          "Discover top-tier electronics, fashion, lifestyle, and daily essentials with lightning-fast delivery and Cash on Delivery across Bangladesh.",
        bannerLink,
        primaryCta: {
          label: cmsButton?.label || "Start Shopping ↗",
          href: cmsButton?.href ? safeHref(cmsButton.href) || "/shop" : "/shop",
        },
        secondaryCta: {
          label: "Explore Top Deals",
          href: "/shop",
        },
        hasCustomImage: Boolean(cmsImageSrc),
        imageSrc: cmsImageSrc,
        imageAlt: cmsImage?.alt || cmsTitle || "Featured promotional banner",
        floatingBadges: [
          { icon: "🏷️", text: "Flat 20% Extra OFF" },
          { icon: "⚡", text: "Fast 24-48h Delivery" },
          { icon: "★", text: "4.9 (1.2k+ Reviews)" },
        ],
        themeGradient: "linear-gradient(135deg, rgba(216,244,90,0.18), rgba(255,255,255,0.02))",
      },
    ];
  } else {
    // Initial demo fallback
    slides = [
      {
        id: "slide-demo-main",
        bannerType,
        badge: "🔥 MEGA SHOPPING FESTIVAL • UP TO 60% OFF",
        badgeColor: "amber",
        title: "Shop Smart. Live Smart.",
        subtitle:
          "Discover top-tier electronics, fashion, lifestyle, and daily essentials with lightning-fast delivery and Cash on Delivery across Bangladesh.",
        bannerLink: "/shop",
        primaryCta: { label: "Start Shopping ↗", href: "/shop" },
        secondaryCta: { label: "Explore Top Deals", href: "/shop" },
        hasCustomImage: false,
        floatingBadges: [
          { icon: "🏷️", text: "Flat 20% Extra OFF" },
          { icon: "⚡", text: "Fast 24-48h Delivery" },
          { icon: "★", text: "4.9 (1.2k+ Reviews)" },
        ],
        themeGradient: "linear-gradient(135deg, rgba(216,244,90,0.18), rgba(255,255,255,0.02))",
      },
      {
        id: "slide-demo-tech",
        bannerType,
        badge: "⚡ 100% GENUINE & AUTHORIZED DISTRIBUTOR",
        badgeColor: "emerald",
        title: "Next-Gen Electronics & Smart Gadgets",
        subtitle:
          "Directly sourced original smartphones, audio gear, computing accessories, and home appliances with manufacturer warranty support.",
        bannerLink: "/category/electronics",
        primaryCta: { label: "Shop Electronics ↗", href: "/category/electronics" },
        secondaryCta: { label: "Official Warranty 🛡️", href: "/help" },
        hasCustomImage: false,
        floatingBadges: [
          { icon: "🛡️", text: "100% Brand Warranty" },
          { icon: "🎧", text: "Original Audio Gear" },
          { icon: "💳", text: "0% EMI & bKash Cashback" },
        ],
        themeGradient: "linear-gradient(135deg, rgba(56,189,248,0.18), rgba(255,255,255,0.02))",
      },
      {
        id: "slide-demo-savings",
        bannerType,
        badge: "🎉 EXCLUSIVE VOUCHER DISCOUNT",
        badgeColor: "purple",
        title: "Save More on Every Single Order",
        subtitle:
          "Apply verified promo voucher codes during checkout. Free doorstep delivery on qualifying orders all across Bangladesh.",
        bannerLink: "/shop",
        primaryCta: { label: "Grab Discount Deals ↗", href: "/shop" },
        secondaryCta: { label: "Use Code: DSMART250", href: "/shop" },
        hasCustomImage: false,
        floatingBadges: [
          { icon: "💰", text: "Save Flat ৳250" },
          { icon: "🚚", text: "Cash on Delivery (COD)" },
          { icon: "🔄", text: "Easy 7-Day Returns" },
        ],
        themeGradient: "linear-gradient(135deg, rgba(244,114,182,0.18), rgba(255,255,255,0.02))",
      },
    ];
  }

  const totalSlides = slides.length;
  const hasMultipleSlides = totalSlides > 1;

  const nextSlide = useCallback(() => {
    setActiveSlide((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    setActiveSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  useEffect(() => {
    if (isPaused || !hasMultipleSlides) return;
    const interval = setInterval(nextSlide, 5000);
    return () => clearInterval(interval);
  }, [isPaused, hasMultipleSlides, nextSlide]);

  return (
    <section
      className="hero-banner-ecosystem w-full"
      aria-label="Promotional campaign banner slider"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* 1. Full-Width Carousel Slider (No Side Cards) */}
      <div className="hero-banner-main-grid w-full">
        <div className="hero-carousel-card w-full relative overflow-hidden min-h-[380px] md:min-h-[460px]">
          {/* Stacked Slides - ALL SLIDES REMAIN MOUNTED IN DOM SO IMAGES NEVER UNMOUNT OR DISAPPEAR */}
          {slides.map((slide, idx) => {
            const isActive = idx === activeSlide;
            const isGraphicOnly = slide.bannerType === "without_button";

            return (
              <div
                key={slide.id}
                className={`hero-slide-surface ${isGraphicOnly ? "is-graphic" : ""} transition-opacity duration-700 ease-in-out ${
                  isActive
                    ? "opacity-100 relative z-10 pointer-events-auto"
                    : "opacity-0 absolute inset-0 z-0 pointer-events-none"
                }`}
                style={{ background: slide.themeGradient }}
              >
                {isGraphicOnly ? (
                  /* TYPE 2: WITHOUT BUTTON (Pure Graphic Image Banner - Fully Clickable) */
                  <Link
                    href={safeHref(slide.bannerLink) || "/shop"}
                    className="hero-graphic-link block w-full h-full min-h-[360px]"
                    aria-label={slide.title || "Promotional banner"}
                  >
                    {slide.hasCustomImage && slide.imageSrc ? (
                      <img
                        src={slide.imageSrc}
                        alt={slide.imageAlt || slide.title || "Promotional Banner"}
                        className="hero-graphic-img w-full h-full object-cover"
                        loading="eager"
                        decoding="sync"
                      />
                    ) : (
                      <div className="hero-graphic-placeholder">
                        <div className="hero-artwork-glow" aria-hidden="true" />
                        <span className="inline-block px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold tracking-wider mb-3">
                          🔥 SPECIAL PROMOTION
                        </span>
                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-2">
                          {slide.title || "DSMART PROMOTIONAL BANNER"}
                        </h2>
                        <p className="text-white/80 text-sm md:text-base max-w-xl mb-4">
                          {slide.subtitle ||
                            "Discover top electronics, fashion, lifestyle with verified warranties & nationwide Cash on Delivery."}
                        </p>
                        <span className="inline-flex items-center gap-1.5 text-xs text-white/70 font-semibold uppercase tracking-wider">
                          Click anywhere on banner to explore deals ↗
                        </span>
                      </div>
                    )}
                  </Link>
                ) : (
                  /* TYPE 1: WITH BUTTON (Interactive Banner with Headline, Subtitle & Action Buttons) */
                  <>
                    <div className="hero-slide-content">
                      {slide.badge && (
                        <span className={`hero-campaign-badge badge-${slide.badgeColor || "amber"}`}>
                          {slide.badge}
                        </span>
                      )}

                      <h1 className="hero-title">{slide.title}</h1>

                      <p className="hero-subtitle">{slide.subtitle}</p>

                      <div className="hero-cta-group">
                        {slide.primaryCta && (
                          <Link
                            href={slide.primaryCta.href}
                            className="primary-button hero-primary-btn"
                          >
                            {slide.primaryCta.label}
                          </Link>
                        )}

                        {slide.secondaryCta && (
                          <Link
                            href={slide.secondaryCta.href}
                            className="hero-secondary-btn"
                          >
                            {slide.secondaryCta.label}
                          </Link>
                        )}
                      </div>
                    </div>

                    <div className="hero-slide-visual">
                      {slide.hasCustomImage && slide.imageSrc ? (
                        <div className="hero-custom-image-wrapper">
                          <img
                            src={slide.imageSrc}
                            alt={slide.imageAlt || slide.title || "Featured product"}
                            className="hero-uploaded-img"
                            loading="eager"
                            decoding="sync"
                          />
                        </div>
                      ) : (
                        <div className="hero-visual-composition">
                          <div className="hero-artwork-glow" aria-hidden="true" />
                          <div className="hero-central-emblem">
                            <img
                              src="/brand/ds-symbol.png"
                              alt="DS Mart"
                              width={280}
                              height={280}
                              className="hero-floating-emblem"
                            />
                          </div>

                          {slide.floatingBadges?.map((b, bIdx) => (
                            <div
                              key={bIdx}
                              className={`hero-micro-badge badge-pos-${bIdx + 1}`}
                              aria-hidden="true"
                            >
                              <span className="badge-icon">{b.icon}</span>
                              <span className="badge-text">{b.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {/* Carousel Controls Overlay (Only if multiple slides exist) */}
          {hasMultipleSlides && (
            <div className="hero-carousel-controls">
              <button
                type="button"
                onClick={prevSlide}
                aria-label="Previous promotional slide"
                className="carousel-arrow-btn prev-btn"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              <div className="carousel-dots-row">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveSlide(i)}
                    aria-label={`Go to slide ${i + 1}`}
                    className={`carousel-dot ${i === activeSlide ? "active" : ""}`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={nextSlide}
                aria-label="Next promotional slide"
                className="carousel-arrow-btn next-btn"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Bottom Trust & Value Strip (Compact & Modern) */}
      <div className="hero-trust-strip" aria-label="Customer service promises">
        <div className="trust-strip-item">
          <div className="trust-icon-box">🛡️</div>
          <div className="trust-text">
            <strong>100% Authentic Guarantee</strong>
            <span>Directly sourced from authorized brand distributors</span>
          </div>
        </div>

        <div className="trust-strip-item">
          <div className="trust-icon-box">💵</div>
          <div className="trust-text">
            <strong>Cash on Delivery (COD)</strong>
            <span>Pay safely at doorstep anywhere across Bangladesh</span>
          </div>
        </div>

        <div className="trust-strip-item">
          <div className="trust-icon-box">🔄</div>
          <div className="trust-text">
            <strong>7-Day Easy Returns</strong>
            <span>Simple replacements or hassle-free full refunds</span>
          </div>
        </div>

        <div className="trust-strip-item">
          <div className="trust-icon-box">📞</div>
          <div className="trust-text">
            <strong>24/7 Dedicated Care</strong>
            <span>Friendly customer assistance via hotline & chat</span>
          </div>
        </div>
      </div>
    </section>
  );
}
