"use client";

import React from "react";
import { Users, MoreHorizontal } from "lucide-react";
import { useDashboard } from "../dashboard-context";

export function CustomerActivityWidget() {
  const { data } = useDashboard();
  const act = data?.customers || data?.customerActivity;

  const activeCount = Number(act?.active ?? data?.totals?.customers ?? 1);
  const customerChange = data?.changes?.customers;

  // Real traffic sources or local district shares
  const rawSources = data?.sources || data?.trafficSources || [];
  const rawDistricts = data?.geoDistricts || [];

  const breakdown =
    rawSources.length > 0
      ? rawSources.slice(0, 4).map((s) => ({
          name: s.source ? s.source.charAt(0).toUpperCase() + s.source.slice(1).toLowerCase() : "Direct",
          pct: Number(s.share ?? s.percentage ?? 25),
        }))
      : rawDistricts.length > 0
        ? rawDistricts.slice(0, 4).map((d) => ({
            name: d.district || "Dhaka",
            pct: 25,
          }))
        : [
            { name: "Dhaka", pct: 54 },
            { name: "Chattogram", pct: 24 },
            { name: "Narayanganj", pct: 14 },
            { name: "Sylhet", pct: 8 },
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
        {customerChange !== null && customerChange !== undefined ? (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
              customerChange >= 0
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-rose-500/15 text-rose-400"
            }`}
          >
            {customerChange >= 0 ? `↑ +${customerChange.toFixed(1)}%` : `↓ ${customerChange.toFixed(1)}%`}
          </span>
        ) : (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-400 tabular-nums">
            Active
          </span>
        )}
      </div>

      {/* Breakdown Progress Bars */}
      <div className="mt-4 space-y-3 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
        {breakdown.map((c) => (
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
                style={{ width: `${Math.min(c.pct, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
