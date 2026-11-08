"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Boxes,
  Building2,
  Calendar,
  CheckCircle2,
  FileText,
  Loader2,
  Package,
  RefreshCw,
  Search,
  User,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

const API = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
).replace(/\/$/, "");
const ROOT = API.endsWith("/api/v1") ? API : `${API}/api/v1`;

type GoodsReceipt = {
  id: string;
  receiptNumber: string;
  purchaseOrderId: string;
  receivedAt: string;
  receivedBy?: string | null;
  notes?: string | null;
  purchaseOrder: {
    id: string;
    poNumber: string;
    supplier: { id: string; name: string };
  };
  items: Array<{
    id: string;
    productId: string;
    variantId?: string | null;
    quantityReceived: number;
    unitCost: string | number;
  }>;
};

export default function GoodsReceiptsPage() {
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReceipts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(`${ROOT}/purchasing/receipts?limit=50`);
      if (res.ok) {
        const d = await res.json();
        setReceipts(d.items || []);
      }
    } catch (err) {
      console.error("Failed to load receipts", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReceipts();
  }, [loadReceipts]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/purchasing"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft size={14} /> Back to Purchasing
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Goods Receipts History (GRN)
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Log of all warehouse shipments received from suppliers and stocked into inventory.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadReceipts()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-[#121A30] dark:text-slate-200"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Receipts Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-white/10 dark:bg-[#121A30]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">GRN Number</th>
                <th className="px-4 py-3">Purchase Order</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3 text-center">Items Received</th>
                <th className="px-4 py-3">Received By</th>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {loading && receipts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 size={24} className="mx-auto animate-spin mb-2 text-indigo-500" />
                    Loading goods receipts...
                  </td>
                </tr>
              ) : receipts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="mx-auto max-w-sm text-center">
                      <Boxes size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        No goods receipts recorded yet
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        When an ordered shipment arrives from your supplier, open the Purchase Order and click "Receive Goods".
                      </p>
                      <Link
                        href="/purchasing"
                        className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white"
                      >
                        View Purchase Orders
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                receipts.map((grn) => {
                  const totalQty = grn.items.reduce(
                    (sum, i) => sum + i.quantityReceived,
                    0,
                  );

                  return (
                    <tr key={grn.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                      <td className="px-4 py-3.5 font-bold text-indigo-600 dark:text-indigo-400">
                        {grn.receiptNumber}
                      </td>
                      <td className="px-4 py-3.5 font-semibold">
                        <Link
                          href={`/purchasing/${grn.purchaseOrderId}`}
                          className="text-slate-900 hover:underline dark:text-slate-100"
                        >
                          {grn.purchaseOrder.poNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300">
                        {grn.purchaseOrder.supplier.name}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                          <CheckCircle2 size={11} /> +{totalQty} units
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">
                        {grn.receivedBy || "Staff"}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">
                        {new Date(grn.receivedAt).toLocaleString("en-BD")}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 italic max-w-xs truncate">
                        {grn.notes || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
