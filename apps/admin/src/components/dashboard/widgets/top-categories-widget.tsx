"use client";

import React from "react";
import { FolderTree } from "lucide-react";
import { WidgetCard } from "../ui/widget-card";
import { EmptyState } from "../ui/empty-state";
import { DynamicDonutChart } from "../charts/lazy-charts";
import { useDashboard } from "../dashboard-context";
import { formatBDT } from "@/lib/format";

export function TopCategoriesWidget() {
  const { data, dict, locale } = useDashboard();
  const rawCategories = data?.categories || data?.topCategories || [];

  const categories = rawCategories.map((c) => ({
    name: c.name,
    revenue: Number(c.revenue ?? c.amount ?? 0),
    percentage: Number(c.percentage ?? c.share ?? 0),
    orders: c.orders,
  }));

  if (categories.length === 0) {
    return (
      <WidgetCard title={dict.topCategories} subtitle={dict.categoryShare}>
        <EmptyState
          icon={FolderTree}
          title={dict.noDataTitle}
          description="Category distribution will populate as customers order products."
          ctaLabel={dict.viewCatalogCta}
          ctaHref="/categories"
        />
      </WidgetCard>
    );
  }

  const donutData = categories.map((c) => ({
    name: c.name,
    value: c.revenue,
    percentage: c.percentage,
  }));

  return (
    <WidgetCard title={dict.topCategories} subtitle={dict.categoryShare}>
      <DynamicDonutChart
        data={donutData}
        valuePrefix="৳"
        centerLabel="Categories"
      />
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 space-y-2">
        {categories.slice(0, 4).map((c, idx) => (
          <div
            key={c.name}
            className="flex items-center justify-between text-xs"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 dark:bg-white/5 text-[10px] font-bold text-slate-500">
                #{idx + 1}
              </span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {c.name}
              </span>
            </div>
            <div className="flex items-center gap-3 tabular-nums">
              {c.orders !== undefined && (
                <span className="text-slate-400">{c.orders} orders</span>
              )}
              <span className="font-bold text-slate-900 dark:text-white">
                {formatBDT(c.revenue, { compact: true, locale })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}
