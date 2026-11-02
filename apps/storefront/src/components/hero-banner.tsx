"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Asset } from "../lib/cms";
import type { HeroBlock } from "../lib/storefront";
import { heroSlides, type HeroSlide } from "../lib/hero-slides";

function ChevronLeftIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function HeroBanner({
  config,
  assets = [],
  block,
}: {
  config?: Record<string, unknown>;
  assets?: Asset[];
  block?: HeroBlock;
}) {
  const slides = heroSlides(config, assets, block);
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchStart = useRef<number | null>(null);

  const count = slides.length;
  const current = count ? active % count : 0;
  const seconds = Math.min(30, Math.max(3, Number(config?.intervalSeconds) || 5));

  const stopped = hovered || focused || reducedMotion;

  const move = (delta: number) => {
    setActive((index) => (index + delta + count) % count);
  };

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (count < 2 || stopped) return;
    const timer = setInterval(() => {
      setActive((index) => (index + 1) % count);
    }, seconds * 1000);
    return () => clearInterval(timer);
  }, [count, seconds, stopped]);

  if (!count) return null;

  return (
    <section
      className="hero-banner-clean-container"
      aria-label="Featured offers"
      aria-roledescription="carousel"
      tabIndex={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
      onKeyDown={(e) => {
        if (e.altKey || e.ctrlKey || e.metaKey || count < 2) return;
        if (e.key === "ArrowRight") {
          e.preventDefault();
          move(1);
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          move(-1);
        }
      }}
    >
      {/* Banner Slide Frame */}
      <div
        className="hero-banner-track"
        onTouchStart={(e) => {
          touchStart.current = e.changedTouches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchStart.current !== null && count > 1) {
            const distance = touchStart.current - e.changedTouches[0].clientX;
            if (Math.abs(distance) > 50) move(distance > 0 ? 1 : -1);
          }
          touchStart.current = null;
        }}
      >
        {slides.map((slide, index) => {
          const isActive = index === current;
          const content = (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={slide.imageSrc}
              alt={slide.alt}
              loading={index === 0 ? "eager" : "lazy"}
              decoding="async"
              className="hero-banner-slide-img"
            />
          );

          return (
            <div
              key={slide.id}
              className={`hero-banner-slide ${isActive ? "is-active" : ""}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${count}: ${slide.alt}`}
              aria-hidden={!isActive}
              inert={!isActive}
            >
              {slide.href ? (
                <Link
                  href={slide.href}
                  className="hero-banner-slide-link"
                  tabIndex={isActive ? 0 : -1}
                >
                  {content}
                </Link>
              ) : (
                content
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Sleek Controls (Only shown when there are multiple slides) */}
      {count > 1 && (
        <>
          {/* Bottom-Left Frosted Circular Arrow */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              move(-1);
            }}
            aria-label="Previous slide"
            className="hero-banner-floating-arrow hero-banner-arrow-prev"
          >
            <ChevronLeftIcon />
          </button>

          {/* Bottom-Right Frosted Circular Arrow */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              move(1);
            }}
            aria-label="Next slide"
            className="hero-banner-floating-arrow hero-banner-arrow-next"
          >
            <ChevronRightIcon />
          </button>

          {/* Bottom-Center Minimal Pagination Dots */}
          <div
            className="hero-banner-floating-dots"
            role="tablist"
            aria-label="Slide navigation"
          >
            {slides.map((slide, index) => {
              const isDotActive = index === current;
              return (
                <button
                  type="button"
                  key={slide.id}
                  role="tab"
                  aria-selected={isDotActive}
                  aria-label={`Jump to slide ${index + 1}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActive(index);
                  }}
                  className={`hero-banner-dot ${isDotActive ? "is-active" : ""}`}
                />
              );
            })}
          </div>
        </>
      )}

      {/* Screen Reader Status */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        Slide {current + 1} of {count}
      </span>
    </section>
  );
}
