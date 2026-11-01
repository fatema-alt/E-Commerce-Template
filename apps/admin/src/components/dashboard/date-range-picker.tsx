"use client";

import { useState } from "react";
import {
  Calendar,
  RotateCw,
  SlidersHorizontal,
  ChevronDown,
  Globe,
  Check,
  X,
} from "lucide-react";
import { useDashboard } from "./dashboard-context";
import type { TimeRange } from "./dashboard-types";

export function DateRangePicker() {
  const {
    range,
    setRange,
    customFrom,
    customTo,
    setCustomRange,
    compare,
    setCompare,
    locale,
    setLocale,
    dict,
    refreshing,
    refresh,
    lastUpdated,
    sseConnected,
    setCustomizeModalOpen,
  } = useDashboard();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [fromDate, setFromDate] = useState(customFrom || "");
  const [toDate, setToDate] = useState(customTo || "");

  const rangeLabels: Record<TimeRange, string> = {
    today: dict.today,
    "7d": dict.last7Days,
    "30d": dict.last30Days,
    "90d": dict.last90Days,
    this_month: dict.thisMonth,
    custom: dict.customRange,
  };

  function handleSelectRange(r: TimeRange) {
    if (r === "custom") {
      setDropdownOpen(false);
      setCustomModalOpen(true);
      return;
    }
    setRange(r);
    setDropdownOpen(false);
  }

  function handleApplyCustom() {
    if (fromDate && toDate) {
      setCustomRange(fromDate, toDate);
      setCustomModalOpen(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Left: Range & Compare */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Date Range Dropdown */}
        <div className="relative">
          <button
            type="button"
            aria-expanded={dropdownOpen}
            aria-label="Select date range"
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-[#121A30] dark:text-slate-200 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Calendar size={15} className="text-indigo-500" />
            <span>
              {range === "custom" && customFrom && customTo
                ? `${customFrom} → ${customTo}`
                : rangeLabels[range]}
            </span>
            <ChevronDown
              size={13}
              className={`transition-transform text-slate-400 ${
                dropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute left-0 mt-1.5 w-48 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl z-50 dark:border-white/10 dark:bg-[#121A30]">
                {(
                  [
                    "today",
                    "7d",
                    "30d",
                    "90d",
                    "this_month",
                    "custom",
                  ] as TimeRange[]
                ).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleSelectRange(r)}
                    className={`flex w-full items-center justify-between px-3.5 py-2 text-xs font-medium transition ${
                      range === r
                        ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold"
                        : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
                    }`}
                  >
                    <span>{rangeLabels[r]}</span>
                    {range === r && <Check size={14} />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Compare Toggle */}
        <button
          type="button"
          onClick={() =>
            setCompare(compare === "prev_period" ? "none" : "prev_period")
          }
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            compare === "prev_period"
              ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:border-indigo-400/30 dark:bg-indigo-400/10 dark:text-indigo-400 font-semibold"
              : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:bg-[#121A30] dark:text-slate-400 dark:hover:bg-white/5"
          }`}
          title="Compare with previous period"
        >
          <span
            className={`h-2 w-2 rounded-full ${
              compare === "prev_period"
                ? "bg-indigo-600 dark:bg-indigo-400"
                : "bg-slate-300 dark:bg-slate-600"
            }`}
          />
          <span>{dict.vsPreviousPeriod}</span>
        </button>

        {/* Real-time SSE indicator */}
        <div
          className="hidden sm:flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-medium text-slate-500 dark:border-white/10 dark:bg-[#121A30] dark:text-slate-400"
          title={sseConnected ? "Connected to real-time events via SSE" : "Polling mode active (60s)"}
        >
          <span className="relative flex h-2 w-2">
            {sseConnected && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                sseConnected ? "bg-emerald-500" : "bg-amber-400"
              }`}
            />
          </span>
          <span className="text-[11px]">
            {sseConnected ? "Live SSE" : "Polling"}
          </span>
        </div>
      </div>

      {/* Right: Refresh, Locale, Customize */}
      <div className="flex items-center gap-2">
        {/* Language Switcher */}
        <button
          type="button"
          onClick={() => setLocale(locale === "en" ? "bn" : "en")}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 shadow-xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-[#121A30] dark:text-slate-300 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          title="Toggle Language (English / বাংলা)"
        >
          <Globe size={14} className="text-slate-400" />
          <span>{locale === "en" ? "বাংলা" : "EN"}</span>
        </button>

        {/* Customize Widgets Button */}
        <button
          type="button"
          onClick={() => setCustomizeModalOpen(true)}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 shadow-xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-[#121A30] dark:text-slate-300 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          title="Customize Dashboard Layout"
        >
          <SlidersHorizontal size={14} className="text-slate-400" />
          <span className="hidden md:inline">{dict.customizeWidgets}</span>
        </button>

        {/* Manual Refresh Button */}
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-[#121A30] dark:text-slate-200 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <RotateCw
            size={14}
            className={`text-slate-500 ${refreshing ? "animate-spin text-indigo-500" : ""}`}
          />
          <span className="hidden sm:inline">
            {refreshing ? dict.refreshing : dict.refresh}
          </span>
          {lastUpdated && (
            <span className="text-[10px] font-normal text-slate-400 dark:text-slate-400">
              {dict.lastUpdated} {lastUpdated}
            </span>
          )}
        </button>
      </div>

      {/* Custom Date Range Modal */}
      {customModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Custom Date Range"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setCustomModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#121A30]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {dict.customRange}
              </h3>
              <button
                type="button"
                onClick={() => setCustomModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCustomModalOpen(false)}
                className="rounded-xl px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyCustom}
                disabled={!fromDate || !toDate}
                className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-50"
              >
                Apply Range
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
