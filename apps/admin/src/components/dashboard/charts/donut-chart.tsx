"use client";

import React, { useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

export interface DonutSegment {
  name: string;
  value: number;
  percentage?: number;
  color?: string;
}

const DEFAULT_PALETTE = [
  "#6366F1", // Indigo
  "#38BDF8", // Sky
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#8B5CF6", // Violet
  "#14B8A6", // Teal
  "#F97316", // Orange
];

export function DonutChart({
  data,
  valuePrefix = "",
  valueSuffix = "",
  centerLabel,
}: {
  data: DonutSegment[];
  valuePrefix?: string;
  valueSuffix?: string;
  centerLabel?: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-xs text-slate-400">
        No segment data available
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + (Number(item?.value) || 0), 0);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
      {/* Donut graphic */}
      <div className="relative h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={74}
              paddingAngle={3}
              onMouseEnter={(_, idx) => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {data.map((entry, index) => {
                const color =
                  entry.color || DEFAULT_PALETTE[index % DEFAULT_PALETTE.length];
                const isHovered = activeIndex === index;
                return (
                  <Cell
                    key={`cell-${entry.name}`}
                    fill={color}
                    stroke="transparent"
                    opacity={activeIndex !== null && !isHovered ? 0.45 : 1}
                    className="transition-opacity duration-200 cursor-pointer"
                  />
                );
              })}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const point = payload[0].payload as DonutSegment;
                const val = Number(point?.value) || 0;
                const pct =
                  point.percentage !== undefined
                    ? point.percentage
                    : total > 0
                      ? Math.round((val / total) * 100)
                      : 0;
                return (
                  <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-[#121A30]/95 text-xs">
                    <p className="font-semibold text-slate-800 dark:text-white">
                      {point.name}
                    </p>
                    <p className="tabular-nums font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                      {valuePrefix}
                      {val.toLocaleString()}
                      {valueSuffix} ({pct}%)
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {centerLabel || "Total"}
          </span>
          <span className="text-sm font-extrabold text-slate-800 dark:text-white tabular-nums">
            {valuePrefix}
            {total.toLocaleString()}
            {valueSuffix}
          </span>
        </div>
      </div>

      {/* Legend list */}
      <div className="flex-1 w-full space-y-1.5 max-h-48 overflow-y-auto [scrollbar-width:thin]">
        {data.map((item, index) => {
          const color =
            item.color || DEFAULT_PALETTE[index % DEFAULT_PALETTE.length];
          const val = Number(item?.value) || 0;
          const pct =
            item.percentage !== undefined
              ? item.percentage
              : total > 0
                ? Math.round((val / total) * 100)
                : 0;
          const isHovered = activeIndex === index;

          return (
            <div
              key={item.name}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              className={`flex items-center justify-between rounded-lg px-2.5 py-1 text-xs transition-colors cursor-pointer ${
                isHovered
                  ? "bg-slate-100 dark:bg-white/10 font-bold"
                  : "hover:bg-slate-50 dark:hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate text-slate-700 dark:text-slate-300">
                  {item.name}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2 tabular-nums">
                <span className="font-semibold text-slate-800 dark:text-white">
                  {valuePrefix}
                  {val.toLocaleString()}
                  {valueSuffix}
                </span>
                <span className="text-[11px] text-slate-400 w-8 text-right">
                  {pct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
