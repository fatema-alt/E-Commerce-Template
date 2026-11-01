"use client";

import React from "react";
import { Filter, Eye, ShoppingCart, CreditCard, CheckCircle2 } from "lucide-react";
import { WidgetCard } from "../ui/widget-card";
import { EmptyState } from "../ui/empty-state";
import { useDashboard } from "../dashboard-context";

export function ConversionFunnelWidget() {
  const { data, dict } = useDashboard();
  const funnel = data?.funnel;

  if (
    !funnel ||
    (funnel.productViews === 0 &&
      funnel.addToCart === 0 &&
      funnel.checkoutStart === 0 &&
      funnel.purchases === 0)
  ) {
    return (
      <WidgetCard title={dict.conversionFunnel} subtitle="Storefront customer journey">
        <EmptyState
          icon={Filter}
          title={dict.noDataTitle}
          description="Analytics events will populate this funnel as visitors browse products."
          ctaLabel="Tracking Settings"
          ctaHref="/cms/tracking"
        />
      </WidgetCard>
    );
  }

  const stages = [
    {
      label: dict.productViews,
      count: funnel.productViews,
      icon: Eye,
      color: "from-indigo-500 to-indigo-600",
      pctOfTop: 100,
      dropoff: funnel.dropoffViewsToCart,
    },
    {
      label: dict.addedToCart,
      count: funnel.addToCart,
      icon: ShoppingCart,
      color: "from-cyan-500 to-blue-600",
      pctOfTop:
        funnel.productViews > 0
          ? Math.round((funnel.addToCart / funnel.productViews) * 100)
          : 0,
      dropoff: funnel.dropoffCartToCheckout,
    },
    {
      label: dict.checkout,
      count: funnel.checkoutStart,
      icon: CreditCard,
      color: "from-fuchsia-500 to-purple-600",
      pctOfTop:
        funnel.productViews > 0
          ? Math.round((funnel.checkoutStart / funnel.productViews) * 100)
          : 0,
      dropoff: funnel.dropoffCheckoutToPurchase,
    },
    {
      label: dict.purchases,
      count: funnel.purchases,
      icon: CheckCircle2,
      color: "from-emerald-500 to-teal-600",
      pctOfTop:
        funnel.productViews > 0
          ? Math.round((funnel.purchases / funnel.productViews) * 100)
          : 0,
      dropoff: null,
    },
  ];

  return (
    <WidgetCard
      title={dict.conversionFunnel}
      subtitle="Storefront conversion stages & drop-off"
    >
      <div className="space-y-4">
        {stages.map((stage, idx) => {
          const Icon = stage.icon;
          return (
            <div key={stage.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                    <Icon size={13} />
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {stage.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 tabular-nums">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {stage.count.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-slate-400 w-10 text-right">
                    {stage.pctOfTop}%
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${stage.color} transition-all duration-700`}
                  style={{ width: `${Math.max(stage.pctOfTop, 2)}%` }}
                />
              </div>

              {/* Drop-off notice */}
              {stage.dropoff !== null && idx < stages.length - 1 && (
                <div className="flex justify-end pr-1 text-[10px] text-rose-500/80 font-medium tabular-nums">
                  ↓ {stage.dropoff}% {dict.dropOff}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}
