"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type Asset, assetUrl, request } from "./cms-api";

interface MediaPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (assetId: string, asset?: Asset) => void;
  assets: Asset[];
  currentAssetId?: string;
}

export function MediaPickerModal({
  isOpen,
  onClose,
  onSelect,
  assets,
  currentAssetId,
}: MediaPickerModalProps) {
  const [search, setSearch] = useState("");
  const [library, setLibrary] = useState<Asset[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    let live = true;
    request<{ items: Asset[]; total: number }>(`/admin/cms/media?page=${page}&limit=100`)
      .then((result) => {
        if (!live) return;
        setLibrary((previous) => page === 1 ? result.items : [...previous, ...result.items.filter((item) => !previous.some((old) => old.id === item.id))]);
        setTotal(result.total);
      }).catch((e: Error) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [isOpen, page]);
  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]');
        if (!controls?.length) { event.preventDefault(); return; }
        const first = controls[0]; const last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("keydown", close); previousFocus?.focus(); };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const available = [...library, ...assets.filter((item) => !library.some((loaded) => loaded.id === item.id))];
  const filteredAssets = available.filter((a) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      (a.altText && a.altText.toLowerCase().includes(term)) ||
      a.id.toLowerCase().includes(term) ||
      (a.url && a.url.toLowerCase().includes(term))
    );
  });

  return createPortal(
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Select image from Media Library" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="flex h-[80vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Select Image from Media Library</h2>
            <p className="text-xs text-slate-500">Choose an uploaded image asset for your homepage section</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
          >
            ✕
          </button>
        </div>

        {/* Search Toolbar */}
        <div className="border-b border-slate-200 px-6 py-3 bg-white">
          <label className="mb-3 block text-sm text-slate-900">Upload a new image
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} className="block mt-2 text-xs" onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (file.size > 5 * 1024 * 1024) { setError("Image must be at most 5 MB."); return; }
              setBusy(true); setError("");
              try {
                const form = new FormData(); form.append("file", file);
                const uploaded = await request<Asset>("/admin/cms/media", { method: "POST", body: form });
                setLibrary((previous) => [uploaded, ...previous]);
                window.dispatchEvent(new CustomEvent("cms-media-uploaded", { detail: uploaded }));
                onSelect(uploaded.id, uploaded); onClose();
              } catch (e) { setError((e as Error).message); }
              finally { setBusy(false); }
            }} />
          </label>
          {busy && <p role="status" className="text-sm text-slate-600">Uploading…</p>}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <input
            type="text"
            placeholder="Search images by name or alt text..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-hidden"
          />
        </div>

        {/* Assets Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <span className="text-4xl mb-2">🖼️</span>
              <p className="text-sm font-semibold text-slate-700">No media assets found</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Upload images in the CMS Media Library tab, then select them here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredAssets.map((asset) => {
                const isSelected = asset.id === currentAssetId;
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => {
                      onSelect(asset.id, asset);
                      onClose();
                    }}
                    className={`group relative flex flex-col rounded-xl border p-2 text-left transition overflow-hidden ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500"
                        : "border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md"
                    }`}
                  >
                    <div className="relative aspect-square w-full rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center">
                      {asset.url ? (
                        <img
                          src={assetUrl(asset.url)}
                          alt={asset.altText || ""}
                          className="h-full w-full object-cover group-hover:scale-105 transition duration-200"
                        />
                      ) : (
                        <span className="text-2xl text-slate-400">🖼️</span>
                      )}
                      {isSelected && (
                        <div className="absolute top-2 right-2 rounded-full bg-indigo-600 p-1 text-white shadow">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <span className="mt-2 truncate text-xs font-medium text-slate-800">
                      {asset.altText || asset.id.slice(0, 12)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3.5 bg-slate-50 text-xs text-slate-500">
          <span>{filteredAssets.length} image assets available</span>
          {library.length < total && <button type="button" onClick={() => setPage(page + 1)}>Load more images</button>}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>, document.body
  );
}
