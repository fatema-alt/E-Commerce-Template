"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Package } from "lucide-react";
import { WidgetCard } from "../ui/widget-card";
import { EmptyState } from "../ui/empty-state";
import { useDashboard } from "../dashboard-context";
import { formatBDT } from "@/lib/format";

export function TopProductsWidget() {
  const { data, dict, locale } = useDashboard();
  const products = data?.topProducts ?? [];

  if (products.length === 0) {
    return (
      <WidgetCard title={dict.topProducts} subtitle={dict.unitsSold}>
        <EmptyState
          icon={Package}
          title={dict.noDataTitle}
          description="Product sales rankings will appear once orders are placed."
          ctaLabel={dict.viewCatalogCta}
          ctaHref="/products"
        />
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      title={dict.topProducts}
      subtitle={dict.unitsSold}
      action={
        <Link
          href="/products"
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          View all
        </Link>
      }
    >
      <div className="divide-y divide-slate-100 dark:divide-white/5">
        {products.map((p, idx) => {
          const units = p.units ?? p.unitsSold ?? 0;
          const rev = Number(p.revenue ?? 0);

          return (
            <div
              key={p.id || p.sku || p.name}
              className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 dark:bg-white/5 text-[10px] font-bold text-slate-400">
                  {idx + 1}
                </span>
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center">
                  {p.image ? (
                    <Image
                      src={p.image}
                      alt={p.name}
                      fill
                      unoptimized
                      className="object-cover"
                      sizes="40px"
                    />
                  ) : (
                    <Package size={18} className="text-slate-400" />
                  )}
                </div>
                <div className="truncate">
                  <Link
                    href={`/products/${p.id}`}
                    className="text-xs font-semibold text-slate-800 hover:text-indigo-600 dark:text-slate-200 dark:hover:text-indigo-400 truncate block"
                  >
                    {p.name}
                  </Link>
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    {units} units sold
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatBDT(rev, { compact: false, locale })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}
