"use client";

import React, { useState } from "react";
import { Target, Pencil, Check, X } from "lucide-react";
import { WidgetCard } from "../ui/widget-card";
import { EmptyState } from "../ui/empty-state";
import { useDashboard } from "../dashboard-context";
import { formatBDT } from "@/lib/format";

export function MonthlyTargetWidget() {
  const { data, dict, locale, updateMonthlyTarget } = useDashboard();
  const targetData = data?.target || data?.monthlyTarget;
  const isStaff = data?.role === "STAFF";

  const targetAmount = Number(targetData?.target ?? targetData?.amount ?? 350000);
  const actualAmount = Number(targetData?.actual ?? targetData?.achieved ?? 0);
  const progressPct = Number(
    targetData?.progressPercentage ?? targetData?.progress ?? 0,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [newTargetInput, setNewTargetInput] = useState(String(targetAmount));
  const [saving, setSaving] = useState(false);

  if (!targetData || isStaff) {
    if (isStaff) {
      return (
        <WidgetCard title={dict.monthlyTarget} subtitle={dict.targetProgress}>
          <div className="flex h-52 items-center justify-center text-xs text-slate-400">
            Target metrics are confidential to Super Admin & Admin roles
          </div>
        </WidgetCard>
      );
    }
    return (
      <WidgetCard title={dict.monthlyTarget} subtitle={dict.targetProgress}>
        <EmptyState
          icon={Target}
          title={dict.noDataTitle}
          description="Set a revenue target for this month to track pacing."
          ctaLabel={dict.setTargetCta}
          onCta={() => setModalOpen(true)}
        />
      </WidgetCard>
    );
  }

  const clampedProgress = Math.min(Math.max(Math.round(progressPct), 0), 100);

  // SVG ring math
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedProgress / 100) * circumference;

  const status =
    targetData.status ||
    (actualAmount >= targetAmount
      ? "achieved"
      : clampedProgress >= 50
        ? "on_track"
        : "at_risk");

  const statusConfig = {
    on_track: {
      label: "On Track",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/20",
      stroke: "#10B981",
    },
    at_risk: {
      label: "At Risk",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/20",
      stroke: "#F59E0B",
    },
    achieved: {
      label: "Achieved",
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-500/10 dark:bg-indigo-500/15 border-indigo-500/20",
      stroke: "#6366F1",
    },
  }[status];

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

  return (
    <>
      <WidgetCard
        title={dict.monthlyTarget}
        subtitle={`${data.month || "This month"} · Target tracking`}
        action={
          <button
            type="button"
            onClick={() => {
              setNewTargetInput(String(targetAmount));
              setModalOpen(true);
            }}
            title={dict.editTarget}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
          >
            <Pencil size={12} />
            <span className="hidden sm:inline">{dict.editTarget}</span>
          </button>
        }
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-2">
          {/* Radial Ring */}
          <div className="relative flex items-center justify-center shrink-0">
            <svg width="150" height="150" className="transform -rotate-90">
              <circle
                cx="75"
                cy="75"
                r={radius}
                className="stroke-slate-100 dark:stroke-white/10"
                strokeWidth="12"
                fill="transparent"
              />
              <circle
                cx="75"
                cy="75"
                r={radius}
                stroke={statusConfig.stroke}
                strokeWidth="12"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                {clampedProgress}%
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold mt-0.5 ${statusConfig.bg} ${statusConfig.color}`}
              >
                {statusConfig.label}
              </span>
            </div>
          </div>

          {/* Target Breakdown Stats */}
          <div className="flex-1 w-full space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-white/5">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Monthly Target:
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                {formatBDT(targetAmount, { compact: false, locale })}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-white/5">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Net Sales to Date:
              </span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatBDT(actualAmount, { compact: false, locale })}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-white/5">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Remaining to Goal:
              </span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                {actualAmount >= targetAmount
                  ? "Goal achieved!"
                  : formatBDT(targetAmount - actualAmount, { compact: false, locale })}
              </span>
            </div>
          </div>
        </div>
      </WidgetCard>

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
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#121A30]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {dict.editTarget}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Monthly Target Amount (৳ BDT)
              </label>
              <input
                type="number"
                min="1000"
                step="5000"
                value={newTargetInput}
                onChange={(e) => setNewTargetInput(e.target.value)}
                placeholder="e.g. 350000"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 font-bold dark:border-white/10 dark:bg-white/5 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-400">
                Pacing calculations use the Asia/Dhaka month window.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTarget}
                disabled={saving || !newTargetInput}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-50"
              >
                <Check size={14} />
                <span>{saving ? "Saving..." : dict.saveTarget}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
