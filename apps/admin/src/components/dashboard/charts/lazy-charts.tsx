"use client";

import dynamic from "next/dynamic";
import { WidgetSkeleton } from "../ui/widget-skeleton";

export const DynamicRevenueComboChart = dynamic(
  () =>
    import("./revenue-combo-chart").then((mod) => mod.RevenueComboChart),
  {
    ssr: false,
    loading: () => <WidgetSkeleton height="h-72" />,
  },
);

export const DynamicDonutChart = dynamic(
  () => import("./donut-chart").then((mod) => mod.DonutChart),
  {
    ssr: false,
    loading: () => <WidgetSkeleton height="h-48" />,
  },
);
