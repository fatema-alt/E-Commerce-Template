"use client";

import React from "react";
import Link from "next/link";
import { Users, UserPlus, UserCheck, Repeat } from "lucide-react";
import { WidgetCard } from "../ui/widget-card";
import { useDashboard } from "../dashboard-context";

export function CustomerActivityWidget() {
  const { data, dict } = useDashboard();
  const act = data?.customerActivity;

  const repeatRate = act?.repeatPurchaseRate !== null && act?.repeatPurchaseRate !== undefined
    ? act.repeatPurchaseRate
    : null;

  return (
    <WidgetCard
      title={dict.customerActivity}
      subtitle="Customer engagement & retention"
      action={
        <Link
          href="/customers"
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          Directory
        </Link>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {/* Active Customers (30d) */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-white/5 dark:bg-white/5">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Users size={14} className="text-indigo-500" />
            <span className="text-[11px] font-medium truncate">
              {dict.activeCustomers}
            </span>
          </div>
          <p className="mt-2 text-xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {act?.active30d ?? 0}
          </p>
          <span className="text-[10px] text-slate-400">Active past 30 days</span>
        </div>

        {/* New in Period */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-white/5 dark:bg-white/5">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <UserPlus size={14} className="text-emerald-500" />
            <span className="text-[11px] font-medium truncate">
              {dict.newCustomers}
            </span>
          </div>
          <p className="mt-2 text-xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {act?.newInPeriod ?? 0}
          </p>
          <span className="text-[10px] text-slate-400">New this period</span>
        </div>

        {/* Returning Customers */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-white/5 dark:bg-white/5">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <UserCheck size={14} className="text-sky-500" />
            <span className="text-[11px] font-medium truncate">
              {dict.returningCustomers}
            </span>
          </div>
          <p className="mt-2 text-xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {act?.returningCustomers ?? 0}
          </p>
          <span className="text-[10px] text-slate-400">2+ orders placed</span>
        </div>

        {/* Repeat Purchase Rate */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-white/5 dark:bg-white/5">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Repeat size={14} className="text-fuchsia-500" />
            <span className="text-[11px] font-medium truncate">
              {dict.repeatPurchaseRate}
            </span>
          </div>
          <p className="mt-2 text-xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {repeatRate !== null ? `${repeatRate}%` : "—"}
          </p>
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-600 transition-all duration-500"
              style={{ width: `${repeatRate ?? 0}%` }}
            />
          </div>
        </div>
      </div>
    </WidgetCard>
  );
}
