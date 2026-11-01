"use client";

import React from "react";
import { MapPin } from "lucide-react";
import { WidgetCard } from "../ui/widget-card";
import { EmptyState } from "../ui/empty-state";
import { useDashboard } from "../dashboard-context";
import { formatBDT } from "@/lib/format";

export function GeoDistrictsWidget() {
  const { data, dict, locale } = useDashboard();
  const districts = data?.geoDistricts ?? [];

  if (districts.length === 0) {
    return (
      <WidgetCard title={dict.ordersByDistrict} subtitle="Regional breakdown">
        <EmptyState
          icon={MapPin}
          title={dict.noDataTitle}
          description="Customer shipping locations across Bangladesh will populate here."
        />
      </WidgetCard>
    );
  }

  const maxOrders = Math.max(...districts.map((d) => d.orders), 1);

  return (
    <WidgetCard
      title={dict.ordersByDistrict}
      subtitle="Sales distribution across Bangladesh"
    >
      <div className="space-y-3">
        {districts.map((d) => {
          const pct = Math.round((d.orders / maxOrders) * 100);
          return (
            <div key={d.district} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <MapPin size={12} className="text-indigo-500" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {d.district}
                  </span>
                </div>
                <div className="flex items-center gap-3 tabular-nums">
                  <span className="text-slate-500 dark:text-slate-400">
                    {d.orders} orders
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatBDT(d.revenue, { compact: true, locale })}
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 transition-all duration-500"
                  style={{ width: `${Math.max(pct, 4)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}
