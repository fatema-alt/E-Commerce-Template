"use client";
import { useToastState } from "@/components/admin/toast-provider";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { OrdersReports } from "./orders-reports";

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
  grandTotal: string | number;
  createdAt: string;
};
export type OrderDetail = OrderRow & {
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
    metadata?: { kind?: string; verification?: string; fee?: string };
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
    PENDING: "bg-amber-50 text-amber-700",
    CONFIRMED: "bg-blue-50 text-blue-700",
    PROCESSING: "bg-violet-50 text-violet-700",
    SHIPPED: "bg-indigo-50 text-indigo-700",
    DELIVERED: "bg-emerald-50 text-emerald-700",
    PAID: "bg-emerald-50 text-emerald-700",
    CANCELLED: "bg-rose-50 text-rose-700",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[status] ?? "bg-slate-100 text-slate-700"}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}
export default function OrdersClient() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState("newest");
  const [items, setItems] = useState<OrderRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [refreshing, setLoading] = useState(false);
  const [loadedKey, setLoadedKey] = useState("");
  const [, setError] = useToastState("error");
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
  }, [page, status, search, paymentStatus, paymentMethod, from, to, sort, setError, filterKey]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
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
      <OrdersReports
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

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
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
          <tbody className="divide-y">
            {items.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td className="px-5 py-4 font-semibold text-slate-900">
                  {o.orderNumber}
                </td>
                <td className="px-5 py-4">
                  <div>{o.customerName}</div>
                  <div className="text-xs text-slate-500">
                    {o.customerPhone}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <StatusPill status={o.status} />
                </td>
                <td className="px-5 py-4">
                  <StatusPill status={o.paymentStatus} />
                </td>
                <td className="px-5 py-4 font-medium">
                  {formatMoney(o.grandTotal)}
                </td>
                <td className="px-5 py-4 text-slate-500">
                  {formatDate(o.createdAt)}
                </td>
                <td className="px-5 py-4">
                  <Link
                    className="font-semibold text-indigo-700 hover:underline"
                    href={`/orders/${o.id}`}
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 && (
          <p className="p-10 text-center text-slate-500">No orders found.</p>
        )}
        {loading && (
          <p className="p-8 text-center text-slate-500">Loading orders…</p>
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
