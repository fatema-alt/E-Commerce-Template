"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { DynamicRevenueComboChart } from "../charts/lazy-charts";
import { useDashboard } from "../dashboard-context";

export function RevenueAnalyticsWidget() {
  const { data, locale } = useDashboard();
  const [selectedRange, setSelectedRange] = useState("Last 7 Days");
  const rawSeries = data?.revenue || data?.revenueSeries || [];

  const defaultSeries = [
    { label: "Nov 02", revenue: 42000, orders: 22, aov: 1909 },
    { label: "Nov 03", revenue: 54000, orders: 28, aov: 1928 },
    { label: "Nov 04", revenue: 68000, orders: 34, aov: 2000 },
    { label: "Nov 05", revenue: 76521, orders: 42, aov: 1821 },
    { label: "Nov 06", revenue: 62000, orders: 31, aov: 2000 },
    { label: "Nov 07", revenue: 71000, orders: 38, aov: 1868 },
    { label: "Nov 08", revenue: 84000, orders: 45, aov: 1866 },
  ];

  const series =
    rawSeries.length > 0
      ? rawSeries.map((d) => ({
          date: d.date || d.day || "",
          label: d.label || d.day || d.date || "",
          revenue: Number(d.revenue ?? 0),
          orders: Number(d.orders ?? 0),
          aov: Number(d.aov ?? 0),
        }))
      : defaultSeries;

  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#0E131F] p-5 shadow-sm transition-all h-full">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
            Revenue Analytics
          </h3>
          <div className="mt-1 flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
              <span className="h-2 w-2 rounded-full bg-[#FF7900]" />
              Revenue
            </span>
            <span className="flex items-center gap-1.5 font-medium text-slate-500 dark:text-slate-400">
              <span className="inline-block w-3.5 border-b-2 border-dashed border-[#FFA347]" />
              Orders
            </span>
          </div>
        </div>

        {/* Period dropdown */}
        <div className="relative">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition"
          >
            <span>{selectedRange}</span>
            <ChevronDown size={13} className="text-slate-400" />
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="min-w-0 flex-1 pt-1">
        <DynamicRevenueComboChart data={series} locale={locale} />
      </div>
    </div>
  );
}
