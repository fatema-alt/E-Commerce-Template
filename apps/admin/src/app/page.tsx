"use client";

import React from "react";
import {
  Wallet,
  ShoppingBag,
  Users,
  Boxes,
  BadgeDollarSign,
  RotateCcw,
  Percent,
} from "lucide-react";
import {
  DashboardProvider,
  useDashboard,
} from "@/components/dashboard/dashboard-context";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { KPICard } from "@/components/dashboard/kpi-card";
import { WidgetCustomizer } from "@/components/dashboard/widget-customizer";
import { formatBDT } from "@/lib/format";

// 12 Modular Widgets
import { RevenueAnalyticsWidget } from "@/components/dashboard/widgets/revenue-analytics-widget";
import { MonthlyTargetWidget } from "@/components/dashboard/widgets/monthly-target-widget";
import { TopCategoriesWidget } from "@/components/dashboard/widgets/top-categories-widget";
import { TopProductsWidget } from "@/components/dashboard/widgets/top-products-widget";
import { RecentOrdersWidget } from "@/components/dashboard/widgets/recent-orders-widget";
import { CustomerActivityWidget } from "@/components/dashboard/widgets/customer-activity-widget";
import { ConversionFunnelWidget } from "@/components/dashboard/widgets/conversion-funnel-widget";
import { TrafficSourcesWidget } from "@/components/dashboard/widgets/traffic-sources-widget";
import { LowStockAlertsWidget } from "@/components/dashboard/widgets/low-stock-alerts-widget";
import { PaymentMethodsWidget } from "@/components/dashboard/widgets/payment-methods-widget";
import { GeoDistrictsWidget } from "@/components/dashboard/widgets/geo-districts-widget";
import { ActivityFeedWidget } from "@/components/dashboard/widgets/activity-feed-widget";

function getGreeting(locale: "en" | "bn"): string {
  // Asia/Dhaka UTC+6
  const now = new Date();
  const dhakaHour = (now.getUTCHours() + 6) % 24;

  if (locale === "bn") {
    if (dhakaHour < 12) return "শুভ সকাল";
    if (dhakaHour < 17) return "শুভ দুপুর";
    return "শুভ সন্ধ্যা";
  }
  if (dhakaHour < 12) return "Good morning";
  if (dhakaHour < 17) return "Good afternoon";
  return "Good evening";
}

function DashboardContent() {
  const { data, loading, dict, locale, widgetOrder, hiddenWidgets } =
    useDashboard();

  const greeting = getGreeting(locale);
  const totals = data?.totals;
  const changes = data?.changes;
  const sparklines = data?.sparklines;
  const isStaff = data?.role === "STAFF";

  // Formatted sales value
  const formattedSales =
    totals?.sales !== null && totals?.sales !== undefined
      ? formatBDT(parseFloat(totals.sales), { compact: true, locale })
      : isStaff
        ? "—"
        : "৳0";

  const tooltipSales =
    totals?.sales !== null && totals?.sales !== undefined
      ? formatBDT(parseFloat(totals.sales), { compact: false, locale })
      : isStaff
        ? "Confidential for Staff"
        : "৳0.00";

  // Formatted AOV value
  const formattedAov =
    totals?.aov !== null && totals?.aov !== undefined
      ? formatBDT(parseFloat(totals.aov), { compact: true, locale })
      : "—";

  const tooltipAov =
    totals?.aov !== null && totals?.aov !== undefined
      ? formatBDT(parseFloat(totals.aov), { compact: false, locale })
      : "—";

  // Formatted refund rate
  const formattedRefund =
    totals?.refundRate !== null && totals?.refundRate !== undefined
      ? `${totals.refundRate}%`
      : "—";

  // Formatted conversion rate
  const formattedConversion =
    totals?.conversionRate !== null && totals?.conversionRate !== undefined
      ? `${totals.conversionRate}%`
      : "—";

  // Widget registry for dynamic sorting & visibility
  const widgetRegistry: Record<string, React.ReactNode> = {
    "revenue-combo": <RevenueAnalyticsWidget key="revenue-combo" />,
    "monthly-target": <MonthlyTargetWidget key="monthly-target" />,
    "conversion-funnel": <ConversionFunnelWidget key="conversion-funnel" />,
    "top-categories": <TopCategoriesWidget key="top-categories" />,
    "top-products": <TopProductsWidget key="top-products" />,
    "recent-orders": <RecentOrdersWidget key="recent-orders" />,
    "customer-activity": <CustomerActivityWidget key="customer-activity" />,
    "traffic-sources": <TrafficSourcesWidget key="traffic-sources" />,
    "low-stock-alerts": <LowStockAlertsWidget key="low-stock-alerts" />,
    lowStockAlerts: <LowStockAlertsWidget key="lowStockAlerts" />,
    "payment-methods": <PaymentMethodsWidget key="payment-methods" />,
    "geo-districts": <GeoDistrictsWidget key="geo-districts" />,
    "activity-feed": <ActivityFeedWidget key="activity-feed" />,
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome Bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {greeting}, Admin
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{dict.liveData}</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Store operations overview · Asia/Dhaka (UTC+6)
          </p>
        </div>
      </div>

      {/* Global Header Controls: Range Picker, Compare, SSE, Locale, Layout */}
      <div className="rounded-2xl border border-slate-200/90 bg-white/80 p-3 sm:p-4 shadow-xs backdrop-blur-md dark:border-white/10 dark:bg-[#121A30]/85">
        <DateRangePicker />
      </div>

      {/* KPI Cards Grid: 4 columns on large screens, 2 on medium, 1 on mobile */}
      <section
        aria-label="Key Performance Indicators"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {/* 1. Total Sales */}
        <KPICard
          title={dict.totalSales}
          formattedValue={formattedSales}
          tooltipValue={tooltipSales}
          change={changes?.sales ?? null}
          changeLabel={dict.vsPreviousPeriod}
          accent="sales"
          icon={Wallet}
          sparkline={sparklines?.sales}
          href="/orders"
          loading={loading && !data}
        />

        {/* 2. Total Orders */}
        <KPICard
          title={dict.totalOrders}
          formattedValue={
            totals ? totals.orders.toLocaleString() : "0"
          }
          tooltipValue={
            totals
              ? `${totals.orders} orders (${totals.breakdown.pending} pending, ${totals.breakdown.processing} processing)`
              : undefined
          }
          change={changes?.orders ?? null}
          changeLabel={dict.vsPreviousPeriod}
          accent="orders"
          icon={ShoppingBag}
          sparkline={sparklines?.orders}
          badge={
            totals && totals.breakdown.pending > 0 ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {totals.breakdown.pending} pending
              </span>
            ) : undefined
          }
          href="/orders"
          loading={loading && !data}
        />

        {/* 3. Customers */}
        <KPICard
          title={dict.customers}
          formattedValue={
            totals ? totals.customers.toLocaleString() : "0"
          }
          tooltipValue={
            totals ? `${totals.customers} new customers in period` : undefined
          }
          change={changes?.customers ?? null}
          changeLabel={dict.vsPreviousPeriod}
          accent="customers"
          icon={Users}
          sparkline={sparklines?.customers}
          href="/customers"
          loading={loading && !data}
        />

        {/* 4. Inventory Items */}
        <KPICard
          title={dict.inventoryItems}
          formattedValue={
            totals ? totals.inventory.toLocaleString() : "0"
          }
          tooltipValue={
            totals
              ? `${totals.inventory} on-hand units (${totals.lowStockCount} low stock, ${totals.outOfStockCount} out of stock)`
              : undefined
          }
          change={changes?.inventory ?? null}
          changeLabel={dict.vsPreviousPeriod}
          accent="inventory"
          icon={Boxes}
          sparkline={sparklines?.inventory}
          badge={
            totals && (totals.lowStockCount > 0 || totals.outOfStockCount > 0) ? (
              <div className="flex items-center gap-2 text-[10px] font-bold">
                {totals.lowStockCount > 0 && (
                  <span className="text-amber-600 dark:text-amber-400">
                    {totals.lowStockCount} low
                  </span>
                )}
                {totals.outOfStockCount > 0 && (
                  <span className="text-rose-600 dark:text-rose-400">
                    {totals.outOfStockCount} out
                  </span>
                )}
              </div>
            ) : undefined
          }
          href="/inventory"
          loading={loading && !data}
        />

        {/* 5. Average Order Value (AOV) */}
        <KPICard
          title={dict.avgOrderValue}
          formattedValue={formattedAov}
          tooltipValue={tooltipAov}
          change={changes?.aov ?? null}
          changeLabel={dict.vsPreviousPeriod}
          accent="aov"
          icon={BadgeDollarSign}
          sparkline={sparklines?.aov}
          href="/orders"
          loading={loading && !data}
        />

        {/* 6. Refund Rate */}
        <KPICard
          title={dict.refundRate}
          formattedValue={formattedRefund}
          tooltipValue={
            totals?.refundRate !== null ? `${totals?.refundRate}% of revenue` : undefined
          }
          change={changes?.refundRate ?? null}
          changeLabel={dict.vsPreviousPeriod}
          accent="refund"
          icon={RotateCcw}
          sparkline={sparklines?.refundRate}
          href="/orders?status=REFUNDED"
          loading={loading && !data}
        />

        {/* 7. Conversion Rate */}
        <KPICard
          title={dict.conversionRate}
          formattedValue={formattedConversion}
          tooltipValue={
            totals?.conversionRate !== null
              ? `${totals?.conversionRate}% of sessions purchase`
              : undefined
          }
          change={changes?.conversionRate ?? null}
          changeLabel={dict.vsPreviousPeriod}
          accent="conversion"
          icon={Percent}
          href="/cms/tracking"
          loading={loading && !data}
        />
      </section>

      {/* Dynamic 12 Widgets Grid: Sorted & filtered by user configuration */}
      <section
        aria-label="Dashboard Widgets"
        className="grid grid-cols-1 gap-5 lg:grid-cols-2"
      >
        {widgetOrder
          .filter((id) => !hiddenWidgets.includes(id))
          .map((id) => widgetRegistry[id])
          .filter(Boolean)}
      </section>

      {/* Layout Customizer Modal */}
      <WidgetCustomizer />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <DashboardProvider>
      <DashboardContent />
    </DashboardProvider>
  );
}
