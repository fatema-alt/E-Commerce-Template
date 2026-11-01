"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Boxes } from "lucide-react";
import { WidgetCard } from "../ui/widget-card";
import { EmptyState } from "../ui/empty-state";
import { useDashboard } from "../dashboard-context";

export function LowStockAlertsWidget() {
  const { data, dict } = useDashboard();
  const rawAlerts = data?.lowStock || data?.lowStockAlerts || [];

  const alerts = rawAlerts.map((l) => ({
    id: l.id,
    name: l.name,
    sku: l.sku,
    stock: l.quantity ?? l.stock ?? 0,
    threshold: l.lowStockAt ?? l.threshold ?? 0,
    isOutOfStock: l.isOutOfStock ?? ((l.quantity ?? l.stock ?? 0) <= 0),
  }));

  if (alerts.length === 0) {
    return (
      <WidgetCard title={dict.lowStockAlerts} subtitle="Catalog reorder tracking">
        <EmptyState
          icon={CheckCircle2}
          title="All items well stocked"
          description="None of your active products are currently below reorder thresholds."
          ctaLabel="View Inventory"
          ctaHref="/inventory"
        />
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      title={dict.lowStockAlerts}
      subtitle={`${alerts.length} item${alerts.length > 1 ? "s" : ""} need restock`}
      action={
        <Link
          href="/inventory"
          className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          <Boxes size={13} />
          <span>Manage</span>
        </Link>
      }
    >
      <div className="divide-y divide-slate-100 dark:divide-white/5">
        {alerts.map((item) => {
          const isOut = item.stock <= 0;
          return (
            <div
              key={item.id || item.sku}
              className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                    isOut
                      ? "bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400"
                      : "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
                  }`}
                >
                  <AlertTriangle size={15} />
                </span>
                <div className="truncate">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {item.name}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    SKU: {item.sku} · Threshold: {item.threshold}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-bold tabular-nums ${
                    isOut
                      ? "bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400"
                      : "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
                  }`}
                >
                  {item.stock} left
                </span>

                <Link
                  href={`/inventory?search=${encodeURIComponent(item.sku)}`}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  {dict.restock}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}
