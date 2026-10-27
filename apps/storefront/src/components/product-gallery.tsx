"use client";
/* eslint-disable @next/next/no-img-element -- Validated catalog image URLs with high-resolution zooming. */
import { useRef, useState, useCallback, useEffect } from "react";

export function ProductGallery({
  images,
  name,
}: {
  images: { url: string; altText?: string | null }[];
  name: string;
}) {
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const [isZooming, setIsZooming] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const mainContainerRef = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const active = images[selected] || images[0];
  const hasImage = active && !failed.includes(active.url);

  const move = useCallback(
    (offset: number) => {
      setSelected((prev) => (prev + offset + images.length) % images.length);
    },
    [images.length],
  );

  const keys = (event: React.KeyboardEvent) => {
    if (images.length < 2) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      move(event.key === "ArrowLeft" ? -1 : 1);
    }
  };

  // Lightbox keyboard controls
  useEffect(() => {
    const handleDialogKeyDown = (e: KeyboardEvent) => {
      if (!dialog.current?.open) return;
      if (e.key === "Escape") {
        dialog.current?.close();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        move(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        move(1);
      }
    };
    window.addEventListener("keydown", handleDialogKeyDown);
    return () => window.removeEventListener("keydown", handleDialogKeyDown);
  }, [move]);

  // Handle Desktop Mouse Zoom Movement
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mainContainerRef.current) return;
    const rect = mainContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setZoomPos({ x, y });
  };

  // Handle Mobile Touch Swiping
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    if (Math.abs(diff) > 45) {
      if (diff > 0) {
        move(1); // Swipe left -> next
      } else {
        move(-1); // Swipe right -> prev
      }
    }
    setTouchStart(null);
  };

  return (
    <div className="pdp-gallery w-full flex flex-col gap-4" onKeyDown={keys}>
      {/* 1. Main Display Image Container with Interactive Hover Zoom */}
      <div
        ref={mainContainerRef}
        className="product-image-wrap gallery-main relative w-full aspect-square sm:aspect-[4/3] lg:aspect-square rounded-2xl border border-[var(--c-line)] bg-slate-50 dark:bg-slate-900/60 overflow-hidden select-none"
        onMouseEnter={() => setIsZooming(true)}
        onMouseLeave={() => setIsZooming(false)}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {hasImage ? (
          <button
            type="button"
            className="pdp-zoom-trigger w-full h-full p-0 m-0 border-0 bg-transparent block relative cursor-zoom-in group text-left"
            aria-label={`Enlarge image ${selected + 1} of ${name}`}
            onClick={() => dialog.current?.showModal()}
          >
            {/* Main Interactive Zoom Image */}
            <div className="w-full h-full overflow-hidden flex items-center justify-center p-4 sm:p-6">
              <img
                className="product-image max-w-full max-h-full object-contain transition-transform duration-150 ease-out"
                src={active.url}
                alt={active.altText || `${name}, image ${selected + 1}`}
                width={900}
                height={900}
                fetchPriority="high"
                decoding="sync"
                style={{
                  transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                  transform: isZooming ? "scale(2.1)" : "scale(1)",
                }}
                onError={() => setFailed((current) => [...current, active.url])}
              />
            </div>

            {/* Visual Hover Zoom Badge / Hint */}
            <span className="pdp-zoom-hint absolute bottom-3.5 right-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md text-white text-[11px] font-semibold tracking-wide pointer-events-none opacity-85 group-hover:opacity-100 transition-opacity">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
              Click to enlarge
            </span>

            {/* Mobile swipe hint pill */}
            {images.length > 1 && (
              <span className="lg:hidden absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-medium pointer-events-none">
                {selected + 1} / {images.length}
              </span>
            )}
          </button>
        ) : (
          <div className="image-placeholder pdp-missing-image w-full h-full flex flex-col items-center justify-center text-[var(--c-muted)] p-8 text-center">
            <span className="text-4xl mb-2" aria-hidden="true">
              📷
            </span>
            <span className="font-semibold text-sm">Image unavailable</span>
            <small className="text-xs text-[var(--c-muted)] mt-1">{name}</small>
          </div>
        )}

        {/* Previous & Next overlay arrow controls */}
        {images.length > 1 && (
          <div className="pdp-gallery-controls absolute inset-x-2 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none">
            <button
              type="button"
              aria-label="Previous product image"
              onClick={(e) => {
                e.stopPropagation();
                move(-1);
              }}
              className="pointer-events-auto w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[var(--glass-solid)]/90 backdrop-blur-md border border-[var(--c-line)] text-[var(--c-ink)] shadow-md flex items-center justify-center hover:bg-[var(--c-ink)] hover:text-[var(--bg-c)] transition-all transform active:scale-95"
            >
              <svg
                width="18"
                height="18"
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
            </button>

            <button
              type="button"
              aria-label="Next product image"
              onClick={(e) => {
                e.stopPropagation();
                move(1);
              }}
              className="pointer-events-auto w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[var(--glass-solid)]/90 backdrop-blur-md border border-[var(--c-line)] text-[var(--c-ink)] shadow-md flex items-center justify-center hover:bg-[var(--c-ink)] hover:text-[var(--bg-c)] transition-all transform active:scale-95"
            >
              <svg
                width="18"
                height="18"
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
            </button>
          </div>
        )}
      </div>

      {/* 2. Interactive Thumbnails Strip */}
      {images.length > 1 && (
        <div className="gallery-thumbnails flex items-center gap-2.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
          {images.map((image, i) => {
            const isSelected = i === selected;
            const isFailed = failed.includes(image.url);

            return (
              <button
                key={`${image.url}-${i}`}
                type="button"
                onClick={() => setSelected(i)}
                aria-label={`View image ${i + 1}`}
                aria-pressed={isSelected}
                className={`w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-xl overflow-hidden shrink-0 border-2 transition-all p-1 bg-slate-50 dark:bg-slate-900/50 cursor-pointer ${
                  isSelected
                    ? "border-slate-900 dark:border-lime-400 ring-2 ring-lime-400/40 shadow-sm"
                    : "border-transparent opacity-70 hover:opacity-100 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                {isFailed ? (
                  <span className="pdp-thumbnail-fallback w-full h-full flex items-center justify-center text-xs text-slate-400">
                    📷
                  </span>
                ) : (
                  <img
                    src={image.url}
                    alt=""
                    width={72}
                    height={72}
                    className="w-full h-full object-contain rounded-lg"
                    loading="lazy"
                    onError={() =>
                      setFailed((current) =>
                        current.includes(image.url) ? current : [...current, image.url],
                      )
                    }
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Caption for assistive technology */}
      <p className="pdp-gallery-caption text-xs text-[var(--c-muted)] text-center sm:text-left mt-0.5">
        {images.length > 1
          ? "Hover to zoom on desktop, swipe on mobile, or click to enlarge."
          : hasImage
            ? "Hover to zoom or click to enlarge in full view."
            : "Product photos are currently unavailable."}
      </p>

      {/* 3. Click-to-Enlarge Modal / Lightbox Dialog */}
      <dialog
        ref={dialog}
        className="pdp-lightbox fixed inset-0 z-[120] w-full h-full max-w-none max-h-none m-0 p-0 bg-black/92 backdrop-blur-md flex flex-col justify-between"
        aria-label={`${name} image viewer`}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        {/* Lightbox Toolbar */}
        <div className="pdp-lightbox-toolbar w-full px-6 py-4 flex items-center justify-between text-white border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm sm:text-base line-clamp-1">{name}</span>
            {images.length > 1 && (
              <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-xs text-white/80 font-mono">
                {selected + 1} / {images.length}
              </span>
            )}
          </div>

          <button
            type="button"
            autoFocus
            aria-label="Close image viewer"
            onClick={() => dialog.current?.close()}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors focus:outline-hidden focus:ring-2 focus:ring-lime-400"
          >
            ✕
          </button>
        </div>

        {/* Lightbox Main Stage */}
        <div className="flex-1 relative flex items-center justify-center p-4 sm:p-10 min-h-0">
          {hasImage && (
            <img
              src={active.url}
              alt={active.altText || name}
              className="max-w-full max-h-[75vh] object-contain drop-shadow-2xl select-none"
              width={1400}
              height={1400}
            />
          )}

          {/* Lightbox Arrow Navigation */}
          {images.length > 1 && (
            <div className="absolute inset-x-4 sm:inset-x-8 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none">
              <button
                type="button"
                aria-label="Previous enlarged image"
                onClick={() => move(-1)}
                className="pointer-events-auto w-12 h-12 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center backdrop-blur-md transition-all shadow-lg active:scale-95"
              >
                <svg
                  width="22"
                  height="22"
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
              </button>

              <button
                type="button"
                aria-label="Next enlarged image"
                onClick={() => move(1)}
                className="pointer-events-auto w-12 h-12 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center backdrop-blur-md transition-all shadow-lg active:scale-95"
              >
                <svg
                  width="22"
                  height="22"
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
              </button>
            </div>
          )}
        </div>

        {/* Lightbox Bottom Thumbnail Bar */}
        {images.length > 1 && (
          <div className="w-full p-4 flex items-center justify-center gap-2 overflow-x-auto bg-black/40 border-t border-white/10">
            {images.map((img, i) => (
              <button
                key={`lb-${i}`}
                type="button"
                onClick={() => setSelected(i)}
                className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all p-0.5 bg-black/40 ${
                  i === selected
                    ? "border-lime-400 ring-2 ring-lime-400/50 opacity-100"
                    : "border-transparent opacity-50 hover:opacity-100"
                }`}
              >
                <img src={img.url} alt="" className="w-full h-full object-contain rounded" />
              </button>
            ))}
          </div>
        )}
      </dialog>
    </div>
  );
}
