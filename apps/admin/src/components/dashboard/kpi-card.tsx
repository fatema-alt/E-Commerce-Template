"use client";

import { useEffect, useState, useId } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

export type KpiAccent =
  | "sales"
  | "orders"
  | "customers"
  | "inventory"
  | "aov"
  | "refund"
  | "conversion";

interface KpiCardProps {
  title: string;
  formattedValue: string;
  tooltipValue?: string;
  change: number | null;
  changeLabel?: string;
  accent: KpiAccent;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  sparkline?: number[];
  badge?: React.ReactNode;
  href?: string;
  loading?: boolean;
}

const ACCENT_STYLES: Record<
  KpiAccent,
  {
    chipBg: string;
    chipText: string;
    gradientFrom: string;
    gradientTo: string;
    sparklineColor: string;
    hoverGlow: string;
    borderHover: string;
  }
> = {
  sales: {
    chipBg: "from-indigo-500 to-violet-600",
    chipText: "text-white",
    gradientFrom: "#6366F1",
    gradientTo: "#8B5CF6",
    sparklineColor: "#6366F1",
    hoverGlow: "group-hover:shadow-[0_0_24px_rgba(99,102,241,0.22)]",
    borderHover: "hover:border-indigo-500/40",
  },
  orders: {
    chipBg: "from-cyan-400 to-blue-600",
    chipText: "text-white",
    gradientFrom: "#22D3EE",
    gradientTo: "#3B82F6",
    sparklineColor: "#0284C7",
    hoverGlow: "group-hover:shadow-[0_0_24px_rgba(59,130,246,0.22)]",
    borderHover: "hover:border-blue-500/40",
  },
  customers: {
    chipBg: "from-emerald-400 to-teal-600",
    chipText: "text-white",
    gradientFrom: "#10B981",
    gradientTo: "#14B8A6",
    sparklineColor: "#10B981",
    hoverGlow: "group-hover:shadow-[0_0_24px_rgba(16,185,129,0.22)]",
    borderHover: "hover:border-emerald-500/40",
  },
  inventory: {
    chipBg: "from-amber-400 to-orange-500",
    chipText: "text-white",
    gradientFrom: "#F59E0B",
    gradientTo: "#F97316",
    sparklineColor: "#F59E0B",
    hoverGlow: "group-hover:shadow-[0_0_24px_rgba(245,158,11,0.22)]",
    borderHover: "hover:border-amber-500/40",
  },
  aov: {
    chipBg: "from-fuchsia-500 to-purple-600",
    chipText: "text-white",
    gradientFrom: "#D946EF",
    gradientTo: "#8B5CF6",
    sparklineColor: "#D946EF",
    hoverGlow: "group-hover:shadow-[0_0_24px_rgba(217,70,239,0.22)]",
    borderHover: "hover:border-fuchsia-500/40",
  },
  refund: {
    chipBg: "from-pink-500 to-rose-600",
    chipText: "text-white",
    gradientFrom: "#EC4899",
    gradientTo: "#F43F5E",
    sparklineColor: "#F43F5E",
    hoverGlow: "group-hover:shadow-[0_0_24px_rgba(244,63,94,0.22)]",
    borderHover: "hover:border-rose-500/40",
  },
  conversion: {
    chipBg: "from-teal-400 to-emerald-600",
    chipText: "text-white",
    gradientFrom: "#14B8A6",
    gradientTo: "#10B981",
    sparklineColor: "#14B8A6",
    hoverGlow: "group-hover:shadow-[0_0_24px_rgba(20,184,166,0.22)]",
    borderHover: "hover:border-teal-500/40",
  },
};

export function Sparkline({
  data,
  color,
  fromColor,
  toColor,
}: {
  data: number[];
  color: string;
  fromColor?: string;
  toColor?: string;
}) {
  const gradientId = useId();
  if (!data || data.length < 2) {
    return <div className="h-8 w-20" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 80;
  const height = 30;
  const padding = 2;

  const points = data.map((val, idx) => {
    const x = padding + (idx / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((val - min) / range) * (height - 2 * padding);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(" L ")}`;
  const areaD = `${pathD} L ${width - padding},${height} L ${padding},${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0 overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fromColor || color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={toColor || color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradientId})`} />
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KPICard({
  title,
  formattedValue,
  tooltipValue,
  change,
  changeLabel = "vs prev period",
  accent,
  icon: Icon,
  sparkline,
  badge,
  href,
  loading = false,
}: KpiCardProps) {
  const [pulse, setPulse] = useState(false);
  const style = ACCENT_STYLES[accent];

  // Subtle pulse flash on value change
  useEffect(() => {
    const pulseTimer = setTimeout(() => setPulse(true), 0);
    const resetTimer = setTimeout(() => setPulse(false), 600);
    return () => {
      clearTimeout(pulseTimer);
      clearTimeout(resetTimer);
    };
  }, [formattedValue]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-xs dark:border-white/10 dark:bg-[#121A30]/70 backdrop-blur-md animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 rounded bg-slate-200 dark:bg-white/10" />
          <div className="h-9 w-9 rounded-xl bg-slate-200 dark:bg-white/10" />
        </div>
        <div className="mt-4 h-8 w-32 rounded bg-slate-200 dark:bg-white/10" />
        <div className="mt-4 flex items-center justify-between">
          <div className="h-4 w-20 rounded bg-slate-200 dark:bg-white/10" />
          <div className="h-6 w-16 rounded bg-slate-200 dark:bg-white/10" />
        </div>
      </div>
    );
  }

  const CardContent = (
    <div
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white/80 p-5 shadow-xs backdrop-blur-md transition-all duration-300 dark:border-white/10 dark:bg-[#121A30]/85 ${style.borderHover} ${style.hoverGlow}`}
    >
      {/* Top row: Title and Icon Chip */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
          {title}
        </p>
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${style.chipBg} ${style.chipText} shadow-xs transition-transform group-hover:scale-105`}
        >
          <Icon size={18} />
        </div>
      </div>

      {/* Value Row: Compact formatted value with clamp & tooltip */}
      <div className="mt-3 min-w-0">
        <div
          title={tooltipValue || formattedValue}
          aria-label={`${title}: ${tooltipValue || formattedValue}`}
          className={`truncate font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums transition-colors duration-300 text-2xl sm:text-3xl ${
            pulse ? "text-indigo-600 dark:text-indigo-400 scale-[1.01]" : ""
          }`}
          style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {formattedValue}
        </div>
        {badge && <div className="mt-1">{badge}</div>}
      </div>

      {/* Bottom row: Trend badge & Sparkline */}
      <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
        <div className="flex items-center gap-1.5 min-w-0">
          {change !== null ? (
            <span
              className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums ${
                change > 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
                  : change < 0
                    ? "bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400"
                    : "bg-slate-500/10 text-slate-600 dark:bg-white/10 dark:text-slate-300"
              }`}
            >
              {change > 0 ? (
                <TrendingUp size={13} className="shrink-0" />
              ) : change < 0 ? (
                <TrendingDown size={13} className="shrink-0" />
              ) : (
                <Minus size={13} className="shrink-0" />
              )}
              <span>
                {change > 0 ? `+${change}%` : `${change}%`}
              </span>
            </span>
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-400">—</span>
          )}
          <span className="text-[10px] text-slate-400 dark:text-slate-400 truncate hidden sm:inline">
            {changeLabel}
          </span>
        </div>

        {sparkline && sparkline.length > 1 && (
          <Sparkline
            data={sparkline}
            color={style.sparklineColor}
            fromColor={style.gradientFrom}
            toColor={style.gradientTo}
          />
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-2xl"
      >
        {CardContent}
      </Link>
    );
  }

  return CardContent;
}
