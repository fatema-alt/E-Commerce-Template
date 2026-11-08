"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useDashboard } from "../dashboard-context";

export function GeoDistrictsWidget() {
  const { data } = useDashboard();
  const [selectedRange, setSelectedRange] = useState("Last 7 Days");

  const defaultDistricts = [
    { name: "Narayanganj", sales: "$24.4K", color: "#FF7900" },
    { name: "Dhaka", sales: "$11.8K", color: "#FFA347" },
  ];

  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#0E131F] p-5 shadow-sm transition-all h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
          Sales by District
        </h3>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition"
        >
          <span>{selectedRange}</span>
          <ChevronDown size={13} className="text-slate-400" />
        </button>
      </div>

      {/* Main Body: District stats on left, Bangladesh Map on right */}
      <div className="flex items-center justify-between gap-4 my-auto">
        {/* District list */}
        <div className="space-y-4 min-w-[140px]">
          {defaultDistricts.map((d) => (
            <div key={d.name} className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: d.color }}
                />
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {d.name}
                </span>
              </div>
              <span className="font-extrabold text-slate-900 dark:text-white tabular-nums text-sm">
                {d.sales}
              </span>
            </div>
          ))}
        </div>

        {/* Bangladesh Map Silhouette with Glowing Radar Pulse */}
        <div className="relative w-32 sm:w-40 h-44 shrink-0 flex items-center justify-center">
          <svg
            viewBox="0 0 160 200"
            className="w-full h-full overflow-visible"
            aria-label="Bangladesh Sales Map"
          >
            {/* Bangladesh Geographic Silhouette */}
            <path
              d="M 58 16 
                 C 64 12, 70 18, 75 22 
                 C 78 28, 86 30, 93 32 
                 C 98 34, 107 33, 114 36 
                 C 122 40, 132 44, 136 52 
                 C 139 60, 136 68, 131 74 
                 C 126 80, 126 87, 128 94 
                 C 130 102, 137 108, 142 115 
                 C 147 122, 146 130, 144 138 
                 C 141 148, 136 158, 132 168 
                 C 129 174, 124 179, 120 181 
                 C 117 176, 118 166, 113 162 
                 C 107 157, 101 161, 95 163 
                 C 88 165, 82 163, 76 160 
                 C 70 157, 63 158, 57 160 
                 C 50 162, 44 159, 41 153 
                 C 38 147, 39 139, 39 132 
                 C 38 123, 34 116, 31 108 
                 C 28 100, 27 92, 30 84 
                 C 33 76, 39 70, 42 62 
                 C 45 54, 45 44, 48 36 
                 C 50 28, 53 20, 58 16 Z"
              className="fill-[#e8d5c4] dark:fill-[#4a2e1b] transition-colors"
            />

            {/* Glowing Pulse at Dhaka / Narayanganj Location (approx 85, 105) */}
            <g transform="translate(85, 105)">
              {/* Outer soft aura */}
              <circle r="16" fill="#FF7900" opacity="0.25" className="animate-pulse" />
              {/* Inner glowing ring */}
              <circle r="10" fill="#FF7900" opacity="0.55" />
              {/* Center point */}
              <circle r="4" fill="#FF7900" stroke="#FFFFFF" strokeWidth="1.5" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
