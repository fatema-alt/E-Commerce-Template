"use client";

import React from "react";
import { CreditCard } from "lucide-react";
import { WidgetCard } from "../ui/widget-card";
import { EmptyState } from "../ui/empty-state";
import { DynamicDonutChart } from "../charts/lazy-charts";
import { useDashboard } from "../dashboard-context";

const GATEWAY_COLORS: Record<string, string> = {
  BKASH: "#D12053",
  NAGAD: "#F7941D",
  SSLCOMMERZ: "#2E3192",
  COD: "#10B981",
  CASH_ON_DELIVERY: "#10B981",
};

export function PaymentMethodsWidget() {
  const { data, dict } = useDashboard();
  const methods = data?.paymentMethods ?? [];

  if (methods.length === 0 || methods.every((m) => m.count === 0)) {
    return (
      <WidgetCard title={dict.paymentMethods} subtitle="Gateway transactions">
        <EmptyState
          icon={CreditCard}
          title={dict.noDataTitle}
          description="Payment method splits will display when transactions settle."
          ctaLabel="Payment Settings"
          ctaHref="/settings/payments"
        />
      </WidgetCard>
    );
  }

  const donutData = methods.map((m) => {
    const name = (m.method || m.provider || "Other") as string;
    return {
      name,
      value: Number(m.count ?? 0),
      percentage: m.share ?? m.percentage ?? 0,
      color: GATEWAY_COLORS[name.toUpperCase()],
    };
  });

  return (
    <WidgetCard
      title={dict.paymentMethods}
      subtitle="Orders grouped by settlement method"
    >
      <DynamicDonutChart
        data={donutData}
        valueSuffix=" orders"
        centerLabel="Payments"
      />
    </WidgetCard>
  );
}
