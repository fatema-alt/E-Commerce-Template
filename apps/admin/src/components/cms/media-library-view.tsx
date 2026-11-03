"use client";

import { useMemo, useRef, useState } from "react";
import { type Asset, assetUrl, request } from "./cms-api";

interface MediaLibraryViewProps {
  assets: Asset[];
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
  editable: boolean;
  refreshList: () => Promise<void>;
  setError: (msg: string) => void;
  setNotice: (msg: string) => void;
}

export function MediaLibraryView({
  assets,
  setAssets,
  editable,
  refreshList,
  setError,
  setNotice,
}: MediaLibraryViewProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "size-desc" | "size-asc">("newest");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedUrlId, setCopiedUrlId] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle uploading single or multiple files
  const handleUploadFiles = async (files: FileList | File[]) => {
    if (!files.length) return;
    const fileArray = Array.from(files);

    // Validate size
    for (const f of fileArray) {
      if (f.size > 5 * 1024 * 1024) {
        setError(`"${f.name}" is larger than 5 MB limit.`);
        return;
      }
    }

    setIsUploading(true);
    setUploadStatus(`Uploading ${fileArray.length} file${fileArray.length > 1 ? "s" : ""}...`);
    setError("");

    let successCount = 0;
    try {
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        setUploadStatus(`Uploading ${i + 1} of ${fileArray.length}: ${file.name}...`);
        const form = new FormData();
        form.append("file", file);
        await request<Asset>("/admin/cms/media", {
          method: "POST",
          body: form,
        });
        successCount++;
      }
      await refreshList();
      setNotice(
        `Successfully uploaded ${successCount} image${successCount > 1 ? "s" : ""}. Available in CMS selectors.`,
      );
    } catch (err) {
      setError((err as Error).message || "Upload failed");
    } finally {
      setIsUploading(false);
      setUploadStatus("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle delete asset
  const handleDeleteAsset = async (asset: Asset) => {
    setDeletingId(asset.id);
    setError("");
    try {
      await request<{ success: boolean; id: string }>(`/admin/cms/media/${asset.id}`, {
        method: "DELETE",
      });
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      setConfirmDeleteId(null);
      if (previewAsset?.id === asset.id) {
        setPreviewAsset(null);
      }
      setNotice("Image removed from Media Library.");
    } catch (err) {
      setError((err as Error).message || "Failed to delete image.");
    } finally {
      setDeletingId(null);
    }
  };

  // Copy helpers with visual feedback
  const copyToClipboard = async (text: string, type: "id" | "url", assetId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "id") {
        setCopiedId(assetId);
        setTimeout(() => setCopiedId(null), 2000);
      } else {
        setCopiedUrlId(assetId);
        setTimeout(() => setCopiedUrlId(null), 2000);
      }
    } catch {
      setError("Clipboard access denied. Please manually copy the text.");
    }
  };

  // Filter and sort assets
  const filteredAssets = useMemo(() => {
    let list = [...assets];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.id.toLowerCase().includes(q) ||
          (a.altText && a.altText.toLowerCase().includes(q)) ||
          (a.url && a.url.toLowerCase().includes(q)),
      );
    }

    if (sortBy === "size-desc") {
      list.sort((a, b) => b.bytes - a.bytes);
    } else if (sortBy === "size-asc") {
      list.sort((a, b) => a.bytes - b.bytes);
    } else if (sortBy === "oldest") {
      list.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
    } else {
      // newest
      list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    }

    return list;
  }, [assets, search, sortBy]);

  return (
    <div className="space-y-6">
      {/* 1. Drag & Drop Upload Zone */}
      {editable && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files) {
              handleUploadFiles(e.dataTransfer.files);
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
            isDragging
              ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30 scale-[1.01]"
              : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            disabled={isUploading}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleUploadFiles(e.target.files);
            }}
          />

          <div className="mx-auto flex max-w-md flex-col items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mb-3">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>

            {isUploading ? (
              <div className="space-y-1">
                <p className="font-semibold text-indigo-600 dark:text-indigo-400 text-sm animate-pulse">
                  {uploadStatus || "Uploading images..."}
                </p>
                <p className="text-xs text-slate-400">Optimizing webp images, please wait...</p>
              </div>
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Click to upload or drag & drop images
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Supports JPG, PNG, or WebP up to 5 MB. You can select multiple files at once.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* 2. Search, Filter & Quick Stats Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, name, or filename..."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-1.5 pl-9 pr-8 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              ✕
            </button>
          )}
        </div>

        {/* Sort & Stats */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 whitespace-nowrap">Sort:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="newest">Newest Uploads</option>
            <option value="oldest">Oldest Uploads</option>
            <option value="size-desc">Size: Largest first</option>
            <option value="size-asc">Size: Smallest first</option>
          </select>

          <span className="text-xs text-slate-400 px-2 border-l border-slate-200 dark:border-slate-800 whitespace-nowrap">
            {filteredAssets.length} of {assets.length} image{assets.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* 3. Media Grid */}
      {filteredAssets.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {filteredAssets.map((asset) => {
            const isDeleting = deletingId === asset.id;
            const isConfirming = confirmDeleteId === asset.id;
            const fullUrl = asset.url ? assetUrl(asset.url) : "";
            const isCopiedId = copiedId === asset.id;
            const isCopiedUrl = copiedUrlId === asset.id;

            return (
              <article
                key={asset.id}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition-all"
              >
                {/* Image Container with subtle checkerboard to show transparent logos cleanly */}
                <div
                  onClick={() => setPreviewAsset(asset)}
                  className="relative flex h-44 cursor-pointer items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-800/60 p-3"
                  style={{
                    backgroundImage:
                      "radial-gradient(rgba(0,0,0,0.06) 1px, transparent 0)",
                    backgroundSize: "12px 12px",
                  }}
                  title="Click to preview full image"
                >
                  {asset.url ? (
                    <img
                      src={assetUrl(asset.thumbnailUrl || asset.url)}
                      alt={asset.altText || "CMS asset"}
                      className="max-h-full max-w-full object-contain transition-transform duration-200 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">No preview</span>
                  )}

                  {/* Hover Quick Zoom Pill */}
                  <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 backdrop-blur-xs">
                    🔍 Zoom
                  </span>
                </div>

                {/* Card Content & Action Bar */}
                <div className="flex flex-1 flex-col justify-between p-3.5 space-y-3">
                  <div>
                    {/* Size & Dimensions */}
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {Math.round(asset.bytes / 1024)} KB
                      </span>
                      {asset.width && asset.height && (
                        <span>
                          {asset.width} × {asset.height}
                        </span>
                      )}
                    </div>

                    {/* Asset ID */}
                    <p
                      className="mt-1 font-mono text-[11px] text-slate-400 truncate"
                      title={asset.id}
                    >
                      {asset.id}
                    </p>
                  </div>

                  {/* Actions Row */}
                  <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <div className="grid grid-cols-2 gap-1.5">
                      {/* Copy ID Button */}
                      <button
                        type="button"
                        onClick={() => copyToClipboard(asset.id, "id", asset.id)}
                        className={`inline-flex items-center justify-center rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${
                          isCopiedId
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                        title="Copy Asset UUID for CMS references"
                      >
                        {isCopiedId ? "✓ Copied ID" : "Copy ID"}
                      </button>

                      {/* Copy URL Button */}
                      <button
                        type="button"
                        onClick={() => copyToClipboard(fullUrl, "url", asset.id)}
                        className={`inline-flex items-center justify-center rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${
                          isCopiedUrl
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                        title="Copy direct Web/CDN URL"
                      >
                        {isCopiedUrl ? "✓ Copied URL" : "Copy URL"}
                      </button>
                    </div>

                    {/* Delete Option with Confirmation */}
                    {editable && (
                      <div>
                        {isConfirming ? (
                          <div className="flex items-center gap-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 p-1.5 border border-rose-200 dark:border-rose-900">
                            <span className="flex-1 text-[11px] font-medium text-rose-700 dark:text-rose-300">
                              Delete image?
                            </span>
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => handleDeleteAsset(asset)}
                              className="rounded px-2 py-0.5 text-[10px] font-bold text-white bg-rose-600 hover:bg-rose-700 transition"
                            >
                              {isDeleting ? "..." : "Yes"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(asset.id)}
                            className="w-full inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center bg-white dark:bg-slate-900">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {search ? `No images found matching "${search}"` : "No storefront images found."}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {search
              ? "Try searching with a different term or clear the filter."
              : "Upload your first image using the upload zone above."}
          </p>
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="mt-3 inline-flex items-center rounded-lg bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100"
            >
              Clear Search Filter
            </button>
          )}
        </div>
      )}

      {/* 4. Lightbox / Detail Zoom Modal */}
      {previewAsset && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          onClick={() => setPreviewAsset(null)}
        >
          <div
            className="relative flex flex-col max-h-[90vh] max-w-3xl w-full overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Image Preview
                </h3>
                <p className="font-mono text-[11px] text-slate-400">{previewAsset.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewAsset(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {/* Modal Image Body */}
            <div className="flex flex-1 items-center justify-center overflow-auto bg-slate-950 p-6">
              {previewAsset.url ? (
                <img
                  src={assetUrl(previewAsset.url)}
                  alt={previewAsset.altText || "Preview"}
                  className="max-h-[55vh] max-w-full rounded object-contain"
                />
              ) : null}
            </div>

            {/* Modal Footer & Details */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4">
              <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                <span>
                  <strong>Size:</strong> {Math.round(previewAsset.bytes / 1024)} KB
                </span>
                {previewAsset.width && previewAsset.height && (
                  <span>
                    <strong>Resolution:</strong> {previewAsset.width} × {previewAsset.height} px
                  </span>
                )}
                {previewAsset.mimeType && (
                  <span>
                    <strong>Type:</strong> {previewAsset.mimeType}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(previewAsset.id, "id", previewAsset.id)
                  }
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                >
                  {copiedId === previewAsset.id ? "✓ Copied ID" : "Copy ID"}
                </button>

                {previewAsset.url && (
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        assetUrl(previewAsset.url),
                        "url",
                        previewAsset.id,
                      )
                    }
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                  >
                    {copiedUrlId === previewAsset.id ? "✓ Copied URL" : "Copy URL"}
                  </button>
                )}

                {previewAsset.url && (
                  <a
                    href={assetUrl(previewAsset.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition"
                  >
                    Open Original ↗
                  </a>
                )}

                {editable && (
                  <button
                    type="button"
                    onClick={() => handleDeleteAsset(previewAsset)}
                    className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
