"use client";

import NextImage from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Asset } from "../lib/cms";
import type { HeroBlock } from "../lib/storefront";
import { heroSlides } from "../lib/hero-slides";

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
  const stopped = hovered || focused || paused || reducedMotion || hidden;
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
      <div className="ds-hero-shell">
        <div className="ds-hero-stage"
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
            const visual = <div className={full ? "ds-hero-banner-image" : "ds-hero-split-image"} data-mobile={!!slide.mobileSrc}>
              {slide.imageSrc ? <>
                <NextImage src={slide.imageSrc} alt={slide.alt} fill sizes={full ? "(max-width: 1280px) 100vw, 1280px" : "(max-width: 700px) 100vw, 55vw"}
                  className={slide.mobileSrc ? "ds-hero-desktop-image" : undefined} loading={index === 0 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? "high" : "auto"} unoptimized={slide.imageSrc.startsWith("http:") || slide.imageSrc.startsWith("data:")} />
                {slide.mobileSrc && <NextImage src={slide.mobileSrc} alt={slide.mobileAlt || slide.alt} fill sizes="100vw" className="ds-hero-mobile-image" unoptimized={slide.mobileSrc.startsWith("http:") || slide.mobileSrc.startsWith("data:")} />}
              </> : <NextImage src="/brand/ds-symbol.png" alt="DS Mart" fill sizes="40vw" className="ds-hero-brand-placeholder" />}
            </div>;
            return <article key={slide.id} className={`ds-hero-slide ds-hero-${slide.type} ${index === current ? "is-active" : ""}`}
              style={{ background: slide.gradient }} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${count}: ${slide.title || "Featured offer"}`}
              aria-hidden={index !== current} inert={index !== current}>
              {full ? (slide.href ? <Link href={slide.href} className="ds-hero-banner-link" aria-label={slide.title || slide.alt}>{visual}</Link> : visual) : <>
                <div className="ds-hero-copy">
                  {slide.badge && <span className={`hero-campaign-badge badge-${slide.badgeColor}`}>{slide.badge}</span>}
                  {slide.title && <h2>{slide.title}</h2>}
                  {slide.description && <p>{slide.description}</p>}
                  <div className="hero-cta-group">
                    {slide.primary && <Link href={slide.primary.href} className="hero-primary-btn">{slide.primary.label}<span aria-hidden="true"> ↗</span></Link>}
                    {slide.secondary && <Link href={slide.secondary.href} className="hero-secondary-btn">{slide.secondary.label}</Link>}
                  </div>
                </div>
                {visual}
              </>}
            </article>;
          })}
        </div>
        {count > 1 && <div className="ds-hero-controls" aria-label="Slideshow controls">
          <button type="button" onClick={() => move(-1)} aria-label="Previous slide">←</button>
          <div className="ds-hero-pagination">{slides.map((slide, index) => <button type="button" key={slide.id}
            className={index === current ? "is-active" : ""} aria-label={`Show slide ${index + 1}: ${slide.title || "Featured offer"}`}
            aria-current={index === current ? "true" : undefined} onClick={() => setActive(index)}><span /></button>)}</div>
          <button type="button" onClick={() => move(1)} aria-label="Next slide">→</button>
          <button type="button" onClick={() => setPaused(!paused)} aria-label={paused ? "Start autoplay" : "Pause autoplay"} aria-pressed={paused}>{paused ? "▶" : "Ⅱ"}</button>
        </div>}
        <span className="sr-only" aria-live={stopped ? "polite" : "off"} aria-atomic="true">Slide {current + 1} of {count}</span>
      </div>
      <div className="hero-trust-strip" aria-label="Shopping information">
        {[
          ["🛡️", "Product information", "Review product details before ordering."],
          ["💵", "Payment options", "Check available payment methods at checkout."],
          ["🔄", "Returns questions", "Questions about returns? Contact our team."],
          ["☎", "Contact our team", "Ask about products or an existing order."],
        ].map(([icon, title, text]) => <div key={title} className="trust-strip-item"><div className="trust-icon-box" aria-hidden="true">{icon}</div><div className="trust-text"><strong>{title}</strong><span>{text}</span></div></div>)}
      </div>
    </section>
  );
}
