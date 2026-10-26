"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, type CSSProperties } from "react";
import type { Asset, Image } from "../lib/cms";
import { assetSource, safeHref } from "../lib/cms";
import type { HeroBlock } from "../lib/storefront";

interface HeroBannerProps {
  config?: Record<string, unknown>;
  assets?: Asset[];
  block?: HeroBlock;
}

export function HeroBanner({ config, assets = [], block }: HeroBannerProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Extract merchant custom values if provided in CMS or fallback block
  const cmsTitle = (config?.title as string) || block?.title;
  const cmsSubtitle = (config?.subtitle as string) || block?.description;
  const cmsButton = (config?.button as { label?: string; href?: string }) || (
    block?.ctaLabel && block?.ctaHref
      ? { label: block.ctaLabel, href: block.ctaHref }
      : undefined
  );
  const cmsImage = config?.image as Image | undefined;
  const cmsImageSrc = assetSource(assets, cmsImage?.assetId);

  const slides = [
    {
      id: "slide-main",
      badge: "🔥 MEGA SHOPPING FESTIVAL • UP TO 60% OFF",
      badgeColor: "amber",
      title: cmsTitle || "Shop Smart. Live Smart.",
      subtitle:
        cmsSubtitle ||
        "Discover top-tier electronics, fashion, lifestyle, and daily essentials with lightning-fast delivery and Cash on Delivery across Bangladesh.",
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
      imageAlt: cmsImage?.alt || cmsTitle || "Featured products",
      floatingBadges: [
        { icon: "🏷️", text: "Flat 20% Extra OFF" },
        { icon: "⚡", text: "Fast 24-48h Delivery" },
        { icon: "★", text: "4.9 (1.2k+ Reviews)" },
      ],
      themeGradient: "linear-gradient(135deg, rgba(216,244,90,0.18), rgba(255,255,255,0.02))",
    },
    {
      id: "slide-tech",
      badge: "⚡ 100% GENUINE & AUTHORIZED DISTRIBUTOR",
      badgeColor: "emerald",
      title: "Next-Gen Electronics & Smart Gadgets",
      subtitle:
        "Directly sourced original smartphones, audio gear, computing accessories, and home appliances with manufacturer warranty support.",
      primaryCta: {
        label: "Shop Electronics ↗",
        href: "/category/electronics",
      },
      secondaryCta: {
        label: "Official Warranty 🛡️",
        href: "/help",
      },
      hasCustomImage: false,
      floatingBadges: [
        { icon: "🛡️", text: "100% Brand Warranty" },
        { icon: "🎧", text: "Original Audio Gear" },
        { icon: "💳", text: "0% EMI & bKash Cashback" },
      ],
      themeGradient: "linear-gradient(135deg, rgba(56,189,248,0.18), rgba(255,255,255,0.02))",
    },
    {
      id: "slide-savings",
      badge: "🎉 EXCLUSIVE VOUCHER DISCOUNT",
      badgeColor: "purple",
      title: "Save More on Every Single Order",
      subtitle:
        "Apply verified promo voucher codes during checkout. Free doorstep delivery on qualifying orders all across Bangladesh.",
      primaryCta: {
        label: "Grab Discount Deals ↗",
        href: "/shop",
      },
      secondaryCta: {
        label: "Use Code: DSMART250",
        href: "/shop",
      },
      hasCustomImage: false,
      floatingBadges: [
        { icon: "💰", text: "Save Flat ৳250" },
        { icon: "🚚", text: "Cash on Delivery (COD)" },
        { icon: "🔄", text: "Easy 7-Day Returns" },
      ],
      themeGradient: "linear-gradient(135deg, rgba(244,114,182,0.18), rgba(255,255,255,0.02))",
    },
  ];

  const totalSlides = slides.length;

  const nextSlide = useCallback(() => {
    setActiveSlide((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    setActiveSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(nextSlide, 5000);
    return () => clearInterval(interval);
  }, [isPaused, nextSlide]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const current = slides[activeSlide];

  return (
    <section
      className="hero-banner-ecosystem"
      aria-label="Promotional campaign banner"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* 1. Main Banner Grid: Carousel (Left) + Side Deals (Right) */}
      <div className="hero-banner-main-grid">
        {/* Carousel Slider */}
        <div className="hero-carousel-card">
          <div
            className="hero-slide-surface"
            style={{ background: current.themeGradient }}
          >
            {/* Slide Content */}
            <div className="hero-slide-content">
              <span className={`hero-campaign-badge badge-${current.badgeColor}`}>
                {current.badge}
              </span>

              <h1 className="hero-title">{current.title}</h1>

              <p className="hero-subtitle">{current.subtitle}</p>

              <div className="hero-cta-group">
                <Link
                  href={current.primaryCta.href}
                  className="primary-button hero-primary-btn"
                >
                  {current.primaryCta.label}
                </Link>

                {current.secondaryCta && (
                  <Link
                    href={current.secondaryCta.href}
                    className="hero-secondary-btn"
                  >
                    {current.secondaryCta.label}
                  </Link>
                )}
              </div>
            </div>

            {/* Slide Visual Presentation */}
            <div className="hero-slide-visual">
              {current.hasCustomImage && current.imageSrc ? (
                <div className="hero-custom-image-wrapper">
                  <img
                    src={current.imageSrc}
                    alt={current.imageAlt}
                    className="hero-uploaded-img"
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

                  {/* Floating Micro-Badges */}
                  {current.floatingBadges.map((badge, idx) => (
                    <div
                      key={idx}
                      className={`hero-micro-badge badge-pos-${idx + 1}`}
                      aria-hidden="true"
                    >
                      <span className="badge-icon">{badge.icon}</span>
                      <span className="badge-text">{badge.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Carousel Controls Overlay */}
          <div className="hero-carousel-controls">
            <button
              type="button"
              onClick={prevSlide}
              aria-label="Previous promotional slide"
              className="carousel-arrow-btn prev-btn"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {/* Slide Indicator Dots */}
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>

        {/* 2. Side Mini-Banners (Cartup Inspiration) */}
        <aside className="hero-side-banners" aria-label="Featured deals and benefits">
          {/* Side Banner 1: Voucher Card */}
          <div className="hero-side-card voucher-card">
            <div className="side-card-header">
              <span className="side-badge">🎉 SPECIAL VOUCHER</span>
              <span className="side-chip-discount">-৳250 OFF</span>
            </div>

            <h3 className="side-card-title">Flat ৳250 Discount</h3>
            <p className="side-card-sub">
              Enjoy flat savings on your first order of ৳1,500+. Use code:
            </p>

            <div className="side-coupon-action">
              <button
                type="button"
                onClick={() => handleCopyCode("DSMART250")}
                className="coupon-copy-pill"
                title="Click to copy coupon code"
              >
                <span className="code-text">DSMART250</span>
                <span className="copy-icon-wrap">
                  {copiedCode ? (
                    <span className="copied-text">✓ Copied</span>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </span>
              </button>

              <Link href="/shop" className="side-claim-btn">
                Claim Now ↗
              </Link>
            </div>
          </div>

          {/* Side Banner 2: Nationwide Cash on Delivery Assurance */}
          <div className="hero-side-card shipping-card">
            <div className="side-card-header">
              <span className="side-badge">🚚 NATIONWIDE COD</span>
              <span className="side-chip-speed">24-48h</span>
            </div>

            <h3 className="side-card-title">Cash on Delivery (COD)</h3>
            <p className="side-card-sub">
              Order with zero upfront payment. Pay cash or bKash right at your doorstep.
            </p>

            <ul className="side-highlights-list">
              <li>
                <span className="check-bullet">✓</span> Inside Dhaka: <strong>24–48 Hours</strong>
              </li>
              <li>
                <span className="check-bullet">✓</span> Nationwide (64 Districts): <strong>2–4 Days</strong>
              </li>
              <li>
                <span className="check-bullet">✓</span> Inspect parcel before paying
              </li>
            </ul>

            <Link href="/shop" className="side-explore-link">
              Start Shopping with COD ↗
            </Link>
          </div>
        </aside>
      </div>

      {/* 3. Bottom Trust & Value Strip (Cartup Inspiration) */}
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
