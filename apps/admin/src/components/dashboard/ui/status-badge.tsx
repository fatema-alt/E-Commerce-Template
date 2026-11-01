import React from "react";

export type OrderStatus =
  | "PENDING"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED"
  | "FAILED"
  | string;

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; dot: string }
> = {
  PENDING: {
    label: "Pending",
    bg: "bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/20",
    text: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  PROCESSING: {
    label: "Processing",
    bg: "bg-blue-500/10 dark:bg-blue-500/15 border-blue-500/20",
    text: "text-blue-700 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  SHIPPED: {
    label: "Shipped",
    bg: "bg-cyan-500/10 dark:bg-cyan-500/15 border-cyan-500/20",
    text: "text-cyan-700 dark:text-cyan-400",
    dot: "bg-cyan-500",
  },
  DELIVERED: {
    label: "Delivered",
    bg: "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/20",
    text: "text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  CANCELLED: {
    label: "Cancelled",
    bg: "bg-slate-500/10 dark:bg-slate-500/15 border-slate-500/20",
    text: "text-slate-700 dark:text-slate-400",
    dot: "bg-slate-400",
  },
  REFUNDED: {
    label: "Refunded",
    bg: "bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/20",
    text: "text-rose-700 dark:text-rose-400",
    dot: "bg-rose-500",
  },
  FAILED: {
    label: "Failed",
    bg: "bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/20",
    text: "text-rose-700 dark:text-rose-400",
    dot: "bg-rose-500",
  },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const norm = (status || "").toUpperCase();
  const cfg = STATUS_CONFIG[norm] || {
    label: status,
    bg: "bg-slate-500/10 dark:bg-white/10 border-slate-500/20",
    text: "text-slate-600 dark:text-slate-300",
    dot: "bg-slate-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      <span>{cfg.label}</span>
    </span>
  );
}
