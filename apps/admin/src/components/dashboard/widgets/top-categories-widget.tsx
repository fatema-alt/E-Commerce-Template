"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useDashboard } from "../dashboard-context";
import { formatBDT } from "@/lib/format";

const CATEGORY_COLORS = ["#FF7900", "#FFA347", "#FFC285", "#FFE0B8"];

export function TopCategoriesWidget() {
  const { data, locale } = useDashboard();
  const rawCategories = data?.categories || data?.topCategories || [];

  const defaultCategories = [
    { name: "Electronics", percentage: 42.8, revenue: 1455200 },
    { name: "Fashion", percentage: 24.5, revenue: 833000 },
    { name: "Home & Kitchen", percentage: 18.1, revenue: 615400 },
    { name: "Beauty & Personal Care", percentage: 14.6, revenue: 496400 },
  ];

  const categories =
    rawCategories.length > 0
      ? rawCategories.slice(0, 4).map((c, i) => {
          const pct = Number(c.share ?? c.percentage ?? defaultCategories[i % 4].percentage);
          return {
            name: c.name,
            percentage: isNaN(pct) || pct <= 0 ? defaultCategories[i % 4].percentage : pct,
            revenue: Number(c.amount ?? c.revenue ?? defaultCategories[i % 4].revenue),
          };
        })
      : defaultCategories;

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const realCategorySales = rawCategories.reduce(
    (sum, c) => sum + Number(c.amount ?? c.revenue ?? 0),
    0
  );
  const totalSalesNumber =
    realCategorySales > 0 ? realCategorySales : Number(data?.totals?.sales ?? 0);

  // Donut geometry: radius 56, circumference = 2 * PI * 56 ≈ 351.86
  const radius = 56;
  const circumference = 2 * Math.PI * radius;

  // Normalize percentages so sum = 100 for proper donut ring
  const sumPct = categories.reduce((sum, item) => sum + item.percentage, 0) || 100;
  const normalizedSlices = categories.map((c, i) => {
    const normPct = (c.percentage / sumPct) * 100;
    return {
      ...c,
      normPct,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    };
  });

  // Calculate cumulative offsets
  let cumulative = 0;
  const slicesWithOffset = normalizedSlices.map((slice) => {
    const offset = cumulative;
    cumulative += slice.normPct;
    return {
      ...slice,
      dashArray: `${Math.max((slice.normPct / 100) * circumference - 3, 1)} ${circumference}`,
      dashOffset: -((offset / 100) * circumference),
    };
  });

  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#0E131F] p-5 shadow-sm transition-all h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
          Top Categories
        </h3>
        <Link
          href="/categories"
          className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
        >
          <span>See All</span>
          <ArrowRight size={13} />
        </Link>
      </div>

      {/* Rock-solid SVG Donut Chart with Center Text */}
      <div className="relative flex items-center justify-center my-auto py-2">
        <div className="relative h-44 w-44 flex items-center justify-center">
          <svg viewBox="0 0 160 160" className="w-full h-full transform -rotate-90 overflow-visible">
            {/* Background track circle */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="transparent"
              stroke="currentColor"
              strokeWidth="15"
              className="text-slate-100 dark:text-[#151B2B]"
            />

            {/* Donut Segments */}
            {slicesWithOffset.map((slice, idx) => {
              const isHovered = activeIndex === idx;
              return (
                <circle
                  key={`donut-slice-${slice.name}`}
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="transparent"
                  stroke={slice.color}
                  strokeWidth={isHovered ? 18 : 15}
                  strokeDasharray={slice.dashArray}
                  strokeDashoffset={slice.dashOffset}
                  opacity={activeIndex !== null && !isHovered ? 0.45 : 1}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseLeave={() => setActiveIndex(null)}
                  className="transition-all duration-300 cursor-pointer"
                />
              );
            })}
          </svg>

          {/* Donut Center Display */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-4">
            <span className="text-[10px] font-medium text-slate-400">
              Total Sales
            </span>
            <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight">
              {formatBDT(totalSalesNumber, { compact: false, locale })}
            </span>
          </div>
        </div>
      </div>

      {/* Categories Breakdown List */}
      <div className="mt-2 space-y-2 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
        {categories.slice(0, 4).map((c, idx) => (
          <div
            key={c.name}
            onMouseEnter={() => setActiveIndex(idx)}
            onMouseLeave={() => setActiveIndex(null)}
            className="flex items-center justify-between text-xs cursor-pointer group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{
                  backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
                }}
              />
              <span className="truncate text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition">
                {c.name}
              </span>
            </div>
            <span className="font-bold text-slate-900 dark:text-white tabular-nums">
              {c.percentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
