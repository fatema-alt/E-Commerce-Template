"use client";
/* eslint-disable @next/next/no-img-element -- Existing catalog media URLs support merchant storage. */
import { useState } from "react";
import { Modal, control } from "./catalog-ui";
type Image = {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
  variantId?: string | null;
};
export function ProductGalleryManager({
  images,
  variants,
  disabled,
  imageSrc,
  onReorder,
  onPrimary,
  onUpdate,
  onReplace,
  onRemove,
}: {
  images: Image[];
  variants: { id: string; name: string }[];
  disabled: boolean;
  imageSrc: (url: string) => string;
  onReorder: (ids: string[]) => Promise<void>;
  onPrimary: (id: string) => Promise<void>;
  onUpdate: (
    id: string,
    changes: { altText?: string; variantId?: string | null },
  ) => Promise<boolean>;
  onReplace: (id: string, file: File) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const ordered = [...images].sort(
    (a, b) =>
      Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder,
  );
  const [dragged, setDragged] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [alt, setAlt] = useState("");
  const [variant, setVariant] = useState("");
  const image = images.find((item) => item.id === selected);
  function move(from: number, to: number) {
    if (disabled || from < 0 || to < 0 || to >= ordered.length || from === to)
      return;
    const next = [...ordered];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    void onReorder(next.map((image) => image.id));
  }
  return (
    <div className="product-gallery-manager">
      <p className="product-editor-help">
        The primary image appears first on the storefront. Drag to reorder, or
        use the arrow buttons. Moving an image to the first position makes it
        primary.
      </p>
      <div className="product-gallery-manager-grid">
        {ordered.map((item, index) => (
          <article
            key={item.id}
            draggable={!disabled}
            onDragStart={(event) => {
              setDragged(item.id);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", item.id);
            }}
            onDragEnd={() => setDragged(null)}
            onDragOver={(event) => {
              if (!disabled) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              move(
                ordered.findIndex(
                  (image) =>
                    image.id ===
                    (dragged || event.dataTransfer.getData("text/plain")),
                ),
                index,
              );
              setDragged(null);
            }}
            className="product-gallery-tile"
          >
            <img
              src={imageSrc(item.url)}
              alt={item.altText || `Product image ${index + 1}`}
              draggable={false}
            />
            {item.isPrimary && (
              <span className="gallery-primary-badge">Primary · first</span>
            )}
            <div className="gallery-tile-actions">
              <span>Image {index + 1}</span>
              <button
                type="button"
                disabled={disabled || index === 0}
                aria-label={`Move image ${index + 1} earlier`}
                onClick={() => move(index, index - 1)}
              >
                ←
              </button>
              <button
                type="button"
                disabled={disabled || index === ordered.length - 1}
                aria-label={`Move image ${index + 1} later`}
                onClick={() => move(index, index + 1)}
              >
                →
              </button>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Edit details for image ${index + 1}`}
                onClick={() => {
                  setSelected(item.id);
                  setAlt(item.altText || "");
                  setVariant(item.variantId || "");
                }}
              >
                •••
              </button>
            </div>
          </article>
        ))}
      </div>
      {image && (
        <Modal
          title="Image details"
          busy={disabled}
          onClose={() => {
            if (!disabled) setSelected(null);
          }}
        >
          <div className="gallery-image-details">
            <img
              src={imageSrc(image.url)}
              alt={image.altText || "Selected product image"}
            />
            <fieldset disabled={disabled}>
              <label>
                Alt text
                <input
                  className={control}
                  value={alt}
                  maxLength={200}
                  onChange={(event) => setAlt(event.target.value)}
                />
              </label>
              <label>
                Variant
                <select
                  className={control}
                  value={variant}
                  onChange={(event) => setVariant(event.target.value)}
                >
                  <option value="">All variants / product</option>
                  {variants.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Replace image
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void onReplace(image.id, file);
                    event.target.value = "";
                  }}
                />
              </label>
              <p className="product-editor-help">
                Replacement keeps this image mapping. Maximum 5 MB; JPG, PNG or
                WebP.
              </p>
              <div className="gallery-detail-actions">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={async () => {
                    if (
                      await onUpdate(image.id, {
                        altText: alt,
                        variantId: variant || null,
                      })
                    )
                      setSelected(null);
                  }}
                >
                  Save image details
                </button>
                {!image.isPrimary && (
                  <button
                    type="button"
                    onClick={() => void onPrimary(image.id)}
                  >
                    Set as Primary
                  </button>
                )}
                <button
                  type="button"
                  className="gallery-remove"
                  onClick={() => void onRemove(image.id)}
                >
                  Remove image
                </button>
              </div>
            </fieldset>
          </div>
        </Modal>
      )}
    </div>
  );
}
