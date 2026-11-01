"use client";

import React from "react";
import { TrendingUp } from "lucide-react";
import { WidgetCard } from "../ui/widget-card";
import { EmptyState } from "../ui/empty-state";
import { DynamicRevenueComboChart } from "../charts/lazy-charts";
import { useDashboard } from "../dashboard-context";

export function RevenueAnalyticsWidget() {
  const { data, dict, locale } = useDashboard();
  const series = data?.revenueSeries ?? [];

  if (series.length === 0) {
    return (
      <WidgetCard title={dict.revenueAnalytics} subtitle={dict.salesNote}>
        <EmptyState
          icon={TrendingUp}
          title={dict.noDataTitle}
          description={dict.noDataDescription}
        />
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      title={dict.revenueAnalytics}
      subtitle={dict.salesNote}
      className="col-span-full"
    >
      <DynamicRevenueComboChart data={series} locale={locale} />
    </WidgetCard>
  );
}
