"use client";
import { useState } from "react";
import { useDashboard } from "@/lib/dashboard";
import Link from "next/link";
import {
  ArrowUpRight,
  Boxes,
  ChevronRight,
  CircleHelp,
  CreditCard,
  FolderTree,
  MousePointer2,
  Package,
  ShoppingBag,
  ShoppingCart,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

const stats = [
  {
    key: "sales",
    title: "Total sales",
    icon: Wallet,
    note: "BDT net sales after refunds",
    href: "/orders",
  },
  {
    key: "orders",
    title: "Total orders",
    icon: ShoppingBag,
    note: "All order statuses",
    href: "/orders",
  },
  {
    key: "customers",
    title: "Customers",
    icon: Users,
    note: "Customer records, excluding deleted",
    href: "/customers",
  },
  {
    key: "inventory",
    title: "Inventory items",
    icon: Boxes,
    note: "On-hand units across your catalog",
    href: "/inventory",
  },
];

const quickLinks = [
  { label: "Manage orders", href: "/orders", icon: ShoppingCart },
  { label: "View products", href: "/products", icon: Package },
  { label: "Manage categories", href: "/categories", icon: FolderTree },
  { label: "Customer directory", href: "/customers", icon: Users },
];

function Card({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-slate-900 sm:text-base">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyMetric({
  label = "No activity recorded yet",
}: {
  label?: string;
}) {
  return <span className="text-xs font-medium text-slate-400">{label}</span>;
}

export default function DashboardPage() {
  const { data, unavailable, refresh, canEditTarget, saveTarget, saving } =
    useDashboard();
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const number = (value: number | undefined) =>
    value === undefined
      ? unavailable
        ? "Unavailable"
        : "…"
      : value.toLocaleString("en-BD");
  const money = (value: string | number | undefined) =>
    value === undefined
      ? number(undefined)
      : new Intl.NumberFormat("en-BD", {
          style: "currency",
          currency: "BDT",
          maximumFractionDigits: 2,
          notation: Number(value) >= 10000000 ? "compact" : "standard",
        }).format(Number(value));
  const target = Number(data?.target.amount ?? 0);
  const progress =
    target > 0
      ? Math.max(0, (Number(data?.target.achieved ?? 0) / target) * 100)
      : 0;
  const revenueMax = Math.max(
    1,
    ...(data?.revenue.map((d) => Math.max(0, Number(d.revenue))) ?? []),
  );
  const ordersMax = Math.max(1, ...(data?.revenue.map((d) => d.orders) ?? []));
  const categoryTotal =
    data?.categories.reduce(
      (sum, c) => sum + Math.max(0, Number(c.amount)),
      0,
    ) ?? 0;
  const sourceTotal = data?.sources.reduce((sum, c) => sum + c.count, 0) ?? 0;
  const colors = ["#6366f1", "#38bdf8", "#34d399", "#fbbf24", "#f472b6"];
  const categoryGradient = data?.categories
    .map((category, i) => {
      const from =
        (data.categories
          .slice(0, i)
          .reduce((sum, item) => sum + Math.max(0, Number(item.amount)), 0) /
          (categoryTotal || 1)) *
        360;
      const to =
        from +
        (Math.max(0, Number(category.amount)) / (categoryTotal || 1)) * 360;
      return colors[i] + " " + from + "deg " + to + "deg";
    })
    .join(",");
  return (
    <main
      className="space-y-5 pb-8 sm:space-y-6"
      aria-busy={!data && !unavailable}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
            Store overview
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {unavailable ? (
              <button
                type="button"
                onClick={() => void refresh()}
                className="text-red-600 hover:underline"
              >
                {data
                  ? "Refresh failed · showing last available data. Retry"
                  : "Dashboard unavailable. Retry"}
              </button>
            ) : data ? (
              "Live store data | refreshed " +
              new Date(data.updatedAt).toLocaleTimeString("en-BD", {
                timeZone: "Asia/Dhaka",
                hour: "2-digit",
                minute: "2-digit",
              })
            ) : (
              "Loading live store data..."
            )}
          </p>
        </div>
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          View orders <ArrowUpRight size={16} />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ key, title, icon: Icon, note, href }) => (
          <Link
            href={href}
            key={title}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <span className="text-sm font-medium text-slate-500">
                {title}
              </span>
              <span className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
                <Icon size={18} />
              </span>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-slate-900">
              {key === "sales"
                ? money(data?.totals.sales)
                : number(
                    data?.totals[key as "orders" | "customers" | "inventory"],
                  )}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400">{note}</span>
              <ArrowUpRight
                size={15}
                className="shrink-0 text-slate-300 group-hover:text-indigo-600"
              />
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <Card
          title="Revenue analytics"
          className="xl:col-span-6"
          action={
            <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
              Last 7 days
            </span>
          }
        >
          <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-500" /> Revenue
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-sky-300" /> Orders
            </span>
          </div>
          <div className="relative flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 sm:h-56">
            <div
              className="pointer-events-none absolute inset-0 flex flex-col justify-evenly px-4 opacity-60"
              aria-hidden="true"
            >
              {[0, 1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="border-t border-dashed border-slate-200"
                />
              ))}
            </div>
            {data ? (
              <div
                className="relative grid h-full w-full grid-cols-7 items-end gap-2 px-4 pb-6 pt-4"
                role="img"
                aria-label="BDT net sales and order counts over the last seven days; bar heights use separate scales"
              >
                {data.revenue.map((day) => (
                  <div
                    key={day.day}
                    className="relative flex h-full items-end justify-center gap-1"
                    title={
                      day.day +
                      ": " +
                      money(day.revenue) +
                      " ? " +
                      number(day.orders) +
                      " orders"
                    }
                  >
                    <div
                      className="w-3 rounded-t bg-indigo-500 sm:w-5"
                      style={{
                        height:
                          (Math.max(0, Number(day.revenue)) / revenueMax) *
                            100 +
                          "%",
                      }}
                    />
                    <div
                      className="w-3 rounded-t bg-sky-300 sm:w-5"
                      style={{ height: (day.orders / ordersMax) * 100 + "%" }}
                    />
                    <span className="absolute -bottom-5 text-[10px] text-slate-500">
                      {day.day.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyMetric
                label={
                  unavailable ? "Revenue unavailable" : "Loading revenue..."
                }
              />
            )}
          </div>
        </Card>

        <Card
          title="Monthly target"
          className="xl:col-span-3"
          action={
            <button
              type="button"
              aria-label="Edit monthly sales target"
              disabled={!canEditTarget || !data || saving}
              onClick={() => {
                setTargetInput(data?.target.amount ?? "");
                setEditingTarget((value) => !value);
              }}
              className="text-slate-400 hover:text-indigo-600 disabled:cursor-default"
            >
              <Target size={18} />
            </button>
          }
        >
          <div className="flex min-h-52 flex-col items-center justify-center text-center">
            <div className="relative flex h-36 w-36 items-center justify-center rounded-full border-[13px] border-slate-100">
              {target > 0 && (
                <svg
                  viewBox="0 0 144 144"
                  className="absolute -inset-[13px] h-36 w-36 -rotate-90"
                  aria-hidden="true"
                >
                  <circle
                    cx="72"
                    cy="72"
                    r="65.5"
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="13"
                    strokeDasharray={
                      (Math.min(100, progress) / 100) * 411.55 + " 411.55"
                    }
                    strokeLinecap="round"
                  />
                </svg>
              )}
              <div className="relative flex flex-col items-center gap-1">
                <span className="text-2xl font-bold text-slate-900">
                  {data
                    ? target > 0
                      ? progress.toFixed(1) + "%"
                      : "—"
                    : number(undefined)}
                </span>
                <span className="text-xs text-slate-400">Target progress</span>
              </div>
            </div>
            {editingTarget ? (
              <form
                className="mt-5 w-full space-y-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (await saveTarget(targetInput)) setEditingTarget(false);
                }}
              >
                <input
                  aria-label="Monthly sales target in BDT"
                  type="number"
                  required
                  min="0"
                  max="9999999999.99"
                  step="0.01"
                  value={targetInput}
                  onChange={(event) => setTargetInput(event.target.value)}
                  disabled={saving}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Saving?" : "Save target"}
                </button>
              </form>
            ) : (
              <>
                <p className="mt-5 text-sm font-semibold text-slate-800">
                  {target > 0
                    ? money(data?.target.achieved) + " of " + money(target)
                    : "Set a monthly sales target"}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {data
                    ? data.month +
                      " | BDT net sales" +
                      (target > 0
                        ? ""
                        : canEditTarget
                          ? " | Click target icon to set"
                          : " | Target not set")
                    : "Loading monthly target..."}
                </p>
              </>
            )}
          </div>
        </Card>

        <Card
          title="Top categories"
          className="xl:col-span-3"
          action={
            <Link
              href="/categories"
              className="text-xs font-semibold text-indigo-600 hover:underline"
            >
              See all
            </Link>
          }
        >
          <div className="flex min-h-52 flex-col items-center justify-center gap-4 text-center">
            <div
              className="flex h-32 w-32 items-center justify-center rounded-full border-[12px] border-slate-100"
              style={
                categoryTotal > 0
                  ? {
                      border: "none",
                      background: "conic-gradient(" + categoryGradient + ")",
                    }
                  : undefined
              }
            >
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white">
                <FolderTree size={27} className="text-slate-300" />
              </div>
            </div>
            {categoryTotal > 0 ? (
              <div className="w-full space-y-2">
                {data?.categories.map((category, i) => (
                  <div
                    key={category.name + i}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-slate-500">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: colors[i] }}
                      />
                      <span className="truncate">{category.name}</span>
                    </span>
                    <span
                      className="font-semibold text-slate-700"
                      title={money(category.amount)}
                    >
                      {(
                        (Math.max(0, Number(category.amount)) / categoryTotal) *
                        100
                      ).toFixed(0)}
                      %
                    </span>
                  </div>
                ))}
                <p className="text-[10px] text-slate-400">
                  This month | share of top category net sales
                </p>
              </div>
            ) : (
              <EmptyMetric
                label={
                  data
                    ? "No category sales this month"
                    : "Loading categories..."
                }
              />
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <Card
          title="Customer activity"
          className="xl:col-span-3"
          action={<Users size={18} className="text-slate-400" />}
        >
          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-500">Active customers</p>
              <p className="mt-1 text-3xl font-extrabold text-slate-900">
                {number(data?.customers.active)}
              </p>
              <EmptyMetric label="Customers with orders in the last 30 days" />
            </div>
            <div className="space-y-3 border-t border-slate-100 pt-4">
              {[
                "New customers",
                "Returning customers",
                "Repeat purchase rate",
              ].map((label, index) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="text-slate-500">{label}</span>
                  <span className="font-bold text-slate-700">
                    {index === 0
                      ? number(data?.customers.new)
                      : index === 1
                        ? number(data?.customers.returning)
                        : data
                          ? data.customers.repeatRate.toFixed(1) + "%"
                          : number(undefined)}
                  </span>
                </div>
              ))}
            </div>
            <Link
              href="/customers"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600"
            >
              View customers <ChevronRight size={14} />
            </Link>
          </div>
        </Card>

        <Card
          title="Conversion funnel"
          className="xl:col-span-6"
          action={
            <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
              This month
            </span>
          }
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: "Product views",
                value: data?.funnel.productViews,
                icon: MousePointer2,
              },
              {
                label: "Added to cart",
                value: data?.funnel.addedToCart,
                icon: ShoppingCart,
              },
              {
                label: "Checkout",
                value: data?.funnel.checkout,
                icon: CreditCard,
              },
              {
                label: "Purchases",
                value: data?.funnel.purchases,
                icon: ShoppingBag,
              },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl bg-slate-50 p-3">
                <Icon size={17} className="text-indigo-500" />
                <p className="mt-3 text-xs text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {number(value)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex min-h-24 items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 text-center">
            <EmptyMetric label="Browsing steps count tracked sessions; purchases count non-cancelled BDT orders. Tracking starts after deployment." />
          </div>
        </Card>

        <Card
          title="Traffic sources"
          className="xl:col-span-3"
          action={<TrendingUp size={18} className="text-slate-400" />}
        >
          <div
            className="mb-5 flex h-8 gap-1 overflow-hidden rounded-lg bg-slate-100"
            aria-label="Traffic source distribution"
          >
            {data?.sources.map(
              (source, i) =>
                source.count > 0 && (
                  <div
                    key={source.source}
                    title={source.source + ": " + source.count + " sessions"}
                    style={{
                      background: colors[i],
                      width: (source.count / sourceTotal) * 100 + "%",
                    }}
                  />
                ),
            )}
          </div>
          <div className="space-y-3">
            {[
              "Direct traffic",
              "Organic search",
              "Social media",
              "Referrals",
              "Email campaigns",
            ].map((label, index) => (
              <div
                key={label}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="text-slate-500">{label}</span>
                <span className="font-bold text-slate-700">
                  {data
                    ? sourceTotal
                      ? (
                          (data.sources[index].count / sourceTotal) *
                          100
                        ).toFixed(1) + "%"
                      : "0%"
                    : number(undefined)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-5">
            <EmptyMetric
              label={
                data
                  ? number(sourceTotal) + " tracked sessions this month"
                  : "Loading traffic sources..."
              }
            />
          </div>
        </Card>
      </div>

      <Card
        title="Quick access"
        action={<CircleHelp size={18} className="text-slate-400" />}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickLinks.map(({ label, href, icon: Icon }) => (
            <Link
              href={href}
              key={href}
              className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-indigo-300 hover:bg-indigo-50/40"
            >
              <span className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                <Icon size={18} />
              </span>
              <span className="flex-1 text-sm font-semibold text-slate-700">
                {label}
              </span>
              <ChevronRight size={15} className="text-slate-400" />
            </Link>
          ))}
        </div>
      </Card>
    </main>
  );
}
