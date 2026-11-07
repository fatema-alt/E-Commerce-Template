"use client";
import { useToastState } from "@/components/admin/toast-provider";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { OrderQuickActions } from "./order-quick-actions";
import { OrdersReports } from "./orders-reports";
import { NotificationHighlightBanner } from "@/components/admin/notification-highlight-banner";

const API = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
).replace(/\/$/, "");
const ROOT = API.endsWith("/api/v1") ? API : `${API}/api/v1`;
export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURN_REQUESTED"
  | "RETURN_APPROVED"
  | "RETURNED";
export type OrderRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  status: OrderStatus;
  paymentStatus: string;
  manualPayments?: Array<{ status: string }>;
  grandTotal: string | number;
  createdAt: string;
  version?: number;
};
export type OrderDetail = Omit<OrderRow, "manualPayments"> & {
  updatedAt?: string;
  source?: string | null;
  campaign?: unknown;
  outstandingBalance?: string;
  amountDueNow?: string;
  customerHistory?: {
    total: number;
    delivered: number;
    cancelled: number;
    returned: number;
  };
  idempotencyKeys?: Array<{
    id: string;
    key: string;
    operation: string;
    createdAt: string;
  }>;
  paymentPlan?: string | null;
  couponDiscount?: string;
  prepaidDiscount?: string;
  manualPayments?: Array<{
    id: string;
    status: string;
    methodSnapshot: {
      name: string;
      type: string;
      details: Record<string, string>;
    };
    amountDueNow: string;
    amountDueOnDelivery: string;
    senderInfo: string;
    reference: string;
    rejectReason?: string;
    verifiedBy?: string;
    verifiedAt?: string;
    createdAt?: string;
  }>;

  version: number;
  refundedTotal: string;
  refundableBalance: string;
  returns: Array<{
    id: string;
    status: string;
    reason: string;
    adminNote?: string;
    createdAt: string;
    items: Array<{
      orderItemId: string;
      quantity: number;
      receivedQuantity: number;
      sellableQuantity: number;
      restockedQuantity: number;
      refundableAmount: string;
    }>;
  }>;
  customerEmail?: string | null;
  paymentMethod: string;
  paymentOption?: string | null;
  amountDueOnDelivery?: string | number;
  customerNote?: string | null;
  subtotal: string | number;
  shippingTotal: string | number;
  discountTotal: string | number;
  taxTotal: string | number;
  paidTotal: string | number;
  items: Array<{
    id: string;
    nameSnapshot: string;
    skuSnapshot: string;
    quantity: number;
    unitPrice: string | number;
    lineTotal: string | number;
    product?: {
      slug: string;
      category?: { name: string };
      images: Array<{ url: string; altText?: string | null }>;
    } | null;
  }>;
  addresses: Array<{
    id: string;
    type: string;
    recipientName: string;
    phone: string;
    line1: string;
    line2?: string | null;
    city: string;
    district?: string | null;
    division?: string | null;
    postalCode?: string | null;
  }>;
  notes: Array<{ id: string; body: string; createdAt: string }>;
  events: Array<{
    id: string;
    action: string;
    actorType: string;
    actorId?: string;
    before?: unknown;
    after?: unknown;
    createdAt: string;
  }>;
  shipments: Array<{
    id: string;
    provider?: string | null;
    trackingNumber?: string | null;
    status: string;
    shippingCost?: string;
    parcelWeightKg?: string;
    parcelDetails?: string;
    codCollected: string;
    codSettled: string;
    codFees: string;
  }>;
  payments: Array<{
    id: string;
    type: string;
    status: string;
    amount: string | number;
    provider: string;
    providerReference?: string;
    metadata?: {
      kind?: string;
      verification?: string;
      fee?: string;
      sender?: string;
      rejectionReason?: string;
      manualPaymentId?: string;
    };
    createdAt: string;
  }>;
};
export const formatMoney = (value: string | number | undefined) =>
  new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT" }).format(
    Number(value ?? 0),
  );
export const formatDate = (value: string) =>
  new Date(value).toLocaleString("en-BD", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dhaka",
  });
export const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  PENDING: "CONFIRMED",
  CONFIRMED: "PROCESSING",
  PROCESSING: "SHIPPED",
  SHIPPED: "DELIVERED",
};
export async function orderFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await authenticatedFetch(`${ROOT}${path}`, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const error = await response.json();
      message = Array.isArray(error.message)
        ? error.message.join(", ")
        : (error.message ?? message);
    } catch {}
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}
export function StatusPill({ status }: { status: string }) {
  const tones: Record<string, string> = {
    PENDING:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/40",
    CONFIRMED:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/40",
    PROCESSING:
      "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800/40",
    SHIPPED:
      "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/40",
    DELIVERED:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40",
    PAID: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40",
    CANCELLED:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/40",
    AWAITING_VERIFICATION:
      "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800/40",
    PAYMENT_REJECTED:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/40",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tones[status] ?? "bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10"}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

export function OrderStatusSelect({
  order,
  onStatusChange,
  onOpenManage,
}: {
  order: OrderRow;
  onStatusChange: (order: OrderRow, newStatus: string) => Promise<void>;
  onOpenManage: () => void;
}) {
  const [updating, setUpdating] = useState(false);

  const statusTones: Record<string, string> = {
    PENDING:
      "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700/60 focus:ring-amber-400",
    CONFIRMED:
      "bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-700/60 focus:ring-blue-400",
    PROCESSING:
      "bg-violet-50 text-violet-800 border-violet-300 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-700/60 focus:ring-violet-400",
    SHIPPED:
      "bg-indigo-50 text-indigo-800 border-indigo-300 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-700/60 focus:ring-indigo-400",
    DELIVERED:
      "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700/60 focus:ring-emerald-400",
    CANCELLED:
      "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-700/60 focus:ring-rose-400",
    RETURN_REQUESTED:
      "bg-orange-50 text-orange-800 border-orange-300 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-700/60 focus:ring-orange-400",
    RETURN_APPROVED:
      "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700/60 focus:ring-amber-400",
    RETURNED:
      "bg-slate-100 text-slate-800 border-slate-300 dark:bg-white/10 dark:text-slate-300 dark:border-white/15 focus:ring-slate-400",
  };

  const allowedTransitions: Partial<
    Record<OrderStatus, { value: OrderStatus; label: string }[]>
  > = {
    PENDING: [
      { value: "CONFIRMED", label: "→ Confirm Order" },
      { value: "CANCELLED", label: "✕ Cancel Order" },
    ],
    CONFIRMED: [
      { value: "PROCESSING", label: "→ Mark as Processing" },
      { value: "CANCELLED", label: "✕ Cancel Order" },
    ],
    PROCESSING: [
      { value: "SHIPPED", label: "→ Mark as Shipped" },
      { value: "CANCELLED", label: "✕ Cancel Order" },
    ],
    SHIPPED: [{ value: "DELIVERED", label: "→ Mark as Delivered" }],
  };

  const nextOptions = allowedTransitions[order.status] || [];
  const isTerminal =
    ["DELIVERED", "CANCELLED", "RETURNED"].includes(order.status) ||
    nextOptions.length === 0;

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "__MANAGE__") {
      onOpenManage();
      e.target.value = order.status;
      return;
    }
    if (!val || val === order.status) return;

    try {
      setUpdating(true);
      await onStatusChange(order, val);
    } finally {
      setUpdating(false);
    }
  };

  if (isTerminal) {
    return (
      <div className="inline-flex items-center">
        <StatusPill status={order.status} />
      </div>
    );
  }

  return (
    <div className="relative inline-flex items-center">
      <select
        value={order.status}
        disabled={updating}
        onChange={handleChange}
        aria-label={`Update status for order ${order.orderNumber}`}
        className={`appearance-none rounded-full border py-1 pl-3 pr-7 text-xs font-semibold cursor-pointer shadow-xs transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-[#121A30] disabled:cursor-wait disabled:opacity-70 ${
          statusTones[order.status] ??
          "bg-slate-100 text-slate-700 border-slate-300 dark:bg-white/10 dark:text-slate-300 dark:border-white/15"
        }`}
      >
        <option
          value={order.status}
          disabled
          className="bg-white text-slate-900 dark:bg-[#121A30] dark:text-slate-100 font-semibold"
        >
          {order.status.replaceAll("_", " ")}
        </option>
        {nextOptions.map((opt) => (
          <option
            key={opt.value}
            value={opt.value}
            className="bg-white text-slate-900 dark:bg-[#121A30] dark:text-slate-100 py-1"
          >
            {opt.label}
          </option>
        ))}
        <option
          value="__MANAGE__"
          className="bg-white text-indigo-600 dark:bg-[#121A30] dark:text-indigo-400 font-medium py-1"
        >
          ⋯ More details & note
        </option>
      </select>
      <span className="pointer-events-none absolute right-2 flex items-center">
        {updating ? (
          <Loader2 className="h-3 w-3 animate-spin text-current opacity-70" />
        ) : (
          <ChevronDown className="h-3 w-3 text-current opacity-60" />
        )}
      </span>
    </div>
  );
}
export default function OrdersClient({
  initialManageId = "",
}: {
  initialManageId?: string;
}) {
  const searchParams = useSearchParams();
  const highlightParam = searchParams?.get("highlight") ?? "";
  const initialStatusParam = searchParams?.get("status") ?? "";
  const initialPaymentParam = searchParams?.get("paymentStatus") ?? "";

  const [manage, setManage] = useState<{
    id: string;
    tab: "status" | "payment";
  } | null>(initialManageId ? { id: initialManageId, tab: "payment" } : null);
  const [reportRevision, setReportRevision] = useState(0);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState(initialPaymentParam);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState("newest");
  const [items, setItems] = useState<OrderRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState(initialStatusParam);
  const [refreshing, setLoading] = useState(false);
  const [loadedKey, setLoadedKey] = useState("");
  const [, setError] = useToastState("error");
  const [, setSuccess] = useToastState("success");
  const limit = 20;
  const filterKey = JSON.stringify({
    page,
    status,
    search,
    paymentStatus,
    paymentMethod,
    from,
    to,
    sort,
  });
  const loading = refreshing || loadedKey !== filterKey;
  const loadSequence = useRef(0);
  const load = useCallback(() => {
    const sequence = ++loadSequence.current;
    return orderFetch<{ items: OrderRow[]; total: number }>(
      `/orders?${new URLSearchParams({ page: String(page), limit: String(limit), ...(status ? { status } : {}), ...(search ? { q: search } : {}), ...(paymentStatus ? { paymentStatus } : {}), ...(paymentMethod ? { paymentMethod } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), sort }).toString()}`,
    )
      .then((data) => {
        if (sequence !== loadSequence.current) return;
        setItems(data.items);
        setTotal(data.total);
        setError("");
      })
      .catch((e: unknown) => {
        if (sequence !== loadSequence.current) return;
        setError(e instanceof Error ? e.message : "Unable to load orders");
      })
      .finally(() => {
        if (sequence === loadSequence.current) {
          setLoading(false);
          setLoadedKey(filterKey);
        }
      });
  }, [
    page,
    status,
    search,
    paymentStatus,
    paymentMethod,
    from,
    to,
    sort,
    setError,
    filterKey,
  ]);
  useEffect(() => {
    void load();
  }, [load]);

  const handleStatusChange = async (order: OrderRow, newStatus: string) => {
    if (newStatus === order.status) return;

    if (newStatus === "CANCELLED") {
      const confirmed = window.confirm(
        `Are you sure you want to cancel order ${order.orderNumber}? Reserved stock will be released.`,
      );
      if (!confirmed) return;
    }

    let currentVersion = order.version;
    if (typeof currentVersion !== "number") {
      try {
        const fresh = await orderFetch<OrderDetail>(
          `/orders/${encodeURIComponent(order.id)}`,
        );
        currentVersion = fresh.version;
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Unable to fetch order details",
        );
        return;
      }
    }

    const key = crypto.randomUUID();

    try {
      if (newStatus === "CANCELLED") {
        await orderFetch(`/orders/${encodeURIComponent(order.id)}/cancel`, {
          method: "POST",
          body: JSON.stringify({ version: currentVersion }),
          headers: { "Idempotency-Key": key },
        });
      } else {
        await orderFetch(`/orders/${encodeURIComponent(order.id)}/status`, {
          method: "PATCH",
          body: JSON.stringify({
            status: newStatus,
            version: currentVersion,
          }),
          headers: { "Idempotency-Key": key },
        });
      }

      setSuccess(
        `Order ${order.orderNumber} updated to ${newStatus.replaceAll("_", " ")}`,
      );

      setItems((prev) =>
        prev.map((item) =>
          item.id === order.id
            ? {
                ...item,
                status: newStatus as OrderStatus,
                version: (currentVersion ?? 0) + 1,
              }
            : item,
        ),
      );

      void load();
      setReportRevision((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update status");
      void load();
    }
  };

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
      <NotificationHighlightBanner />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Orders
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage storefront orders and fulfillment
          </p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <label htmlFor="order-status" className="mr-3 text-sm font-medium">
          Order status
        </label>
        <select
          id="order-status"
          className="rounded-lg border px-3 py-2 text-sm"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
        >
          <option value="">All statuses</option>
          {(
            [
              "PENDING",
              "CONFIRMED",
              "PROCESSING",
              "SHIPPED",
              "DELIVERED",
              "CANCELLED",
              "RETURN_REQUESTED",
              "RETURN_APPROVED",
              "RETURNED",
            ] as const
          ).map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(query.trim());
          }}
        >
          <input
            aria-label="Search orders"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={120}
            placeholder="Order #, customer, phone, email"
            className="min-w-[230px] flex-1 rounded-lg border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Search
          </button>
        </form>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-600">
            Payment status
            <select
              aria-label="Payment status"
              value={paymentStatus}
              onChange={(e) => {
                setPage(1);
                setPaymentStatus(e.target.value);
              }}
              className="mt-1 block rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {[
                "UNPAID",
                "PARTIALLY_PAID",
                "AWAITING_VERIFICATION",
                "PAID",
                "PARTIALLY_REFUNDED",
                "REFUNDED",
              ].map((x) => (
                <option key={x} value={x}>
                  {x.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Payment method
            <select
              aria-label="Payment method"
              value={paymentMethod}
              onChange={(e) => {
                setPage(1);
                setPaymentMethod(e.target.value);
              }}
              className="mt-1 block rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {["COD", "ONLINE", "BANK_TRANSFER", "MANUAL"].map((x) => (
                <option key={x} value={x}>
                  {x.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            From (Dhaka)
            <input
              aria-label="From date"
              type="date"
              value={from}
              onChange={(e) => {
                setPage(1);
                setFrom(e.target.value);
              }}
              className="mt-1 block rounded-lg border px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-slate-600">
            To (Dhaka)
            <input
              aria-label="To date"
              type="date"
              value={to}
              onChange={(e) => {
                setPage(1);
                setTo(e.target.value);
              }}
              className="mt-1 block rounded-lg border px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-slate-600">
            Sort
            <select
              aria-label="Sort orders"
              value={sort}
              onChange={(e) => {
                setPage(1);
                setSort(e.target.value);
              }}
              className="mt-1 block rounded-lg border px-3 py-2 text-sm"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="total_desc">Highest total</option>
              <option value="total_asc">Lowest total</option>
            </select>
          </label>
          <button
            className="rounded-lg border px-3 py-2 text-sm"
            onClick={() => {
              setQuery("");
              setSearch("");
              setStatus("");
              setPaymentStatus("");
              setPaymentMethod("");
              setFrom("");
              setTo("");
              setSort("newest");
              setPage(1);
            }}
          >
            Clear filters
          </button>
        </div>
        <p className="mt-3 text-sm text-slate-500">{total} matching orders</p>
      </div>
      <details className="rounded-xl border bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          Sales reports & summaries
        </summary>
        <OrdersReports
          key={reportRevision}
          filters={{
            ...(status ? { status } : {}),
            ...(search ? { q: search } : {}),
            ...(paymentStatus ? { paymentStatus } : {}),
            ...(paymentMethod ? { paymentMethod } : {}),
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
            sort,
          }}
        />
      </details>
      {manage && (
        <OrderQuickActions
          key={manage.id}
          id={manage.id}
          initialTab={manage.tab}
          onClose={() => setManage(null)}
          onUpdated={() => {
            void load();
            setReportRevision((value) => value + 1);
          }}
        />
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#121A30]">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-white/5 dark:text-slate-400">
            <tr>
              {[
                "Order",
                "Customer",
                "Status",
                "Payment",
                "Total",
                "Placed",
                "",
              ].map((h) => (
                <th key={h} className="px-5 py-4">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {items.map((o) => {
              const displayOrderNo =
                /^ORD-[a-f0-9]{8}-[a-f0-9-]{27}$/i.test(o.orderNumber)
                  ? `ORD-${o.id.slice(-8).toUpperCase()}`
                  : o.orderNumber;
              const isHighlighted =
                Boolean(highlightParam) &&
                (o.orderNumber
                  .toLowerCase()
                  .includes(highlightParam.toLowerCase()) ||
                  displayOrderNo
                    .toLowerCase()
                    .includes(highlightParam.toLowerCase()) ||
                  o.id.toLowerCase().includes(highlightParam.toLowerCase()));

              return (
                <tr
                  key={o.id}
                  data-highlight={displayOrderNo}
                  data-order-number={o.orderNumber}
                  className={`transition-all duration-300 ${
                    isHighlighted
                      ? "bg-indigo-50/90 dark:bg-indigo-950/60 ring-2 ring-indigo-500 ring-inset shadow-xs"
                      : "hover:bg-slate-50 dark:hover:bg-white/5"
                  }`}
                >
                  <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white">
                    <span title={o.orderNumber}>{displayOrderNo}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-medium text-slate-900 dark:text-white">
                      {o.customerName}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {o.customerPhone}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <OrderStatusSelect
                      order={o}
                      onStatusChange={handleStatusChange}
                      onOpenManage={() => setManage({ id: o.id, tab: "status" })}
                    />
                  </td>
                  <td className="px-5 py-4">
                    <div className="space-y-1.5">
                      <StatusPill
                        status={
                          o.manualPayments?.[0]?.status ===
                          "awaiting_verification"
                            ? "AWAITING_VERIFICATION"
                            : o.manualPayments?.[0]?.status === "rejected"
                              ? "PAYMENT_REJECTED"
                              : o.paymentStatus
                        }
                      />
                      <button
                        type="button"
                        className="block text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                        onClick={() => setManage({ id: o.id, tab: "payment" })}
                      >
                        Manage payment
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-medium text-slate-900 dark:text-white">
                    {formatMoney(o.grandTotal)}
                  </td>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                    {formatDate(o.createdAt)}
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      className="font-semibold text-indigo-700 hover:underline dark:text-indigo-400"
                      href={`/orders/${o.id}`}
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && items.length === 0 && (
          <p className="p-10 text-center text-slate-500 dark:text-slate-400">
            No orders found.
          </p>
        )}
        {loading && (
          <p className="p-8 text-center text-slate-500 dark:text-slate-400">
            Loading orders…
          </p>
        )}
      </div>
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          Page {page} of {Math.max(1, Math.ceil(total / limit))}
        </span>
        <div className="flex gap-2">
          <button
            className="rounded-lg border px-4 py-2 disabled:opacity-40"
            disabled={page === 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <button
            className="rounded-lg border px-4 py-2 disabled:opacity-40"
            disabled={page * limit >= total || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </main>
  );
}
