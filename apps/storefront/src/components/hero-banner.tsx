"use client";

import NextImage, { getImageProps } from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Asset } from "../lib/cms";
import type { HeroBlock } from "../lib/storefront";
import { heroSlides, type HeroSlide } from "../lib/hero-slides";

function SlideVisual({ slide, index, full }: { slide: HeroSlide; index: number; full: boolean }) {
  if (!slide.imageSrc) {
    return (
      <div className={full ? "ds-hero-banner-image" : "ds-hero-split-image"}>
        <NextImage
          src="/brand/ds-symbol.png"
          alt="DS Mart"
          fill
          sizes="40vw"
          className="ds-hero-brand-placeholder"
        />
      </div>
    );
  }

  const isFirst = index === 0;

  if (slide.mobileSrc) {
    const {
      props: { srcSet: desktopSrcSet },
    } = getImageProps({
      src: slide.imageSrc,
      alt: slide.alt,
      fill: true,
      sizes: full ? "(max-width: 1280px) 100vw, 1280px" : "(max-width: 700px) 100vw, 55vw",
      unoptimized: slide.imageSrc.startsWith("http:") || slide.imageSrc.startsWith("data:"),
    });

    const {
      props: { srcSet: mobileSrcSet, ...mobileRest },
    } = getImageProps({
      src: slide.mobileSrc,
      alt: slide.mobileAlt || slide.alt,
      fill: true,
      sizes: "100vw",
      unoptimized: slide.mobileSrc.startsWith("http:") || slide.mobileSrc.startsWith("data:"),
    });

    return (
      <div className={full ? "ds-hero-banner-image" : "ds-hero-split-image"} data-mobile="true">
        {slide.imageBackdrop !== "none" && (
          <div className={`ds-hero-backdrop backdrop-${slide.imageBackdrop}`} aria-hidden="true" />
        )}
        <picture className="ds-hero-picture">
          <source media="(max-width: 700px)" sizes="100vw" srcSet={mobileSrcSet} />
          <source media="(min-width: 701px)" sizes={full ? "(max-width: 1280px) 100vw, 1280px" : "(max-width: 700px) 100vw, 55vw"} srcSet={desktopSrcSet} />
          <img
            {...mobileRest}
            alt={slide.alt}
            loading={isFirst ? "eager" : "lazy"}
            fetchPriority={isFirst ? "high" : "auto"}
            decoding="async"
            className="ds-hero-img"
          />
        </picture>
      </div>
    );
  }

  const { props } = getImageProps({
    src: slide.imageSrc,
    alt: slide.alt,
    fill: true,
    sizes: full ? "(max-width: 1280px) 100vw, 1280px" : "(max-width: 700px) 100vw, 55vw",
    unoptimized: slide.imageSrc.startsWith("http:") || slide.imageSrc.startsWith("data:"),
  });

  return (
    <div className={full ? "ds-hero-banner-image" : "ds-hero-split-image"}>
      {slide.imageBackdrop !== "none" && (
        <div className={`ds-hero-backdrop backdrop-${slide.imageBackdrop}`} aria-hidden="true" />
      )}
      <img
        {...props}
        loading={isFirst ? "eager" : "lazy"}
        fetchPriority={isFirst ? "high" : "auto"}
        decoding="async"
        className="ds-hero-img"
      />
    </div>
  );
}

export function HeroBanner({ config, assets = [], block }: {
  config?: Record<string, unknown>; assets?: Asset[]; block?: HeroBlock;
}) {
  const slides = heroSlides(config, assets, block);
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hidden, setHidden] = useState(false);
  const touchStart = useRef<number | null>(null);
  const count = slides.length;
  const current = count ? active % count : 0;
  const seconds = Math.min(30, Math.max(3, Number(config?.intervalSeconds) || 5));
  const showArrows = config?.showArrows !== false;
  const showProgress = config?.showProgress !== false;
  const pauseOnHover = config?.pauseOnHover !== false;

  const stopped = (pauseOnHover && hovered) || focused || paused || reducedMotion || hidden;
  const move = (delta: number) => setActive((index) => (index + delta + count) % count);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    const visibility = () => setHidden(document.hidden);
    sync(); visibility();
    query.addEventListener("change", sync);
    document.addEventListener("visibilitychange", visibility);
    return () => { query.removeEventListener("change", sync); document.removeEventListener("visibilitychange", visibility); };
  }, []);

  useEffect(() => {
    if (count < 2 || stopped) return;
    const timer = setInterval(() => setActive((index) => (index + 1) % count), seconds * 1000);
    return () => clearInterval(timer);
  }, [count, seconds, stopped, current]);

  if (!count) return null;

  return (
    <section className="hero-banner-ecosystem" aria-label="Featured offers" aria-roledescription="carousel"
      tabIndex={0} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      onKeyDown={(event) => {
        if (event.altKey || event.ctrlKey || event.metaKey || count < 2) return;
        if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
        if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
        if (event.key === "Home") { event.preventDefault(); setActive(0); }
        if (event.key === "End") { event.preventDefault(); setActive(count - 1); }
      }}>
      <div className="ds-hero-shell" data-active-type={slides[current]?.type}>
        <div className="ds-hero-stage"
          data-active={current !== 0 ? "true" : undefined}
          onTouchStart={(event) => { touchStart.current = event.changedTouches[0].clientX; }}
          onTouchEnd={(event) => {
            if (touchStart.current !== null && count > 1) {
              const distance = touchStart.current - event.changedTouches[0].clientX;
              if (Math.abs(distance) > 50) move(distance > 0 ? 1 : -1);
            }
            touchStart.current = null;
          }}>
          {slides.map((slide, index) => {
            const full = slide.type === "full_banner";
            const visual = <SlideVisual slide={slide} index={index} full={full} />;
            const isActive = index === current;

            const customStyles = slide.customTheme ? {
              "--slide-bg": slide.customTheme.bg,
              "--slide-text": slide.customTheme.text,
              "--slide-accent": slide.customTheme.accent,
            } as CSSProperties : undefined;

            return (
              <article
                key={slide.id}
                className={`ds-hero-slide ds-hero-${slide.type} theme-${slide.themePreset} ${isActive ? "is-active" : ""}`}
                style={{
                  background: slide.gradient || undefined,
                  ...customStyles,
                }}
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${count}: ${slide.title || "Featured offer"}`}
                aria-hidden={!isActive}
                inert={!isActive}
              >
                {full ? (
                  slide.href ? (
                    <Link href={slide.href} className="ds-hero-banner-link" aria-label={slide.title || slide.alt}>
                      {visual}
                    </Link>
                  ) : visual
                ) : (
                  <>
                    <div className="ds-hero-copy">
                      {slide.badge && (
                        <span className={`hero-campaign-badge badge-${slide.badgeColor}`}>
                          {slide.badge}
                        </span>
                      )}
                      {slide.title && <h2>{slide.title}</h2>}
                      {slide.description && <p>{slide.description}</p>}
                      {(slide.primary || slide.secondary) && (
                        <div className="hero-cta-group">
                          {slide.primary && (
                            <Link href={slide.primary.href} className="hero-primary-btn">
                              {slide.primary.label}<span aria-hidden="true"> ↗</span>
                            </Link>
                          )}
                          {slide.secondary && (
                            <Link href={slide.secondary.href} className="hero-secondary-btn">
                              {slide.secondary.label}
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                    {visual}
                  </>
                )}
              </article>
            );
          })}
        </div>

        {count > 1 && (
          <div className="ds-hero-controls" aria-label="Slideshow controls">
            {showProgress && (
              <div className="ds-hero-progress-group">
                <span className="ds-hero-counter" aria-hidden="true">
                  {String(current + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
                </span>
                <div className="ds-hero-progress-bars" role="tablist" aria-label="Slide navigation">
                  {slides.map((slide, index) => {
                    const isBarActive = index === current;
                    return (
                      <button
                        type="button"
                        key={slide.id}
                        role="tab"
                        className={`ds-hero-progress-bar ${isBarActive ? "is-active" : ""}`}
                        aria-label={`Jump to slide ${index + 1}: ${slide.title || "Featured offer"}`}
                        aria-selected={isBarActive}
                        onClick={() => setActive(index)}
                      >
                        <span
                          className="ds-hero-progress-fill"
                          style={{
                            animationDuration: `${seconds}s`,
                            animationPlayState: stopped ? "paused" : "running",
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="ds-hero-nav-actions">
              {showArrows && (
                <>
                  <button type="button" onClick={() => move(-1)} aria-label="Previous slide" className="ds-hero-arrow-btn">
                    ←
                  </button>
                  <button type="button" onClick={() => move(1)} aria-label="Next slide" className="ds-hero-arrow-btn">
                    →
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setPaused(!paused)}
                aria-label={paused ? "Start automatic slide show" : "Stop automatic slide show"}
                aria-pressed={paused}
                className="ds-hero-pause-btn"
              >
                {paused ? "▶" : "Ⅱ"}
              </button>
            </div>
          </div>
        )}

        <span className="sr-only" aria-live={stopped ? "polite" : "off"} aria-atomic="true">
          Slide {current + 1} of {count}
        </span>
      </div>

      {(config?.showTrustStrip ?? block?.showTrustStrip) === true && (
        <div className="hero-trust-strip" aria-label="Shopping information">
          {[
            ["🛡️", "Product information", "Review product details before ordering."],
            ["💵", "Payment options", "Check available payment methods at checkout."],
            ["🔄", "Returns questions", "Questions about returns? Contact our team."],
            ["☎", "Contact our team", "Ask about products or an existing order."],
          ].map(([icon, title, text]) => (
            <div key={title} className="trust-strip-item">
              <div className="trust-icon-box" aria-hidden="true">{icon}</div>
              <div className="trust-text"><strong>{title}</strong><span>{text}</span></div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
