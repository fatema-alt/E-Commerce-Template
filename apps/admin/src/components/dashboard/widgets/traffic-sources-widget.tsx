"use client";

import React from "react";
import { Compass } from "lucide-react";
import { WidgetCard } from "../ui/widget-card";
import { EmptyState } from "../ui/empty-state";
import { useDashboard } from "../dashboard-context";

const SOURCE_COLORS: Record<string, string> = {
  direct: "bg-indigo-500",
  organic: "bg-emerald-500",
  social: "bg-sky-500",
  referral: "bg-amber-500",
  email: "bg-purple-500",
  paid: "bg-rose-500",
};

export function TrafficSourcesWidget() {
  const { data, dict } = useDashboard();
  const rawSources = data?.sources || data?.trafficSources || [];

  const sources = rawSources.map((s) => ({
    source: s.source,
    sessions: s.count ?? s.sessions ?? 0,
    percentage: s.share ?? s.percentage ?? 0,
  }));

  if (sources.length === 0 || sources.every((s) => s.sessions === 0)) {
    return (
      <WidgetCard title={dict.trafficSources} subtitle="Acquisition breakdown">
        <EmptyState
          icon={Compass}
          title={dict.noDataTitle}
          description="Traffic sources will show where visitors are arriving from."
        />
      </WidgetCard>
    );
  }

  const totalSessions = sources.reduce((sum, s) => sum + s.sessions, 0);

  return (
    <WidgetCard
      title={dict.trafficSources}
      subtitle={`${totalSessions.toLocaleString()} ${dict.trackedSessions}`}
    >
      <div className="space-y-3">
        {sources.map((item) => {
          const color = SOURCE_COLORS[item.source.toLowerCase()] || "bg-slate-400";
          const capitalized =
            item.source.charAt(0).toUpperCase() + item.source.slice(1);

          return (
            <div key={item.source} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {capitalized}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 tabular-nums">
                  <span className="font-medium text-slate-500 dark:text-slate-400">
                    {item.sessions} sessions
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white w-8 text-right">
                    {item.percentage}%
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${color} transition-all duration-500`}
                  style={{ width: `${Math.max(item.percentage, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}
