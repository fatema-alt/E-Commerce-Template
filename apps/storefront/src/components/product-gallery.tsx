"use client";
/* eslint-disable @next/next/no-img-element -- Validated catalog image URLs. */
import { useRef, useState } from "react";
export function ProductGallery({
  images,
  name,
}: {
  images: { url: string; altText?: string | null }[];
  name: string;
}) {
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const active = images[selected] || images[0];
  const hasImage = active && !failed.includes(active.url);
  const move = (offset: number) =>
    setSelected((selected + offset + images.length) % images.length);
  const keys = (event: React.KeyboardEvent) => {
    if (images.length < 2) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      move(event.key === "ArrowLeft" ? -1 : 1);
    }
  };
  return (
    <div className="pdp-gallery" onKeyDown={keys}>
      <div className="product-image-wrap gallery-main">
        {hasImage ? (
          <button
            type="button"
            className="pdp-zoom-trigger"
            aria-label={`Enlarge image ${selected + 1} of ${name}`}
            onClick={() => dialog.current?.showModal()}
          >
            <img
              className="product-image"
              src={active.url}
              alt={active.altText || `${name}, image ${selected + 1}`}
              width={900}
              height={900}
              fetchPriority="high"
              decoding="async"
              onError={() => setFailed((current) => [...current, active.url])}
            />
            <span className="pdp-zoom-hint">⊕ Click to enlarge</span>
          </button>
        ) : (
          <div className="image-placeholder pdp-missing-image">
            <span aria-hidden="true">▧</span>
            <span>Image unavailable</span>
            <small>{name}</small>
          </div>
        )}
        {images.length > 1 && (
          <div className="pdp-gallery-controls">
            <button
              type="button"
              aria-label="Previous product image"
              onClick={() => move(-1)}
            >
              ←
            </button>
            <span aria-live="polite">
              {selected + 1} / {images.length}
            </span>
            <button
              type="button"
              aria-label="Next product image"
              onClick={() => move(1)}
            >
              →
            </button>
          </div>
        )}
      </div>
      {images.length > 1 && (
        <div className="gallery-thumbnails">
          {images.map((image, i) => (
            <button
              key={`${image.url}-${i}`}
              type="button"
              onClick={() => setSelected(i)}
              aria-label={`View image ${i + 1}`}
              aria-pressed={i === selected}
            >
              {failed.includes(image.url) ? (
                <span className="pdp-thumbnail-fallback" aria-hidden="true">
                  ▧
                </span>
              ) : (
                <img
                  src={image.url}
                  alt=""
                  width={72}
                  height={72}
                  loading="lazy"
                  onError={() =>
                    setFailed((current) =>
                      current.includes(image.url)
                        ? current
                        : [...current, image.url],
                    )
                  }
                />
              )}
            </button>
          ))}
        </div>
      )}
      <p className="pdp-gallery-caption">
        {images.length > 1
          ? "Choose a thumbnail or use the arrow keys to explore."
          : hasImage
            ? "Take a closer look. Select the image to zoom."
            : "Product photos are currently unavailable."}
      </p>
      <dialog
        ref={dialog}
        className="pdp-lightbox"
        aria-label={`${name} image viewer`}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="pdp-lightbox-toolbar">
          <span>{name}</span>
          <button
            type="button"
            autoFocus
            aria-label="Close image viewer"
            onClick={() => dialog.current?.close()}
          >
            ✕
          </button>
        </div>
        {hasImage && (
          <img
            src={active.url}
            alt={active.altText || name}
            width={1400}
            height={1400}
          />
        )}
        {images.length > 1 && (
          <div className="pdp-gallery-controls">
            <button
              type="button"
              aria-label="Previous enlarged image"
              onClick={() => move(-1)}
            >
              ←
            </button>
            <span aria-live="polite">
              {selected + 1} / {images.length}
            </span>
            <button
              type="button"
              aria-label="Next enlarged image"
              onClick={() => move(1)}
            >
              →
            </button>
          </div>
        )}
      </dialog>
    </div>
  );
}
