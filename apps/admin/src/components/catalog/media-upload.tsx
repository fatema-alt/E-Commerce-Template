"use client";
import { useToastState } from "@/components/admin/toast-provider";
/* eslint-disable @next/next/no-img-element -- Local blob URLs are upload previews. */
import { useEffect, useRef, useState } from "react";
import { API, control } from "./catalog-ui";
type Entry = {
  file: File;
  preview: string;
  progress: number;
  error: string;
  done: boolean;
};
export function MediaUpload({
  productId,
  onUploaded,
}: {
  productId: string;
  onUploaded: () => void;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [, setError] = useToastState("error");
  const [, setSuccess] = useToastState("success");
  const urls = useRef<string[]>([]);
  useEffect(
    () => () => {
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  function choose(files: File[]) {
    if (busy) return;
    if (
      files.length > 20 ||
      files.some(
        (file) =>
          file.size > 5 * 1024 * 1024 ||
          !["image/png", "image/jpeg", "image/webp"].includes(file.type),
      )
    ) {
      setError("Choose at most 20 JPG, PNG or WebP images, each up to 5 MB.");
      return;
    }
    urls.current.forEach((url) => URL.revokeObjectURL(url));
    const next = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
      error: "",
      done: false,
    }));
    urls.current = next.map((entry) => entry.preview);
    setError("");
    setEntries(next);
  }
  async function upload() {
    setBusy(true);
    let uploaded = false;
    for (let index = 0; index < entries.length; index++) {
      if (entries[index].done) continue;
      const update = (changes: Partial<Entry>) =>
        setEntries((prev) =>
          prev.map((entry, i) =>
            i === index ? { ...entry, ...changes } : entry,
          ),
        );
      update({ error: "" });
      try {
        await new Promise<void>((resolve, reject) => {
          const request = new XMLHttpRequest();
          request.open("POST", API + "/products/" + productId + "/images");
          request.withCredentials = true;
          request.setRequestHeader("X-Commerce-Admin", "1");
          request.timeout = 60000;
          request.upload.onprogress = (event) => {
            if (event.lengthComputable)
              update({
                progress: Math.round((event.loaded / event.total) * 100),
              });
          };
          request.onload = () => {
            if (request.status >= 200 && request.status < 300) resolve();
            else {
              let message = "Upload failed (" + request.status + ")";
              try {
                const body = JSON.parse(request.responseText);
                message = Array.isArray(body.message)
                  ? body.message.join(", ")
                  : body.message || message;
              } catch {}
              reject(new Error(message));
            }
          };
          request.onerror = () =>
            reject(
              new Error("Network error. Check the gallery before retrying."),
            );
          request.ontimeout = () =>
            reject(
              new Error("Upload timed out. Check the gallery before retrying."),
            );
          const body = new FormData();
          body.append("file", entries[index].file);
          request.send(body);
        });
        update({ done: true, progress: 100 });
        uploaded = true;
      } catch (error) {
        setError(error instanceof Error ? error.message : "Upload failed");
        update({
          error: error instanceof Error ? error.message : "Upload failed",
        });
      }
    }
    if (uploaded) {
      setSuccess("Product images uploaded");
      onUploaded();
    }
    setBusy(false);
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
          className={control + " mt-3"}
          type="file"
          multiple
          disabled={busy}
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => choose(Array.from(event.target.files ?? []))}
        />
      </label>
      <p className="text-xs text-slate-500">
        Up to 20 images per product · 5 MB each · Decoded and optimized to WebP
      </p>

      {entries.map((entry, index) => (
        <div key={index} className="flex items-center gap-3 text-sm">
          <img
            src={entry.preview}
            alt={entry.file.name}
            className="h-12 w-12 rounded-lg object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate">{entry.file.name}</p>
            <progress
              aria-label={"Upload " + entry.file.name}
              max={100}
              value={entry.progress}
              className="h-2 w-full accent-indigo-600"
            />
            {entry.error && (
              <p role="alert" className="text-xs text-red-700">
                {entry.error}
              </p>
            )}
          </div>
          <span>{entry.done ? "Uploaded" : entry.progress + "%"}</span>
        </div>
      ))}
      <button
        type="button"
        disabled={
          busy || !entries.length || entries.every((entry) => entry.done)
        }
        onClick={() => void upload()}
        className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Uploading…" : "Upload selected images"}
      </button>
    </div>
  );
}
