"use client";

import React from "react";
import { Activity, ShoppingCart, Star, Boxes } from "lucide-react";
import { WidgetCard } from "../ui/widget-card";
import { EmptyState } from "../ui/empty-state";
import { useDashboard } from "../dashboard-context";

export function ActivityFeedWidget() {
  const { data, dict } = useDashboard();
  const feed = data?.activityFeed ?? [];

  if (feed.length === 0) {
    return (
      <WidgetCard title={dict.activityFeed} subtitle="Live operational events">
        <EmptyState
          icon={Activity}
          title={dict.noDataTitle}
          description="Real-time events will appear as customers place orders and post reviews."
        />
      </WidgetCard>
    );
  }

  function getEventIcon(type: string) {
    switch (type) {
      case "order":
        return <ShoppingCart size={14} className="text-emerald-500" />;
      case "review":
        return <Star size={14} className="text-amber-500" />;
      case "stock":
        return <Boxes size={14} className="text-rose-500" />;
      default:
        return <Activity size={14} className="text-indigo-500" />;
    }
  }

  function formatEventTime(ts: string): string {
    const d = new Date(ts);
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <WidgetCard
      title={dict.activityFeed}
      subtitle="Latest customer & store actions"
    >
      <div className="space-y-3">
        {feed.map((item) => (
          <div key={item.id} className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/10">
              {getEventIcon(item.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {item.title}
                </p>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {formatEventTime(item.timestamp)}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}
