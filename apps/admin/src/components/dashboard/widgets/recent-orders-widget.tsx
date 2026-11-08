"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useDashboard } from "../dashboard-context";
import { formatBDT } from "@/lib/format";

export function RecentOrdersWidget() {
  const { data, locale } = useDashboard();
  const rawOrders = data?.recentOrders ?? [];

  const defaultOrders = [
    {
      id: "ord-1",
      orderNumber: "ORD-684796",
      customerName: "Fatema Yasmin",
      amount: "৳1,325.00",
      status: "Delivered",
      time: "04:07 PM",
      initials: "FY",
      avatarColor: "bg-emerald-500/20 text-emerald-400",
    },
    {
      id: "ord-2",
      orderNumber: "ORD-684795",
      customerName: "Rafiul Alam",
      amount: "৳1,945.50",
      status: "Processing",
      time: "12:35 PM",
      initials: "RA",
      avatarColor: "bg-sky-500/20 text-sky-400",
    },
    {
      id: "ord-3",
      orderNumber: "ORD-684794",
      customerName: "Nusrat Jahan",
      amount: "৳577.50",
      status: "Confirmed",
      time: "05:17 PM",
      initials: "NJ",
      avatarColor: "bg-purple-500/20 text-purple-400",
    },
    {
      id: "ord-4",
      orderNumber: "ORD-684793",
      customerName: "Imran Hossain",
      amount: "৳1,242.50",
      status: "Confirmed",
      time: "04:53 PM",
      initials: "IH",
      avatarColor: "bg-amber-500/20 text-amber-400",
    },
  ];

  const orders =
    rawOrders.length > 0
      ? rawOrders.slice(0, 4).map((o, i) => {
          const date = new Date(o.createdAt);
          const timeStr = date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          const initials = o.customerName
            ? o.customerName
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()
            : "CU";

          return {
            id: o.id,
            orderNumber: o.orderNumber,
            customerName: o.customerName,
            amount: formatBDT(Number(o.grandTotal ?? o.total ?? 0), {
              compact: false,
              locale,
            }),
            status:
              o.status === "DELIVERED"
                ? "Delivered"
                : o.status === "PROCESSING"
                  ? "Processing"
                  : "Confirmed",
            time: timeStr,
            initials,
            avatarColor: defaultOrders[i % 4].avatarColor,
          };
        })
      : defaultOrders;

  function renderStatusBadge(status: string) {
    switch (status) {
      case "Delivered":
        return (
          <span className="inline-block rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
            Delivered
          </span>
        );
      case "Processing":
        return (
          <span className="inline-block rounded-full bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-bold text-sky-400">
            Processing
          </span>
        );
      default:
        return (
          <span className="inline-block rounded-full bg-slate-200 dark:bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">
            Confirmed
          </span>
        );
    }
  }

  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#0E131F] p-5 shadow-sm transition-all h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
          Recent Orders
        </h3>
        <Link
          href="/orders"
          className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
        >
          <span>View All</span>
          <ArrowRight size={13} />
        </Link>
      </div>

      {/* Table */}
      <div className="overflow-x-auto [scrollbar-width:thin]">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 dark:border-white/[0.06] text-slate-400">
              <th className="pb-3 pr-3 font-medium whitespace-nowrap">Order ID</th>
              <th className="pb-3 px-2 font-medium">Customer</th>
              <th className="pb-3 px-3 font-medium whitespace-nowrap">Amount</th>
              <th className="pb-3 px-2 font-medium">Status</th>
              <th className="pb-3 pl-2 text-right font-medium whitespace-nowrap">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            {orders.map((o) => {
              const displayOrderNo =
                o.orderNumber && o.orderNumber.length > 14
                  ? `${o.orderNumber.slice(0, 10)}…`
                  : o.orderNumber;

              return (
                <tr
                  key={o.id}
                  className="group hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-3 pr-3 font-bold text-slate-800 dark:text-white whitespace-nowrap">
                    <Link
                      href={`/orders/${o.id}`}
                      className="hover:text-[#FF7900] transition"
                      title={`#${o.orderNumber}`}
                    >
                      #{displayOrderNo}
                    </Link>
                  </td>
                  <td className="py-3 px-2 max-w-[150px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${o.avatarColor}`}
                      >
                        {o.initials}
                      </div>
                      <span
                        className="font-semibold text-slate-800 dark:text-slate-200 truncate"
                        title={o.customerName}
                      >
                        {o.customerName}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                    {o.amount}
                  </td>
                  <td className="py-3 px-2 whitespace-nowrap">{renderStatusBadge(o.status)}</td>
                  <td className="py-3 pl-2 text-right text-slate-400 dark:text-[#8E9BAE] tabular-nums whitespace-nowrap">
                    {o.time}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
