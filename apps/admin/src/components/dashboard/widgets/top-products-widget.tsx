"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Headphones, Watch, Speaker, Package } from "lucide-react";
import { useDashboard } from "../dashboard-context";
import { formatBDT } from "@/lib/format";

export function TopProductsWidget() {
  const { data, locale } = useDashboard();
  const rawProducts = data?.topProducts ?? [];

  const defaultProducts = [
    {
      id: "prod-1",
      name: "Wireless Bluetooth Headphones",
      sold: "1,980 sold",
      price: "$1,980.00",
      icon: Headphones,
      image: null,
    },
    {
      id: "prod-2",
      name: "Smart Watch Pro",
      sold: "1,754 sold",
      price: "$1,799.00",
      icon: Watch,
      image: null,
    },
    {
      id: "prod-3",
      name: "Wireless Earbuds",
      sold: "1,420 sold",
      price: "$1,500.00",
      icon: Speaker,
      image: null,
    },
  ];

  const products =
    rawProducts.length >= 3
      ? rawProducts.slice(0, 3).map((p, i) => ({
          id: p.id || `prod-${i}`,
          name: p.name,
          sold: `${p.units ?? p.unitsSold ?? 1000} sold`,
          price: formatBDT(p.revenue, { compact: false, locale }),
          icon: defaultProducts[i % 3].icon,
          image: p.image,
        }))
      : defaultProducts;

  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#0E131F] p-5 shadow-sm transition-all h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
          Top Selling Products
        </h3>
        <Link
          href="/products"
          className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
        >
          <span>View All</span>
          <ArrowRight size={13} />
        </Link>
      </div>

      {/* Product List */}
      <div className="my-auto divide-y divide-slate-100 dark:divide-white/[0.06] pt-1">
        {products.map((p) => {
          const Icon = p.icon || Package;
          return (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-[#151B2B] border border-slate-200/60 dark:border-white/[0.06] flex items-center justify-center text-slate-500 dark:text-slate-300">
                  {p.image ? (
                    <Image
                      src={p.image}
                      alt={p.name}
                      fill
                      unoptimized
                      className="object-cover"
                      sizes="44px"
                    />
                  ) : (
                    <Icon size={20} className="text-slate-600 dark:text-slate-300" />
                  )}
                </div>
                <div className="truncate">
                  <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                    {p.name}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-[#8E9BAE] mt-0.5">
                    {p.sold}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                  {p.price}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
