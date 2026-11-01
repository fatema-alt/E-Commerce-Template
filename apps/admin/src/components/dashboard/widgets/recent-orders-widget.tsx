"use client";

import React from "react";
import Link from "next/link";
import { ShoppingCart, ArrowRight } from "lucide-react";
import { WidgetCard } from "../ui/widget-card";
import { EmptyState } from "../ui/empty-state";
import { StatusBadge } from "../ui/status-badge";
import { useDashboard } from "../dashboard-context";
import { formatBDT } from "@/lib/format";

export function RecentOrdersWidget() {
  const { data, dict, locale } = useDashboard();
  const orders = data?.recentOrders ?? [];

  if (orders.length === 0) {
    return (
      <WidgetCard title={dict.recentOrders} subtitle="Real-time order activity">
        <EmptyState
          icon={ShoppingCart}
          title={dict.noDataTitle}
          description="New orders will stream into this feed automatically."
          ctaLabel={dict.manageOrdersCta}
          ctaHref="/orders"
        />
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      title={dict.recentOrders}
      subtitle="Latest customer transactions"
      className="col-span-full lg:col-span-2"
      action={
        <Link
          href="/orders"
          className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          <span>{dict.manageOrdersCta}</span>
          <ArrowRight size={13} />
        </Link>
      }
    >
      <div className="overflow-x-auto [scrollbar-width:thin]">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-400 dark:border-white/5 dark:text-slate-400">
              <th className="pb-2.5 font-medium">{dict.orderNumber}</th>
              <th className="pb-2.5 font-medium">{dict.customer}</th>
              <th className="pb-2.5 font-medium">{dict.status}</th>
              <th className="pb-2.5 text-right font-medium">{dict.amount}</th>
              <th className="pb-2.5 text-right font-medium">{dict.time}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {orders.map((o) => {
              const date = new Date(o.createdAt);
              const timeStr = date.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });
              const amount = Number(o.grandTotal ?? o.total ?? 0);

              return (
                <tr
                  key={o.id || o.orderNumber}
                  className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  <td className="py-2.5 font-semibold text-slate-800 dark:text-white">
                    <Link
                      href={`/orders/${o.id}`}
                      className="hover:text-indigo-600 dark:hover:text-indigo-400"
                    >
                      #{o.orderNumber}
                    </Link>
                  </td>
                  <td className="py-2.5">
                    <p className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[120px] sm:max-w-[180px]">
                      {o.customerName}
                    </p>
                    {o.customerEmail && (
                      <p className="text-[10px] text-slate-400 truncate max-w-[120px] sm:max-w-[180px]">
                        {o.customerEmail}
                      </p>
                    )}
                  </td>
                  <td className="py-2.5">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="py-2.5 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                    {formatBDT(amount, { compact: false, locale })}
                  </td>
                  <td className="py-2.5 text-right text-[11px] text-slate-400">
                    {timeStr}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </WidgetCard>
  );
}
