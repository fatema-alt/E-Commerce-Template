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
    iconBg: string;
    iconColor: string;
    cardBg: string;
    borderHover: string;
  }
> = {
  sales: {
    iconBg: "bg-[#FF7900]/15 dark:bg-[#FF7900]/15",
    iconColor: "text-[#FF7900]",
    cardBg: "bg-white dark:bg-gradient-to-br dark:from-[#FF7900]/10 dark:via-[#0E131F] dark:to-[#0E131F]",
    borderHover: "hover:border-[#FF7900]/40",
  },
  orders: {
    iconBg: "bg-slate-100 dark:bg-white/5",
    iconColor: "text-slate-600 dark:text-slate-300",
    cardBg: "bg-white dark:bg-[#0E131F]",
    borderHover: "hover:border-white/20",
  },
  customers: {
    iconBg: "bg-slate-100 dark:bg-white/5",
    iconColor: "text-slate-600 dark:text-slate-300",
    cardBg: "bg-white dark:bg-[#0E131F]",
    borderHover: "hover:border-white/20",
  },
  inventory: {
    iconBg: "bg-slate-100 dark:bg-white/5",
    iconColor: "text-slate-600 dark:text-slate-300",
    cardBg: "bg-white dark:bg-[#0E131F]",
    borderHover: "hover:border-white/20",
  },
  aov: {
    iconBg: "bg-slate-100 dark:bg-white/5",
    iconColor: "text-slate-600 dark:text-slate-300",
    cardBg: "bg-white dark:bg-[#0E131F]",
    borderHover: "hover:border-white/20",
  },
  refund: {
    iconBg: "bg-slate-100 dark:bg-white/5",
    iconColor: "text-slate-600 dark:text-slate-300",
    cardBg: "bg-white dark:bg-[#0E131F]",
    borderHover: "hover:border-white/20",
  },
  conversion: {
    iconBg: "bg-slate-100 dark:bg-white/5",
    iconColor: "text-slate-600 dark:text-slate-300",
    cardBg: "bg-white dark:bg-[#0E131F]",
    borderHover: "hover:border-white/20",
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
      <div className="rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#0E131F] p-5 shadow-sm animate-pulse">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-slate-200 dark:bg-white/10" />
            <div className="h-4 w-20 rounded bg-slate-200 dark:bg-white/10" />
          </div>
          <div className="h-5 w-14 rounded-full bg-slate-200 dark:bg-white/10" />
        </div>
        <div className="mt-4 h-8 w-28 rounded bg-slate-200 dark:bg-white/10" />
      </div>
    );
  }

  const CardContent = (
    <div
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 dark:border-white/[0.07] p-5 shadow-sm transition-all duration-300 ${style.cardBg} ${style.borderHover}`}
    >
      {/* Top row: Left (Icon + Title), Right (Change pill + subtext) */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${style.iconBg} ${style.iconColor} transition-transform group-hover:scale-105`}
          >
            <Icon size={16} />
          </div>
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {title}
          </span>
        </div>

        {/* Change pill & vs previous period */}
        <div className="flex flex-col items-end">
          {change !== null ? (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                change >= 0
                  ? "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400"
                  : "bg-rose-500/15 text-rose-500 dark:text-rose-400"
              }`}
            >
              {change >= 0 ? "↑" : "↓"} {change > 0 ? `+${change}%` : `${change}%`}
            </span>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
          <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            {changeLabel}
          </span>
        </div>
      </div>

      {/* Value Row: Large bold text */}
      <div className="mt-4 min-w-0">
        <div
          title={tooltipValue || formattedValue}
          aria-label={`${title}: ${tooltipValue || formattedValue}`}
          className={`truncate font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums transition-colors duration-300 text-2xl sm:text-[28px] ${
            pulse ? "text-[#FF7900] scale-[1.01]" : ""
          }`}
        >
          {formattedValue}
        </div>
        {badge && <div className="mt-1">{badge}</div>}
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
