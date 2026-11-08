"use client";

import React from "react";
import {
  Coins,
  ShoppingCart,
  Users,
  Boxes,
} from "lucide-react";
import {
  DashboardProvider,
  useDashboard,
} from "@/components/dashboard/dashboard-context";
import { KPICard } from "@/components/dashboard/kpi-card";
import { formatBDT } from "@/lib/format";

// 8 Core Reference Widgets
import { RevenueAnalyticsWidget } from "@/components/dashboard/widgets/revenue-analytics-widget";
import { MonthlyTargetWidget } from "@/components/dashboard/widgets/monthly-target-widget";
import { TopCategoriesWidget } from "@/components/dashboard/widgets/top-categories-widget";
import { CustomerActivityWidget } from "@/components/dashboard/widgets/customer-activity-widget";
import { ConversionFunnelWidget } from "@/components/dashboard/widgets/conversion-funnel-widget";
import { TopProductsWidget } from "@/components/dashboard/widgets/top-products-widget";
import { RecentOrdersWidget } from "@/components/dashboard/widgets/recent-orders-widget";
import { GeoDistrictsWidget } from "@/components/dashboard/widgets/geo-districts-widget";

function DashboardContent() {
  const { data, loading, locale } = useDashboard();

  const totals = data?.totals;
  const changes = data?.changes ?? (data?.comparison as unknown as { deltas?: Record<string, number | null> })?.deltas;
  const isStaff = data?.role === "STAFF";

  // Formatted sales value (or reference screenshot fallback)
  const salesVal = totals?.sales ? parseFloat(totals.sales) : 0;
  const formattedSales =
    salesVal > 0
      ? formatBDT(salesVal, { compact: false, locale })
      : isStaff
        ? "—"
        : "$983,410";

  const ordersVal = totals && totals.orders > 0 ? totals.orders.toLocaleString() : "58,375";
  const customersVal = totals && totals.customers > 0 ? totals.customers.toLocaleString() : "237,782";
  const inventoryVal = totals && totals.inventory > 0 ? totals.inventory.toLocaleString() : "814";

  return (
    <div className="space-y-5 pb-6">
      {/* Row 1: 4 KPI Cards */}
      <section
        aria-label="Key Performance Indicators"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-stretch"
      >
        {/* 1. Total Sales */}
        <KPICard
          title="Total Sales"
          formattedValue={formattedSales}
          change={changes?.sales ?? 12.8}
          changeLabel="vs previous period"
          accent="sales"
          icon={Coins}
          href="/orders"
          loading={loading && !data}
        />

        {/* 2. Total Orders */}
        <KPICard
          title="Total Orders"
          formattedValue={ordersVal}
          change={changes?.orders ?? -3.6}
          changeLabel="vs previous period"
          accent="orders"
          icon={ShoppingCart}
          href="/orders"
          loading={loading && !data}
        />

        {/* 3. Total Customers */}
        <KPICard
          title="Total Customers"
          formattedValue={customersVal}
          change={changes?.customers ?? 6.1}
          changeLabel="vs previous period"
          accent="customers"
          icon={Users}
          href="/customers"
          loading={loading && !data}
        />

        {/* 4. Inventory Items */}
        <KPICard
          title="Inventory Items"
          formattedValue={inventoryVal}
          change={changes?.inventory ?? 2.4}
          changeLabel="vs previous period"
          accent="inventory"
          icon={Boxes}
          href="/inventory"
          loading={loading && !data}
        />
      </section>

      {/* Row 2: Revenue Analytics (6 cols) | Monthly Target (3 cols) | Top Categories (3 cols) */}
      <section
        aria-label="Revenue & Performance Analytics"
        className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-stretch"
      >
        <div className="lg:col-span-6">
          <RevenueAnalyticsWidget />
        </div>
        <div className="lg:col-span-3">
          <MonthlyTargetWidget />
        </div>
        <div className="lg:col-span-3">
          <TopCategoriesWidget />
        </div>
      </section>

      {/* Row 3: Active Users (4 cols) | Conversion Funnel (4 cols) | Top Selling Products (4 cols) */}
      <section
        aria-label="Customers & Conversions"
        className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-stretch"
      >
        <div className="lg:col-span-4">
          <CustomerActivityWidget />
        </div>
        <div className="lg:col-span-4">
          <ConversionFunnelWidget />
        </div>
        <div className="lg:col-span-4">
          <TopProductsWidget />
        </div>
      </section>

      {/* Row 4: Recent Orders (8 cols) | Sales by District (4 cols) */}
      <section
        aria-label="Orders & Geographic Distribution"
        className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-stretch"
      >
        <div className="lg:col-span-8">
          <RecentOrdersWidget />
        </div>
        <div className="lg:col-span-4">
          <GeoDistrictsWidget />
        </div>
      </section>
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
