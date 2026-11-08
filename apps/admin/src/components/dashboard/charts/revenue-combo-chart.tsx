"use client";

import React, { useState, useId, useRef } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Download, FileSpreadsheet } from "lucide-react";
import type { RevenueSeriesPoint } from "../dashboard-types";
import { formatBDT } from "@/lib/format";

interface RevenueComboChartProps {
  data: RevenueSeriesPoint[];
  locale?: "en" | "bn";
}

type MetricMode = "all" | "revenue" | "orders" | "aov";

export function RevenueComboChart({ data, locale = "en" }: RevenueComboChartProps) {
  const [metric, setMetric] = useState<MetricMode>("all");
  const chartRef = useRef<HTMLDivElement>(null);
  const gradientId = useId();

  // Export to CSV
  function exportCSV() {
    if (!data || data.length === 0) return;
    const headers = ["Date", "Label", "Revenue (BDT)", "Orders", "AOV (BDT)"];
    const rows = data.map((d) => [
      d.date,
      `"${d.label}"`,
      d.revenue,
      d.orders,
      d.aov,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `revenue_analytics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Export to PNG (SVG canvas rasterizer)
  function exportPNG() {
    if (!chartRef.current) return;
    const svgElem = chartRef.current.querySelector("svg");
    if (!svgElem) return;

    const svgData = new XMLSerializer().serializeToString(svgElem);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    const svgSize = svgElem.getBoundingClientRect();
    canvas.width = svgSize.width * 2;
    canvas.height = svgSize.height * 2;

    img.onload = () => {
      if (!ctx) return;
      ctx.fillStyle = "#121A30";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `revenue_chart_${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-xs text-slate-400">
        No revenue data in this period
      </div>
    );
  }

  return (
    <div className="space-y-4" ref={chartRef}>
      {/* Controls row: metric toggle and export buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50/80 p-0.5 dark:border-white/10 dark:bg-white/5">
          {(
            [
              { id: "all", label: "Combo" },
              { id: "revenue", label: "Revenue" },
              { id: "orders", label: "Orders" },
              { id: "aov", label: "AOV" },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMetric(m.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                metric === m.id
                  ? "bg-white text-indigo-600 shadow-xs dark:bg-[#1A2342] dark:text-indigo-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={exportCSV}
            title="Export CSV"
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
          >
            <FileSpreadsheet size={13} className="text-emerald-500" />
            <span className="hidden sm:inline">CSV</span>
          </button>
          <button
            type="button"
            onClick={exportPNG}
            title="Export PNG"
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
          >
            <Download size={13} className="text-indigo-500" />
            <span className="hidden sm:inline">PNG</span>
          </button>
        </div>
      </div>

      {/* Chart container */}
      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FF7900" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#FF7900" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            {/* Subtle low opacity grid */}
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="currentColor"
              className="text-slate-200 dark:text-white/[0.05]"
              vertical={false}
            />

            {/* X-axis */}
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#8E9BAE" }}
              dy={6}
            />

            {/* Left Y-axis: Revenue (BDT / $) */}
            {(metric === "all" || metric === "revenue" || metric === "aov") && (
              <YAxis
                yAxisId="left"
                orientation="left"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#8E9BAE" }}
                tickFormatter={(val) => {
                  if (val >= 1000) return `${Math.round(val / 1000)}K`;
                  return `${val}`;
                }}
                width={40}
              />
            )}

            {/* Right Y-axis: Orders count */}
            {(metric === "all" || metric === "orders") && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "#8E9BAE" }}
                allowDecimals={false}
                width={25}
              />
            )}

            {/* Custom Tooltip */}
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const point = payload[0].payload as RevenueSeriesPoint;
                return (
                  <div className="rounded-xl border border-[#FF7900]/40 bg-white/95 p-2.5 shadow-xl backdrop-blur-md dark:border-[#FF7900]/40 dark:bg-[#0E131F]/95 text-xs space-y-1">
                    <p className="font-bold text-slate-700 dark:text-slate-300">
                      {point.label}
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-[#FF7900] font-medium">
                        <span className="h-2 w-2 rounded-full bg-[#FF7900]" />
                        Revenue:
                      </span>
                      <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                        {formatBDT(point.revenue, { compact: false, locale })}
                      </span>
                    </div>
                    {point.orders > 0 && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-1.5 text-[#FFA347] font-medium">
                          <span className="h-2 w-2 rounded-full bg-[#FFA347]" />
                          Orders:
                        </span>
                        <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                          {point.orders}
                        </span>
                      </div>
                    )}
                  </div>
                );
              }}
            />

            {/* Render areas, bars, or lines based on metric toggle */}
            {(metric === "all" || metric === "revenue") && (
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke="#FF7900"
                strokeWidth={3}
                fillOpacity={1}
                fill={`url(#${gradientId})`}
              />
            )}

            {(metric === "all" || metric === "orders") && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="orders"
                name="Orders"
                stroke="#FFA347"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                activeDot={{ r: 4, fill: "#FF7900" }}
              />
            )}

            {metric === "aov" && (
              <Bar
                yAxisId="left"
                dataKey="aov"
                name="AOV"
                fill="#FF7900"
                radius={[4, 4, 0, 0]}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
