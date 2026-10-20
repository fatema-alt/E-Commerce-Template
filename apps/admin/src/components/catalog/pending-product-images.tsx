"use client";
/* eslint-disable @next/next/no-img-element -- Object URLs preview local files before upload. */
import { useEffect, useRef } from "react";
import { useToastState } from "@/components/admin/toast-provider";

function Preview({ file }: { file: File }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (image.current) image.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <img
      ref={image}
      alt={file.name}
      className="h-16 w-16 rounded-lg object-cover"
    />
  );
}

export function PendingProductImages({
  files,
  onChange,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled: boolean;
}) {
  const [, setError] = useToastState("error");
  function choose(selected: File[]) {
    if (disabled) return;
    if (
      files.length + selected.length > 20 ||
      selected.some(
        (file) =>
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 5 * 1024 * 1024 ||
          file.size === 0,
      )
    ) {
      setError(
        "Choose up to 20 JPG, PNG or WebP images, each between 1 byte and 5 MB.",
      );
      return;
    }
    onChange([...files, ...selected]);
  }
  return (
    <div
      className="space-y-4 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 p-5"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        choose(Array.from(event.dataTransfer.files));
      }}
    >
      <label className="block text-sm font-semibold">
        Drop images here or choose files
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          disabled={disabled}
          className="mt-3 block w-full rounded-lg border bg-white p-3"
          onChange={(event) => {
            choose(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
      </label>
      <p className="text-sm text-slate-600">
        Images upload automatically when you save the product. Up to 20 images,
        5 MB each.
      </p>
      {files.map((file, index) => (
        <div key={index} className="flex items-center gap-3">
          <Preview file={file} />
          <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
          <button
            type="button"
            disabled={disabled}
            className="text-sm text-red-700 disabled:opacity-50"
            aria-label={`Remove ${file.name}`}
            onClick={() => onChange(files.filter((_, i) => i !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      {disabled && files.length > 0 && (
        <p role="status" className="text-sm">
          Saving product and uploading images…
        </p>
      )}
    </div>
  );
}
