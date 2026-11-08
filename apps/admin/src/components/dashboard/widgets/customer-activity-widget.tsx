"use client";

import React from "react";
import { Users, MoreHorizontal } from "lucide-react";
import { useDashboard } from "../dashboard-context";

export function CustomerActivityWidget() {
  const { data } = useDashboard();
  const act = data?.customers || data?.customerActivity;

  const activeCount = act?.active ?? act?.active30d ?? 2758;

  const countries = [
    { name: "United States", pct: 36 },
    { name: "United Kingdom", pct: 24 },
    { name: "Indonesia", pct: 12.5 },
    { name: "Puzzle", pct: 10 },
  ];

  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#0E131F] p-5 shadow-sm transition-all h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-slate-400" />
          <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
            Active Users
          </h3>
        </div>
        <button
          type="button"
          aria-label="More options"
          className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Main Metric Row */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight">
              {activeCount >= 1000 ? activeCount.toLocaleString() : activeCount}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Users in store
            </span>
          </div>
        </div>
        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-400 tabular-nums">
          ↑ +8.2%
        </span>
      </div>

      {/* Country Progress Bars */}
      <div className="mt-4 space-y-3 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
        {countries.map((c) => (
          <div key={c.name} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-600 dark:text-slate-300">
                {c.name}
              </span>
              <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                {c.pct}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-[#1A2234] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#FF7900] transition-all duration-700"
                style={{ width: `${c.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
