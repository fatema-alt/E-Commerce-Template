"use client";

import { useState, useId } from "react";
import {
  type Asset,
  type Document,
  type Registry,
  type Value,
  assetUrl,
  initialValue,
  label,
} from "./cms-api";
import { SchemaField, button, input } from "./schema-fields";
import { getStandardEcommerceTemplate } from "./standard-template";

export type Section = {
  id: string;
  type: string;
  visible: boolean;
  config: Record<string, Value>;
  responsive?: {
    desktop?: boolean;
    tablet?: boolean;
    mobile?: boolean;
    width?: "contained" | "full";
    padding?: number;
  };
};

interface VisualHomepageBuilderProps {
  pageTitle: string;
  sections: Section[];
  onUpdateSections: (sections: Section[]) => void;
  registry: Registry;
  assets: Asset[];
  dirty: boolean;
  busy: boolean;
  doc: Document | null;
  onSaveDraft: () => void;
  onPublish: () => void;
  editable: boolean;
  publisher: boolean;
  onNotice: (msg: string) => void;
}

export function VisualHomepageBuilder({
  pageTitle,
  sections,
  onUpdateSections,
  registry,
  assets,
  dirty,
  busy,
  doc,
  onSaveDraft,
  onPublish,
  editable,
  publisher,
  onNotice,
}: VisualHomepageBuilderProps) {
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    sections[0]?.id ?? null,
  );
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSectionType, setNewSectionType] = useState("hero");

  const selectedIndex = sections.findIndex((s) => s.id === selectedSectionId);
  const selectedSection = selectedIndex >= 0 ? sections[selectedIndex] : null;

  // Reorder helper
  const handleMove = (index: number, delta: number) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= sections.length) return;
    const next = [...sections];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onUpdateSections(next);
  };

  // Duplicate helper
  const handleDuplicate = (index: number) => {
    const target = sections[index];
    if (!target || sections.length >= 100) return;
    const clone: Section = {
      ...structuredClone(target),
      id: crypto.randomUUID(),
    };
    const next = [...sections.slice(0, index + 1), clone, ...sections.slice(index + 1)];
    onUpdateSections(next);
    setSelectedSectionId(clone.id);
  };

  // Delete helper
  const handleDelete = (index: number) => {
    if (!window.confirm("Remove this section from the homepage?")) return;
    const next = sections.filter((_, i) => i !== index);
    onUpdateSections(next);
    if (selectedSectionId === sections[index]?.id) {
      setSelectedSectionId(next[0]?.id ?? null);
    }
  };

  // Add section helper
  const handleAddSection = (type: string) => {
    if (!registry.blocks[type] || sections.length >= 100) return;
    const newSection: Section = {
      id: crypto.randomUUID(),
      type,
      visible: true,
      config: initialValue(registry.blocks[type]) as Record<string, Value>,
      responsive: {
        desktop: true,
        tablet: true,
        mobile: true,
        width: "contained",
        padding: 4,
      },
    };
    const next = [...sections, newSection];
    onUpdateSections(next);
    setSelectedSectionId(newSection.id);
    setShowAddModal(false);
  };

  return (
    <div className="flex h-[calc(100vh-130px)] flex-col bg-slate-100 overflow-hidden rounded-2xl border border-slate-200 shadow-xl">
      {/* 1. TOP BUILDER TOOLBAR */}
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-5 z-20">
        {/* Left: Page Title & Status */}
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-900 text-sm">
            {pageTitle || "Homepage Builder"}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
            {doc?.state ?? "NEW"} · Rev {doc?.revision ?? 0}
          </span>
          {dirty ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Unsaved changes
            </span>
          ) : (
            <span className="text-xs text-slate-500 font-medium">✓ Saved</span>
          )}
        </div>

        {/* Center: Responsive Viewport Switcher */}
        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => setViewport("desktop")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition ${
              viewport === "desktop"
                ? "bg-white text-indigo-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Desktop View (100%)"
          >
            <span>🖥️</span>
            <span>Desktop</span>
          </button>
          <button
            type="button"
            onClick={() => setViewport("tablet")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition ${
              viewport === "tablet"
                ? "bg-white text-indigo-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Tablet View (768px)"
          >
            <span>📱</span>
            <span>Tablet</span>
          </button>
          <button
            type="button"
            onClick={() => setViewport("mobile")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition ${
              viewport === "mobile"
                ? "bg-white text-indigo-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Mobile View (390px)"
          >
            <span>📲</span>
            <span>Mobile</span>
          </button>
        </div>

        {/* Right: Actions (Template, Save, Publish) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (
                sections.length > 0 &&
                !window.confirm("Replace current sections with the standard e-commerce template?")
              )
                return;
              onUpdateSections(getStandardEcommerceTemplate() as unknown as Section[]);
              onNotice("Standard template loaded. Customize each section in the inspector.");
            }}
            className="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition shadow-2xs"
          >
            ✨ Load Standard Template
          </button>

          {editable && (
            <button
              type="button"
              disabled={busy || !dirty}
              onClick={onSaveDraft}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {busy ? "Saving..." : "Save draft"}
            </button>
          )}

          {publisher && (
            <button
              type="button"
              disabled={busy || dirty}
              onClick={onPublish}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition"
            >
              Publish live
            </button>
          )}
        </div>
      </header>

      {/* 2. THREE-PANEL WORKSPACE BODY */}
      <div className="flex flex-1 overflow-hidden">
        {/* PANEL A: LEFT SECTION NAVIGATOR */}
        <aside className="w-80 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col z-10">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Sections Navigator
              </span>
              <span className="ml-1.5 text-xs text-slate-600">({sections.length})</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700 shadow-2xs transition"
            >
              + Add Section
            </button>
          </div>

          {/* Section Items List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {sections.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-600 space-y-3">
                <p>No sections on this page yet.</p>
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-1.5 font-semibold text-indigo-700 hover:bg-indigo-100"
                >
                  + Add First Section
                </button>
              </div>
            ) : (
              sections.map((section, index) => {
                const isSelected = section.id === selectedSectionId;
                const sectionTitle =
                  (section.config?.title as string) ||
                  (section.config?.name as string) ||
                  label(section.type);

                return (
                  <div
                    key={section.id}
                    onClick={() => setSelectedSectionId(section.id)}
                    className={`group relative flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs transition cursor-pointer ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-50/70 shadow-xs ring-1 ring-indigo-500"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {/* Reorder Buttons */}
                    <div className="flex flex-col gap-0.5 text-slate-600">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMove(index, -1);
                        }}
                        className="rounded hover:bg-slate-200 p-0.5 disabled:opacity-30"
                        title="Move Up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={index === sections.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMove(index, 1);
                        }}
                        className="rounded hover:bg-slate-200 p-0.5 disabled:opacity-30"
                        title="Move Down"
                      >
                        ▼
                      </button>
                    </div>

                    {/* Section Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900 truncate">
                          {index + 1}. {sectionTitle}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-600 uppercase tracking-wider font-mono">
                        {label(section.type)}
                      </span>
                    </div>

                    {/* Quick Visibility Toggle */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateSections(
                          sections.map((s, i) =>
                            i === index ? { ...s, visible: !s.visible } : s,
                          ),
                        );
                      }}
                      className={`p-1 rounded hover:bg-slate-200 transition ${
                        section.visible ? "text-emerald-600" : "text-slate-600"
                      }`}
                      title={section.visible ? "Section is visible" : "Section is hidden"}
                    >
                      {section.visible ? "👁️" : "🙈"}
                    </button>

                    {/* Duplicate & Delete Actions */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicate(index);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-600 hover:text-indigo-600 transition"
                      title="Duplicate Section"
                    >
                      ⧉
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(index);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-600 hover:text-red-600 transition"
                      title="Delete Section"
                    >
                      ✕
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* PANEL B: CENTER LIVE VIEWPORT PREVIEW */}
        <main className="flex-1 bg-slate-200/70 p-6 overflow-y-auto flex flex-col items-center">
          <div
            className={`transition-all duration-300 rounded-2xl bg-white shadow-2xl border border-slate-300 min-h-[600px] flex flex-col overflow-hidden ${
              viewport === "desktop"
                ? "w-full max-w-[1180px]"
                : viewport === "tablet"
                  ? "w-[768px]"
                  : "w-[390px]"
            }`}
          >
            {/* Viewport Frame Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-600">
              <span className="font-mono">
                Storefront Live Preview ({viewport === "desktop" ? "100%" : viewport === "tablet" ? "768px" : "390px"})
              </span>
              <span>Click any section to edit</span>
            </div>

            {/* Simulated Live Sections */}
            <div className="flex-1 p-4 space-y-6 bg-slate-50/30">
              {sections.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-96 text-center text-slate-600 space-y-3">
                  <span className="text-4xl">🎨</span>
                  <p className="text-sm font-semibold text-slate-700">Empty Homepage</p>
                  <p className="text-xs max-w-sm text-slate-600">
                    Add sections using the left navigator or load the pre-built Standard E-Commerce Template to start.
                  </p>
                </div>
              ) : (
                sections.map((section, idx) => {
                  const isSelected = section.id === selectedSectionId;
                  const c = section.config;

                  return (
                    <div
                      key={section.id}
                      onClick={() => setSelectedSectionId(section.id)}
                      className={`relative rounded-xl transition-all duration-200 cursor-pointer overflow-hidden ${
                        isSelected
                          ? "ring-3 ring-indigo-600 shadow-lg"
                          : "hover:ring-2 hover:ring-indigo-300 hover:shadow-md"
                      } ${!section.visible ? "opacity-40 grayscale-50" : ""}`}
                    >
                      {/* Active Section Floating Tag */}
                      {isSelected && (
                        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white shadow">
                          <span>Editing: {label(section.type)}</span>
                        </div>
                      )}

                      {/* Visual Preview Content based on type */}
                      {section.type === "hero" ? (
                        c.bannerType === "without_button" ? (
                          <div className="relative rounded-xl overflow-hidden border border-slate-200 min-h-[220px] bg-slate-900 flex flex-col justify-center items-center text-center p-6">
                            <span className="absolute top-3 right-3 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-bold">
                              🖼️ বাটন ছাড়া (Pure Graphic Banner)
                            </span>
                            {c.image && (c.image as any).assetId ? (
                              <div className="text-white text-xs">
                                <span className="font-bold text-sm block">Banner Image Selected</span>
                                <span className="text-slate-400 text-[11px]">Click Destination: {String(c.bannerLink || (c.button as any)?.href || "/shop")}</span>
                              </div>
                            ) : (
                              <div className="text-white space-y-1.5">
                                <span className="text-xs font-bold text-lime-400">DSMART PROMOTIONAL BANNER</span>
                                <h3 className="text-xl font-black">{String(c.title || "Full Width Graphic Banner")}</h3>
                                <p className="text-xs text-slate-300">পুরো ব্যানারটি ক্লিকযোগ্য (Click to open link)</p>
                                <span className="text-[11px] font-mono text-indigo-300 block">Link: {String(c.bannerLink || (c.button as any)?.href || "/shop")}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-8 rounded-xl bg-gradient-to-r from-lime-100/60 to-emerald-50 border border-slate-200 min-h-[220px] flex flex-col justify-center">
                            <div className="flex items-center justify-between mb-2">
                              <span className="inline-block px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-800 text-[10px] font-bold">
                                🔘 বাটন সহ (With CTA Button)
                              </span>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900">
                              {String(c.title || "Shop Smart. Live Smart.")}
                            </h2>
                            <p className="text-xs text-slate-600 mt-1.5 max-w-md">
                              {String(c.subtitle || "Premium multi-category lifestyle and tech store.")}
                            </p>
                            <div className="mt-4 flex gap-2">
                              <span className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white">
                                {(c.button as any)?.label || "Start Shopping ↗"}
                              </span>
                            </div>
                          </div>
                        )
                      ) : section.type === "categoryGrid" ? (
                        <div className="p-5 rounded-xl bg-white border border-slate-200">
                          <h3 className="text-base font-bold text-slate-900 mb-3">
                            {String(c.title || "Shop by Department")}
                          </h3>
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                            {["Electronics", "Fashion", "Home & Living", "Beauty", "Groceries", "Deals"].map(
                              (dept, i) => (
                                <div
                                  key={i}
                                  className="aspect-square rounded-lg bg-slate-100 border border-slate-200 flex flex-col items-center justify-center p-2 text-center"
                                >
                                  <span className="text-lg">🛍️</span>
                                  <span className="text-[10px] font-semibold text-slate-700 mt-1 truncate w-full">
                                    {dept}
                                  </span>
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      ) : section.type === "flashSale" ? (
                        <div className="p-5 rounded-xl bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-200">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                              <span>⚡</span>
                              <span>{String(c.title || "Flash Sale Deals")}</span>
                            </h3>
                            <span className="rounded-full bg-rose-600 text-white px-2.5 py-0.5 text-[10px] font-bold">
                              Ends Soon: {c.endsAt ? new Date(String(c.endsAt)).toLocaleDateString() : "Active"}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[1, 2, 3, 4].map((n) => (
                              <div key={n} className="rounded-lg bg-white p-2.5 border border-rose-100 shadow-2xs">
                                <div className="aspect-square rounded bg-slate-100 mb-2" />
                                <span className="text-[11px] font-semibold block truncate">Deal Item #{n}</span>
                                <span className="text-xs font-bold text-rose-600">৳1,450</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : section.type === "trustFeatures" ? (
                        <div className="p-4 rounded-xl bg-white border border-slate-200">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {(
                              (c.items as any[]) || [
                                { title: "Cash on Delivery", icon: "truck" },
                                { title: "100% Authentic", icon: "shield" },
                                { title: "7-Day Returns", icon: "return" },
                                { title: "24/7 Support", icon: "support" },
                              ]
                            ).slice(0, 4).map((item, i) => (
                              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                                <span className="text-xl">🛡️</span>
                                <div className="min-w-0">
                                  <strong className="text-[11px] block truncate text-slate-800">{item.title}</strong>
                                  <span className="text-[9px] text-slate-600 truncate block">Verified policy</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : section.type === "customerReviews" ? (
                        <div className="p-5 rounded-xl bg-white border border-slate-200">
                          <h3 className="text-base font-bold text-slate-900 mb-1">
                            {String(c.title || "Customer Reviews")}
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                            {[1, 2, 3].map((n) => (
                              <div key={n} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                                <span className="text-amber-500 font-bold">★★★★★</span>
                                <p className="text-[11px] text-slate-600 mt-1 italic line-clamp-2">
                                  "Super fast delivery and authentic product as promised. Highly recommend DS Mart!"
                                </p>
                                <span className="text-[10px] font-semibold text-slate-800 mt-2 block">
                                  Verified Customer #{n}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-5 rounded-xl bg-white border border-slate-200">
                          <h3 className="text-base font-bold text-slate-900 mb-1">
                            {String(c.title || label(section.type))}
                          </h3>
                          <p className="text-xs text-slate-600">{label(section.type)} section preview</p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </main>

        {/* PANEL C: RIGHT SECTION SETTINGS INSPECTOR */}
        <aside className="w-96 flex-shrink-0 border-l border-slate-200 bg-white flex flex-col z-10">
          <div className="border-b border-slate-100 px-5 py-3.5 bg-slate-50 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Section Settings
              </span>
              {selectedSection && (
                <span className="ml-2 text-xs font-mono text-indigo-600 font-semibold">
                  [{label(selectedSection.type)}]
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {!selectedSection ? (
              <div className="p-8 text-center text-xs text-slate-600">
                Select a section from the navigator to edit its content and responsive settings.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Responsive Visibility Controls */}
                <div className="rounded-xl border border-slate-200 p-3.5 bg-slate-50 space-y-2.5">
                  <span className="text-xs font-bold text-slate-800 block">Responsive Visibility</span>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSection.responsive?.desktop ?? true}
                        onChange={(e) => {
                          const next = [...sections];
                          next[selectedIndex] = {
                            ...selectedSection,
                            responsive: {
                              ...selectedSection.responsive,
                              desktop: e.target.checked,
                            },
                          };
                          onUpdateSections(next);
                        }}
                      />
                      <span>Desktop</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSection.responsive?.tablet ?? true}
                        onChange={(e) => {
                          const next = [...sections];
                          next[selectedIndex] = {
                            ...selectedSection,
                            responsive: {
                              ...selectedSection.responsive,
                              tablet: e.target.checked,
                            },
                          };
                          onUpdateSections(next);
                        }}
                      />
                      <span>Tablet</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSection.responsive?.mobile ?? true}
                        onChange={(e) => {
                          const next = [...sections];
                          next[selectedIndex] = {
                            ...selectedSection,
                            responsive: {
                              ...selectedSection.responsive,
                              mobile: e.target.checked,
                            },
                          };
                          onUpdateSections(next);
                        }}
                      />
                      <span>Mobile</span>
                    </label>
                  </div>
                </div>

                {/* Content Configuration Schema Form */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-800 block">Content & Layout</span>

                  {/* For HERO SECTION: 2 Banner Types (Button Soho & Button Chara) */}
                  {selectedSection.type === "hero" && (
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 space-y-2">
                      <label className="text-xs font-bold text-slate-800 block">
                        ব্যানারের ধরন (Banner Style Option)
                      </label>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...sections];
                            next[selectedIndex] = {
                              ...selectedSection,
                              config: {
                                ...selectedSection.config,
                                bannerType: "with_button",
                              },
                            };
                            onUpdateSections(next);
                          }}
                          className={`p-2.5 rounded-lg border text-left font-semibold transition ${
                            (selectedSection.config.bannerType || "with_button") === "with_button"
                              ? "border-indigo-600 bg-white text-indigo-700 shadow-xs ring-1 ring-indigo-600"
                              : "border-slate-200 bg-white/60 text-slate-600 hover:bg-white"
                          }`}
                        >
                          <span className="block font-bold">🔘 বাটন সহ</span>
                          <span className="text-[10px] text-slate-500 font-normal">Title + CTA Button</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...sections];
                            next[selectedIndex] = {
                              ...selectedSection,
                              config: {
                                ...selectedSection.config,
                                bannerType: "without_button",
                              },
                            };
                            onUpdateSections(next);
                          }}
                          className={`p-2.5 rounded-lg border text-left font-semibold transition ${
                            selectedSection.config.bannerType === "without_button"
                              ? "border-indigo-600 bg-white text-indigo-700 shadow-xs ring-1 ring-indigo-600"
                              : "border-slate-200 bg-white/60 text-slate-600 hover:bg-white"
                          }`}
                        >
                          <span className="block font-bold">🖼️ বাটন ছাড়া</span>
                          <span className="text-[10px] text-slate-500 font-normal">Pure Graphic Banner</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        {selectedSection.config.bannerType === "without_button"
                          ? "💡 বাটন ছাড়া অপশন: আপনার ব্যানার ইমেজটি পুরো ফুল-উইডথ জুড়ে ক্লিকযোগ্য থাকবে। কোনো টেক্সট বা বাটন ওভারলে থাকবে না।"
                          : "💡 বাটন সহ অপশন: ব্যানার টাইটেল, সাবটাইটেল এবং ক্লিকযোগ্য বাটন (যেমন: Start Shopping) দৃশ্যমান থাকবে।"}
                      </p>
                    </div>
                  )}

                  <SchemaField
                    name={label(selectedSection.type)}
                    schema={registry.blocks[selectedSection.type]}
                    value={selectedSection.config}
                    assets={assets}
                    onChange={(nextConfig) => {
                      const next = [...sections];
                      next[selectedIndex] = {
                        ...selectedSection,
                        config: nextConfig as Record<string, Value>,
                      };
                      onUpdateSections(next);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* 4. ADD SECTION MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Add Homepage Section</h3>
            <p className="text-xs text-slate-600 mb-4">
              Select a section type from our verified e-commerce component registry:
            </p>

            <select
              className={input + " mb-4"}
              value={newSectionType}
              onChange={(e) => setNewSectionType(e.target.value)}
            >
              {Object.keys(registry.blocks).map((type) => (
                <option key={type} value={type}>
                  {label(type)} ({type})
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleAddSection(newSectionType)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-xs"
              >
                + Insert Section
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
