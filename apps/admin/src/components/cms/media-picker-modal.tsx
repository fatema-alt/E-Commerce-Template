"use client";

import { useState } from "react";
import { type Asset, assetUrl } from "./cms-api";

interface MediaPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (assetId: string) => void;
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

  if (!isOpen) return null;

  const filteredAssets = assets.filter((a) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      (a.altText && a.altText.toLowerCase().includes(term)) ||
      a.id.toLowerCase().includes(term) ||
      (a.url && a.url.toLowerCase().includes(term))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
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
                      onSelect(asset.id);
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
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
