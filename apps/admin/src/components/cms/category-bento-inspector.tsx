/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { type Asset, type Value, request } from "./cms-api";

export interface CategoryItem {
  id: string;
  name: string;
  slug?: string;
  imageUrl?: string;
  productCount?: number;
}

export interface CategoryGridConfig {
  title?: string;
  subtitle?: string;
  layoutType?: "adaptive" | "equal" | "featured";
  selectionMode?: "auto" | "manual";
  categoryIds?: string[];
  featuredCategoryId?: string;
  columns?: number;
  limit?: "6" | "8" | "10" | "12" | "all";
  showViewAll?: boolean;
}

interface CategoryBentoInspectorProps {
  config: Record<string, Value>;
  onChange: (nextConfig: Record<string, Value>) => void;
  assets: Asset[];
}

export function CategoryBentoInspector({
  config,
  onChange,
}: CategoryBentoInspectorProps) {
  const title = String(config.title ?? "Shop by Department");
  const subtitle = String(
    config.subtitle ?? "Explore curated collections across everyday essentials.",
  );
  const layoutType = (config.layoutType as "adaptive" | "equal" | "featured") || "adaptive";
  const selectionMode = (config.selectionMode as "auto" | "manual") || (Array.isArray(config.categoryIds) && config.categoryIds.length > 0 ? "manual" : "auto");
  const categoryIds = (Array.isArray(config.categoryIds) ? config.categoryIds : []) as string[];
  const featuredCategoryId = String(config.featuredCategoryId ?? "");
  const columns = Number(config.columns ?? 4);
  const limit = String(config.limit ?? "6");
  const showViewAll = config.showViewAll !== false;

  // Search & category catalogue state
  const [availableCategories, setAvailableCategories] = useState<CategoryItem[]>([]);
  const [knownCategories, setKnownCategories] = useState<Record<string, CategoryItem>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Fetch available categories from store
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    request<{ items: CategoryItem[]; total: number }>(
      `/categories?paginated=true&page=1&pageSize=50${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""}`,
    )
      .then((res) => {
        if (!active) return;
        setAvailableCategories(res.items || []);
        setKnownCategories((prev) => {
          const next = { ...prev };
          (res.items || []).forEach((c) => {
            next[c.id] = c;
          });
          return next;
        });
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [searchQuery]);

  // Load details of saved category IDs
  useEffect(() => {
    let active = true;
    for (const catId of categoryIds) {
      if (!knownCategories[catId]) {
        request<CategoryItem>(`/categories/${encodeURIComponent(catId)}`)
          .then((cat) => {
            if (active && cat?.id) {
              setKnownCategories((prev) => ({ ...prev, [cat.id]: cat }));
            }
          })
          .catch(() => {});
      }
    }
    return () => {
      active = false;
    };
  }, [categoryIds, knownCategories]);

  const update = (patch: Partial<CategoryGridConfig>) => {
    onChange({
      ...config,
      ...patch,
    });
  };

  const handleAddCategory = (cat: CategoryItem) => {
    if (!categoryIds.includes(cat.id)) {
      const nextIds = [...categoryIds, cat.id];
      update({
        selectionMode: "manual",
        categoryIds: nextIds,
        // If no featured category is set, make first category featured
        featuredCategoryId: featuredCategoryId || cat.id,
      });
    }
    setIsSearchOpen(false);
  };

  const handleRemoveCategory = (catId: string) => {
    const nextIds = categoryIds.filter((id) => id !== catId);
    update({
      categoryIds: nextIds,
      featuredCategoryId: featuredCategoryId === catId ? (nextIds[0] || "") : featuredCategoryId,
    });
  };

  const handleMove = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= categoryIds.length) return;
    const next = [...categoryIds];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    update({ categoryIds: next });
  };

  // Drag and drop reordering
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const next = [...categoryIds];
    const [dragged] = next.splice(draggedIndex, 1);
    next.splice(index, 0, dragged);
    setDraggedIndex(index);
    update({ categoryIds: next });
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-5 text-sm p-1">
      {/* 1. Header & Text settings */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Section Title
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            value={title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="Shop by Department"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Subtitle
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            value={subtitle}
            onChange={(e) => update({ subtitle: e.target.value })}
            placeholder="Explore curated collections across everyday essentials."
          />
        </div>
      </div>

      {/* 2. Layout Option (Requirement 3: Adaptive Bento, Equal Grid, Featured Grid) */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          Layout Option
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            {
              id: "adaptive",
              label: "Adaptive Bento",
              desc: "Smart multi-size",
              icon: "⚡",
            },
            {
              id: "equal",
              label: "Equal Grid",
              desc: "Uniform cards",
              icon: "▦",
            },
            {
              id: "featured",
              label: "Featured Grid",
              desc: "Top hero + grid",
              icon: "🌟",
            },
          ].map((item) => {
            const active = layoutType === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => update({ layoutType: item.id as any })}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                  active
                    ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 shadow-xs ring-1 ring-indigo-500"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-base">{item.icon}</span>
                  {active && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                  )}
                </div>
                <div>
                  <div className="font-bold text-xs leading-tight">{item.label}</div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-300 mt-0.5">
                    {item.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Columns option for Equal Grid */}
      {layoutType === "equal" && (
        <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Columns (Desktop)
          </label>
          <div className="flex gap-2">
            {[3, 4, 6].map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => update({ columns: col })}
                className={`flex-1 py-1.5 rounded-lg border text-xs font-bold transition ${
                  columns === col
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                {col} Columns
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. Category Selection Mode (Requirement 5: Manual & Automatic) */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          Category Source
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => update({ selectionMode: "auto" })}
            className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              selectionMode === "auto"
                ? "border-indigo-600 bg-indigo-600 text-white shadow-xs"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            }`}
          >
            <span>🔄</span>
            <span>Automatic (Top Catalog)</span>
          </button>
          <button
            type="button"
            onClick={() => update({ selectionMode: "manual" })}
            className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              selectionMode === "manual"
                ? "border-indigo-600 bg-indigo-600 text-white shadow-xs"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            }`}
          >
            <span>✍️</span>
            <span>Manual Selection</span>
          </button>
        </div>
        <p className="text-[11px] text-slate-600 dark:text-slate-300">
          {selectionMode === "auto"
            ? "Automatically displays top categories with the most products."
            : "Manually pick, reorder (drag & drop), and choose which category to feature."}
        </p>
      </div>

      {/* 4. Visible Limits (Requirement 6: 6, 8, 10, 12, or All) */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          Visible Category Limit
        </label>
        <div className="flex flex-wrap gap-1.5">
          {["6", "8", "10", "12", "all"].map((val) => {
            const active = limit === val;
            return (
              <button
                key={val}
                type="button"
                onClick={() => update({ limit: val as any })}
                className={`flex-1 min-w-[48px] py-1.5 rounded-lg border text-xs font-bold uppercase transition ${
                  active
                    ? "border-indigo-600 bg-indigo-600 text-white shadow-xs"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                }`}
              >
                {val === "all" ? "All" : val}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Manual Categories Manager (Requirement 4: Select, Reorder drag-and-drop, Feature) */}
      {selectionMode === "manual" && (
        <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Selected Categories ({categoryIds.length})
            </label>
            <button
              type="button"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>+ Add Category</span>
            </button>
          </div>

          {/* Add Category Picker Drawer / Dropdown */}
          {isSearchOpen && (
            <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-slate-800 space-y-2">
              <input
                type="text"
                placeholder="Search category to add…"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="max-h-44 overflow-y-auto space-y-1">
                {isLoading ? (
                  <p className="text-xs text-slate-400 p-2 text-center">Loading categories…</p>
                ) : availableCategories.length === 0 ? (
                  <p className="text-xs text-slate-400 p-2 text-center">No categories found.</p>
                ) : (
                  availableCategories.map((cat) => {
                    const isAdded = categoryIds.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        disabled={isAdded}
                        onClick={() => handleAddCategory(cat)}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition ${
                          isAdded
                            ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-700/50"
                            : "hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-slate-200"
                        }`}
                      >
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {cat.name}
                        </span>
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                          {isAdded ? "Added" : "+ Select"}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Reorderable List of Selected Categories with ⭐ Feature Star */}
          {categoryIds.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-600 dark:text-slate-300">
              No categories selected. Click <strong>+ Add Category</strong> above.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {categoryIds.map((id, index) => {
                const cat = knownCategories[id] || { id, name: "Loading category…" };
                const isFeatured = featuredCategoryId ? featuredCategoryId === id : index === 0;

                return (
                  <div
                    key={id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 p-2 rounded-lg border transition ${
                      isFeatured
                        ? "border-[#c6f53a] bg-[#c6f53a]/10 dark:bg-[#c6f53a]/5 shadow-2xs"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    } ${draggedIndex === index ? "opacity-50 scale-98" : ""}`}
                  >
                    {/* Drag Handle */}
                    <span
                      className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 text-xs px-1 select-none"
                      title="Drag to reorder"
                    >
                      ⋮⋮
                    </span>

                    {/* Category Title & Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs truncate text-slate-900 dark:text-white">
                          {cat.name}
                        </span>
                        {isFeatured && (
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full bg-[#c6f53a] text-black">
                            Lead Hero
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block truncate">
                        Position #{index + 1}
                      </span>
                    </div>

                    {/* Feature Toggle Button (⭐) */}
                    <button
                      type="button"
                      title={isFeatured ? "Currently Featured Hero" : "Set as Featured Hero Card"}
                      onClick={() => update({ featuredCategoryId: id })}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition ${
                        isFeatured
                          ? "bg-amber-100 text-amber-600 border border-amber-300"
                          : "text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                      }`}
                    >
                      ★
                    </button>

                    {/* Up/Down Reorder Buttons */}
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMove(index, -1)}
                        className="w-6 h-6 rounded flex items-center justify-center text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"
                        title="Move Up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={index === categoryIds.length - 1}
                        onClick={() => handleMove(index, 1)}
                        className="w-6 h-6 rounded flex items-center justify-center text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"
                        title="Move Down"
                      >
                        ↓
                      </button>
                    </div>

                    {/* Remove Button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveCategory(id)}
                      className="w-6 h-6 rounded flex items-center justify-center text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 6. "View All Categories" Button Option (Requirement 10) */}
      <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
          <input
            type="checkbox"
            checked={showViewAll}
            onChange={(e) => update({ showViewAll: e.target.checked })}
            className="rounded text-indigo-600 focus:ring-indigo-500"
          />
          <span>Show "All Categories →" Button in Header</span>
        </label>
        <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 pl-5">
          Displays an interactive button leading customers to the complete category directory page.
        </p>
      </div>
    </div>
  );
}
