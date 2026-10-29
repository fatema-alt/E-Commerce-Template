"use client";
import { useEffect, useState, type ReactNode } from "react";
export function BannerSlider({
  slides,
  seconds,
}: {
  slides: ReactNode[];
  seconds: number;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(true);
  useEffect(() => {
    if (
      paused ||
      slides.length < 2 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % slides.length),
      Math.max(3, seconds) * 1000,
    );
    return () => window.clearInterval(timer);
  }, [paused, slides.length, seconds]);
  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Store highlights"
    >
      <div aria-live={paused ? "polite" : "off"}>
        {slides.map((slide, i) => (
          <div key={i} hidden={i !== index}>
            {slide}
          </div>
        ))}
      </div>
      <div className="slider-controls">
        <button
          onClick={() =>
            setIndex((i) => (i - 1 + slides.length) % slides.length)
          }
          aria-label="Previous slide"
        >
          ←
        </button>
        <span>
          {index + 1} / {slides.length}
        </span>
        <button
          onClick={() => setIndex((i) => (i + 1) % slides.length)}
          aria-label="Next slide"
        >
          →
        </button>
        <button onClick={() => setPaused(!paused)}>
          {paused ? "Play slides" : "Pause slides"}
        </button>
      </div>
    </div>
  );
}
export function SaleCountdown({ endsAt }: { endsAt: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const end = new Date(endsAt).getTime();
    if (isNaN(end)) return;
    const tick = () =>
      setRemaining(Math.max(0, end - Date.now()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [endsAt]);

  const end = new Date(endsAt).getTime();
  if (!endsAt || isNaN(end)) return null;

  if (remaining === null) {
    const d = new Date(endsAt);
    return (
      <p className="sale-clock">
        Ends {d.toISOString().slice(0, 10)}
      </p>
    );
  }
  if (remaining <= 0) return <p className="sale-clock">Sale event ended</p>;
  return (
    <p className="sale-clock">
      Ends in {Math.floor(remaining / 86400000)}d{" "}
      {Math.floor(remaining / 3600000) % 24}h{" "}
      {Math.floor(remaining / 60000) % 60}m {Math.floor(remaining / 1000) % 60}s
    </p>
  );
}
