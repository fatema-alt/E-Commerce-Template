"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Boxes,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FilePlus,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Truck,
  Users,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

const API = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
).replace(/\/$/, "");
const ROOT = API.endsWith("/api/v1") ? API : `${API}/api/v1`;

type PurchaseOrder = {
  id: string;
  poNumber: string;
  status: "DRAFT" | "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID";
  currency: string;
  subtotal: string | number;
  shippingCost: string | number;
  tax: string | number;
  totalAmount: string | number;
  paidAmount: string | number;
  expectedDeliveryDate?: string | null;
  orderedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  supplier: { id: string; name: string; phone?: string | null };
  _count: { items: number; goodsReceipts: number };
};

type Summary = {
  activeSuppliers: number;
  openOrders: number;
  receivedOrders: number;
  totalReceipts: number;
};

export default function PurchasingPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [supplierFilter, setSupplierFilter] = useState("ALL");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (statusFilter !== "ALL") query.set("status", statusFilter);
      if (supplierFilter !== "ALL") query.set("supplierId", supplierFilter);
      if (search.trim()) query.set("q", search.trim());

      const [ordersRes, summaryRes, suppliersRes] = await Promise.all([
        authenticatedFetch(`${ROOT}/purchasing/orders?${query.toString()}`),
        authenticatedFetch(`${ROOT}/purchasing/summary`),
        authenticatedFetch(`${ROOT}/purchasing/suppliers?limit=100`),
      ]);

      if (ordersRes.ok) {
        const d = await ordersRes.json();
        setOrders(d.items || []);
      }
      if (summaryRes.ok) {
        setSummary(await summaryRes.json());
      }
      if (suppliersRes.ok) {
        const s = await suppliersRes.json();
        setSuppliers(s.items || []);
      }
    } catch (err) {
      console.error("Failed to load purchasing data", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, supplierFilter, search]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const formatBDT = (amount: number | string) => {
    return new Intl.NumberFormat("en-BD", {
      style: "currency",
      currency: "BDT",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  };

  const getStatusBadge = (status: PurchaseOrder["status"]) => {
    switch (status) {
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <Clock size={12} /> Draft
          </span>
        );
      case "ORDERED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
            <Truck size={12} /> Ordered
          </span>
        );
      case "PARTIALLY_RECEIVED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <Boxes size={12} /> Partial Received
          </span>
        );
      case "RECEIVED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 size={12} /> Fully Received
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
            Cancelled
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  const getPaymentBadge = (status: PurchaseOrder["paymentStatus"]) => {
    switch (status) {
      case "PAID":
        return (
          <span className="inline-flex rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            Paid
          </span>
        );
      case "PARTIALLY_PAID":
        return (
          <span className="inline-flex rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
            Partially Paid
          </span>
        );
      case "UNPAID":
        return (
          <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            Unpaid
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Purchasing & Suppliers
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage suppliers, purchase orders, and record warehouse goods receipts to update stock.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/purchasing/suppliers"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-[#121A30] dark:text-slate-200 dark:hover:bg-white/5"
          >
            <Users size={15} />
            Suppliers
          </Link>
          <Link
            href="/purchasing/receipts"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-[#121A30] dark:text-slate-200 dark:hover:bg-white/5"
          >
            <Boxes size={15} />
            Goods Receipts
          </Link>
          <Link
            href="/purchasing/new"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            <Plus size={15} />
            New Purchase Order
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-xs dark:border-white/10 dark:bg-[#121A30]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Suppliers
            </span>
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Building2 size={16} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {summary?.activeSuppliers ?? "—"}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-xs dark:border-white/10 dark:bg-[#121A30]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Open Orders
            </span>
            <div className="rounded-xl bg-amber-50 p-2 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <Truck size={16} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {summary?.openOrders ?? "—"}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-xs dark:border-white/10 dark:bg-[#121A30]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Received Orders
            </span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {summary?.receivedOrders ?? "—"}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-xs dark:border-white/10 dark:bg-[#121A30]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Receipts
            </span>
            <div className="rounded-xl bg-sky-50 p-2 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
              <Boxes size={16} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {summary?.totalReceipts ?? "—"}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-white/10 dark:bg-[#121A30] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search by PO #, supplier, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-1.5 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            />
          </div>

          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          >
            <option value="ALL">All Suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-1">
          {["ALL", "DRAFT", "ORDERED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"].map(
            (st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  statusFilter === st
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
                }`}
              >
                {st === "ALL"
                  ? "All"
                  : st === "PARTIALLY_RECEIVED"
                    ? "Partial"
                    : st.charAt(0) + st.slice(1).toLowerCase()}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => void loadData()}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Purchase Orders Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-white/10 dark:bg-[#121A30]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">PO Number</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3 text-right">Total Amount</th>
                <th className="px-4 py-3">Created / Ordered</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-slate-700 dark:text-slate-300">
              {loading && orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Loader2 size={24} className="mx-auto animate-spin mb-2 text-indigo-500" />
                    Loading purchase orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <div className="mx-auto max-w-sm text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-400">
                        <FilePlus size={24} />
                      </div>
                      <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        No purchase orders found
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Create your first purchase order to purchase stock from suppliers.
                      </p>
                      <div className="mt-4">
                        <Link
                          href="/purchasing/new"
                          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500"
                        >
                          <Plus size={14} /> Create Purchase Order
                        </Link>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((po) => (
                  <tr
                    key={po.id}
                    className="transition hover:bg-slate-50/80 dark:hover:bg-white/5"
                  >
                    <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                      <Link
                        href={`/purchasing/${po.id}`}
                        className="text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        {po.poNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {po.supplier.name}
                      </div>
                      {po.supplier.phone && (
                        <div className="text-[11px] text-slate-400">{po.supplier.phone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">{getStatusBadge(po.status)}</td>
                    <td className="px-4 py-3.5">{getPaymentBadge(po.paymentStatus)}</td>
                    <td className="px-4 py-3.5">
                      <span className="font-semibold">{po._count.items}</span>{" "}
                      <span className="text-slate-400">
                        ({po._count.goodsReceipts} receipts)
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-slate-900 dark:text-slate-100">
                      {formatBDT(po.totalAmount)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">
                      <div>{new Date(po.createdAt).toLocaleDateString("en-BD")}</div>
                      {po.expectedDeliveryDate && (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                          <Calendar size={10} /> Exp:{" "}
                          {new Date(po.expectedDeliveryDate).toLocaleDateString("en-BD")}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/purchasing/${po.id}`}
                        className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                      >
                        Details →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
