"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { useDashboard } from "../dashboard-context";

const CATEGORY_COLORS = ["#FF7900", "#FFA347", "#FFC285", "#FFE0B8"];

export function TopCategoriesWidget() {
  const { data } = useDashboard();
  const rawCategories = data?.categories || data?.topCategories || [];

  const defaultCategories = [
    { name: "Electronics", percentage: 42.8, revenue: 1455200 },
    { name: "Fashion", percentage: 24.5, revenue: 833000 },
    { name: "Home & Kitchen", percentage: 18.1, revenue: 615400 },
    { name: "Beauty & Personal Care", percentage: 14.6, revenue: 496400 },
  ];

  const categories =
    rawCategories.length > 0
      ? rawCategories.map((c, i) => ({
          name: c.name,
          percentage: Number(c.percentage ?? c.share ?? defaultCategories[i % 4].percentage),
          revenue: Number(c.revenue ?? c.amount ?? defaultCategories[i % 4].revenue),
        }))
      : defaultCategories;

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const totalSales = 3400000;

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

      {/* Donut Chart with Center Text */}
      <div className="relative flex items-center justify-center my-auto py-1">
        <div className="relative h-40 w-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categories}
                dataKey="percentage"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={68}
                paddingAngle={3}
                onMouseEnter={(_, idx) => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {categories.map((entry, index) => {
                  const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
                  const isHovered = activeIndex === index;
                  return (
                    <Cell
                      key={`cat-cell-${entry.name}`}
                      fill={color}
                      stroke="transparent"
                      opacity={activeIndex !== null && !isHovered ? 0.45 : 1}
                      className="cursor-pointer transition-opacity"
                    />
                  );
                })}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0].payload as (typeof categories)[0];
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-1.5 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-[#0E131F]/95 text-xs">
                      <p className="font-bold text-slate-900 dark:text-white">
                        {item.name}
                      </p>
                      <p className="text-[#FF7900] font-semibold">
                        {item.percentage}%
                      </p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Donut Center */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-medium text-slate-400">
              Total Sales
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight">
              ${totalSales.toLocaleString()}
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
