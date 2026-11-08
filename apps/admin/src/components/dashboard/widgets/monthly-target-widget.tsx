"use client";

import React, { useState } from "react";
import { MoreHorizontal, Pencil, TrendingUp } from "lucide-react";
import { useDashboard } from "../dashboard-context";
import { formatBDT } from "@/lib/format";

export function MonthlyTargetWidget() {
  const { data, locale, updateMonthlyTarget } = useDashboard();
  const targetData = data?.target || data?.monthlyTarget;

  const hasConfiguredTarget = Boolean(targetData?.amount || targetData?.target);
  const defaultTarget = 50000;
  const targetAmount = Number(targetData?.amount ?? targetData?.target ?? defaultTarget);
  const actualAmount = Number(targetData?.achieved ?? targetData?.actual ?? data?.totals?.sales ?? 0);

  const progressPct =
    targetAmount > 0
      ? Math.min(100, Math.max(0, Math.round((actualAmount / targetAmount) * 100)))
      : 0;

  const [modalOpen, setModalOpen] = useState(false);
  const [newTargetInput, setNewTargetInput] = useState(String(targetAmount));
  const [saving, setSaving] = useState(false);

  const clampedProgress = Math.min(Math.max(Math.round(progressPct), 0), 100);

  // 180° semi-circular gauge geometry
  // Arc from (25, 105) to (175, 105) with radius 75 has length π * 75 ≈ 235.62
  const arcLength = 235.62;
  const strokeDashoffset = arcLength - (clampedProgress / 100) * arcLength;

  async function handleSaveTarget() {
    const val = parseFloat(newTargetInput);
    if (isNaN(val) || val <= 0) return;
    setSaving(true);
    const ok = await updateMonthlyTarget(val);
    setSaving(false);
    if (ok) {
      setModalOpen(false);
    }
  }

  const salesChange = data?.changes?.sales;

  return (
    <>
      <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#0E131F] p-5 shadow-sm transition-all h-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
            Monthly Target
          </h3>
          <button
            type="button"
            onClick={() => {
              setNewTargetInput(String(targetAmount));
              setModalOpen(true);
            }}
            title="Options & Edit Target"
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            <MoreHorizontal size={16} />
          </button>
        </div>

        {/* 180° Gauge Display */}
        <div className="flex flex-col items-center justify-center my-auto pt-2">
          <div className="relative flex items-center justify-center w-full max-w-[210px]">
            <svg viewBox="0 0 200 118" className="w-full overflow-visible">
              {/* Background Track */}
              <path
                d="M 25 105 A 75 75 0 0 1 175 105"
                fill="none"
                stroke="currentColor"
                strokeWidth="15"
                strokeLinecap="round"
                className="text-slate-100 dark:text-[#1A2234]"
              />
              {/* Progress Arc */}
              <path
                d="M 25 105 A 75 75 0 0 1 175 105"
                fill="none"
                stroke="#FF7900"
                strokeWidth="15"
                strokeLinecap="round"
                strokeDasharray={arcLength}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-x-0 bottom-1 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight">
                {clampedProgress}%
              </span>
            </div>
          </div>

          {/* Subtext */}
          <div
            className={`mt-2.5 flex items-center gap-1 text-xs font-semibold ${
              salesChange !== null && salesChange !== undefined && salesChange < 0
                ? "text-rose-500 dark:text-rose-400"
                : "text-emerald-500 dark:text-emerald-400"
            }`}
          >
            {salesChange !== null && salesChange !== undefined ? (
              <>
                <span>{salesChange >= 0 ? "↑" : "↓"}</span>
                <span>
                  {salesChange >= 0 ? `+${salesChange.toFixed(1)}%` : `${salesChange.toFixed(1)}%`}{" "}
                  from previous period
                </span>
              </>
            ) : (
              <span>
                {clampedProgress >= 100 ? "Goal Achieved!" : `${100 - clampedProgress}% remaining to target`}
              </span>
            )}
          </div>
        </div>

        {/* Bottom Two Stats Boxes */}
        <div className="mt-4 grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
          <div
            onClick={() => {
              setNewTargetInput(String(targetAmount));
              setModalOpen(true);
            }}
            className="rounded-xl bg-slate-50 dark:bg-[#151B2B] p-2.5 text-center border border-slate-100 dark:border-white/[0.04] cursor-pointer hover:border-[#FF7900]/50 transition group"
            title="Click to edit target"
          >
            <div className="flex items-center justify-center gap-1">
              <p className="text-[11px] font-medium text-slate-500 dark:text-[#8E9BAE]">
                Target {hasConfiguredTarget ? "" : "(Default)"}
              </p>
              <Pencil size={10} className="text-slate-400 group-hover:text-[#FF7900] transition" />
            </div>
            <p className="mt-0.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-white tabular-nums truncate">
              {formatBDT(targetAmount, { compact: false, locale })}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-[#151B2B] p-2.5 text-center border border-slate-100 dark:border-white/[0.04]">
            <p className="text-[11px] font-medium text-slate-500 dark:text-[#8E9BAE]">
              Achieved
            </p>
            <p className="mt-0.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-white tabular-nums truncate">
              {formatBDT(actualAmount, { compact: false, locale })}
            </p>
          </div>
        </div>
      </div>

      {/* Edit Target Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit Monthly Target"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#0E131F]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Set Monthly Target
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Target Amount (BDT ৳)
              </label>
              <input
                type="number"
                value={newTargetInput}
                onChange={(e) => setNewTargetInput(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#FF7900]"
              />
              <p className="text-[11px] text-slate-400">
                Enter your monthly sales target in BDT. This updates real-time tracking across the dashboard.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveTarget}
                  className="rounded-xl bg-[#FF7900] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#e66d00] transition disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save Target"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
