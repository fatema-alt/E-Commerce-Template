"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Boxes,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Truck,
  X,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

const API = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
).replace(/\/$/, "");
const ROOT = API.endsWith("/api/v1") ? API : `${API}/api/v1`;

type PurchaseOrderItem = {
  id: string;
  productId: string;
  variantId?: string | null;
  sku: string;
  productName: string;
  variantName?: string | null;
  orderedQuantity: number;
  receivedQuantity: number;
  unitCost: string | number;
  totalCost: string | number;
  product?: { name: string; sku: string };
  variant?: { name: string; sku: string };
};

type GoodsReceipt = {
  id: string;
  receiptNumber: string;
  receivedAt: string;
  receivedBy?: string | null;
  notes?: string | null;
  items: Array<{
    id: string;
    purchaseOrderItemId: string;
    quantityReceived: number;
    unitCost: string | number;
  }>;
};

type PurchaseOrderDetail = {
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
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  supplier: {
    id: string;
    name: string;
    contactName?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    taxId?: string | null;
    paymentTerms?: string | null;
    notes?: string | null;
  };
  items: PurchaseOrderItem[];
  goodsReceipts: GoodsReceipt[];
};

export default function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [order, setOrder] = useState<PurchaseOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Receive Goods Modal state
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, number>>({});
  const [receivedBy, setReceivedBy] = useState("Warehouse Staff");
  const [receiptNotes, setReceiptNotes] = useState("");
  const [receiveError, setReceiveError] = useState("");

  // Payment update modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [newPaymentStatus, setNewPaymentStatus] = useState<"UNPAID" | "PARTIALLY_PAID" | "PAID">("PAID");
  const [paidAmount, setPaidAmount] = useState<number>(0);

  const loadOrder = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(`${ROOT}/purchasing/orders/${encodeURIComponent(id)}`);
      if (!res.ok) {
        throw new Error("Failed to load purchase order");
      }
      const data = await res.json();
      setOrder(data);
      setPaidAmount(Number(data.paidAmount || 0));
      setNewPaymentStatus(data.paymentStatus);
    } catch (err: any) {
      setError(err.message || "Could not load order");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const handleStatusChange = async (newStatus: "ORDERED" | "CANCELLED") => {
    if (!window.confirm(`Are you sure you want to change order status to ${newStatus}?`)) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await authenticatedFetch(`${ROOT}/purchasing/orders/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to update status");
      }

      await loadOrder();
    } catch (err: any) {
      alert(err.message || "Failed to change status");
    } finally {
      setActionLoading(false);
    }
  };

  const openReceiveModal = () => {
    if (!order) return;
    const initialQty: Record<string, number> = {};
    order.items.forEach((item) => {
      const remaining = Math.max(0, item.orderedQuantity - item.receivedQuantity);
      initialQty[item.id] = remaining;
    });
    setReceiveQuantities(initialQty);
    setReceiveError("");
    setReceiveModalOpen(true);
  };

  const handleReceiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReceiveError("");

    const itemsToReceive = Object.entries(receiveQuantities)
      .filter(([_, qty]) => Number(qty) > 0)
      .map(([itemId, qty]) => ({
        purchaseOrderItemId: itemId,
        quantityReceived: Number(qty),
      }));

    if (itemsToReceive.length === 0) {
      setReceiveError("Please enter quantity to receive for at least one item.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await authenticatedFetch(`${ROOT}/purchasing/orders/${id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: itemsToReceive,
          receivedBy: receivedBy.trim() || undefined,
          notes: receiptNotes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to receive goods");
      }

      setReceiveModalOpen(false);
      await loadOrder();
    } catch (err: any) {
      setReceiveError(err.message || "Failed to record receipt");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await authenticatedFetch(`${ROOT}/purchasing/orders/${id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentStatus: newPaymentStatus,
          paidAmount: Number(paidAmount),
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to update payment");
      }

      setPaymentModalOpen(false);
      await loadOrder();
    } catch (err: any) {
      alert(err.message || "Failed to update payment");
    } finally {
      setActionLoading(false);
    }
  };

  const formatBDT = (amount: number | string) =>
    new Intl.NumberFormat("en-BD", {
      style: "currency",
      currency: "BDT",
    }).format(Number(amount || 0));

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-900/40 dark:bg-rose-950/20">
        <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">
          {error || "Order not found"}
        </p>
        <Link
          href="/purchasing"
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-1.5 text-xs text-white"
        >
          <ArrowLeft size={13} /> Back to Purchase Orders
        </Link>
      </div>
    );
  }

  const isReceivable =
    order.status === "ORDERED" || order.status === "PARTIALLY_RECEIVED";
  const allReceived = order.status === "RECEIVED";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Back link */}
      <div>
        <Link
          href="/purchasing"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft size={14} /> Back to Purchase Orders
        </Link>
      </div>

      {/* Hero Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#121A30] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {order.poNumber}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                order.status === "RECEIVED"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400"
                  : order.status === "PARTIALLY_RECEIVED"
                    ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-400"
                    : order.status === "ORDERED"
                      ? "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-400"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {order.status.replace("_", " ")}
            </span>
            <span
              className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                order.paymentStatus === "PAID"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : order.paymentStatus === "PARTIALLY_PAID"
                    ? "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              Payment: {order.paymentStatus.replace("_", " ")}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Created on {new Date(order.createdAt).toLocaleString("en-BD")}
            {order.orderedAt && (
              <> · Ordered on {new Date(order.orderedAt).toLocaleString("en-BD")}</>
            )}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {order.status === "DRAFT" && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => handleStatusChange("ORDERED")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500"
            >
              <Truck size={14} /> Mark as ORDERED
            </button>
          )}

          {isReceivable && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={openReceiveModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500"
            >
              <Boxes size={15} /> Receive Goods
            </button>
          )}

          <button
            type="button"
            onClick={() => setPaymentModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          >
            <DollarSign size={14} /> Update Payment
          </button>

          {["DRAFT", "ORDERED"].includes(order.status) && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => handleStatusChange("CANCELLED")}
              className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400"
            >
              Cancel PO
            </button>
          )}
        </div>
      </div>

      {/* Supplier & Delivery Summary Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-xs dark:border-white/10 dark:bg-[#121A30]">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2.5">
            <Building2 size={14} className="text-indigo-500" /> Supplier Information
          </h3>
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {order.supplier.name}
          </div>
          {order.supplier.contactName && (
            <div className="text-xs text-slate-500 mt-1">
              Contact: {order.supplier.contactName}
            </div>
          )}
          {order.supplier.phone && (
            <div className="text-xs text-slate-500">Phone: {order.supplier.phone}</div>
          )}
          {order.supplier.email && (
            <div className="text-xs text-slate-500">Email: {order.supplier.email}</div>
          )}
          {order.supplier.address && (
            <div className="text-xs text-slate-400 mt-1">
              Address: {order.supplier.address}, {order.supplier.city}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-xs dark:border-white/10 dark:bg-[#121A30]">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2.5">
            <Calendar size={14} className="text-indigo-500" /> Delivery Details
          </h3>
          <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
            <div>
              <span className="text-slate-400">Expected Delivery:</span>{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {order.expectedDeliveryDate
                  ? new Date(order.expectedDeliveryDate).toLocaleDateString("en-BD")
                  : "Not specified"}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Payment Terms:</span>{" "}
              <span>{order.supplier.paymentTerms || "Standard"}</span>
            </div>
            {order.notes && (
              <div className="mt-2 text-xs italic text-slate-500 bg-slate-50 p-2 rounded-lg dark:bg-white/5">
                "{order.notes}"
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-xs dark:border-white/10 dark:bg-[#121A30]">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2.5">
            <DollarSign size={14} className="text-indigo-500" /> Financial Summary
          </h3>
          <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex justify-between">
              <span>Items Subtotal:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {formatBDT(order.subtotal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Shipping / Freight:</span>
              <span>{formatBDT(order.shippingCost)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax / Duty:</span>
              <span>{formatBDT(order.tax)}</span>
            </div>
            <div className="border-t border-slate-200 dark:border-white/10 pt-1.5 flex justify-between font-bold text-slate-900 dark:text-slate-100">
              <span>Total Cost:</span>
              <span className="text-indigo-600 dark:text-indigo-400">
                {formatBDT(order.totalAmount)}
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>Paid So Far:</span>
              <span>{formatBDT(order.paidAmount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#121A30] space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Package size={16} className="text-indigo-500" /> Ordered Items & Receiving Progress
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2.5">Product & SKU</th>
                <th className="px-4 py-2.5 text-right">Unit Cost</th>
                <th className="px-4 py-2.5 text-center">Ordered</th>
                <th className="px-4 py-2.5 text-center">Received</th>
                <th className="px-4 py-2.5 text-center">Remaining</th>
                <th className="px-4 py-2.5">Progress</th>
                <th className="px-4 py-2.5 text-right">Total Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {order.items.map((item) => {
                const remaining = item.orderedQuantity - item.receivedQuantity;
                const progressPct = Math.min(
                  100,
                  Math.round((item.receivedQuantity / item.orderedQuantity) * 100),
                );

                return (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {item.productName}
                      </div>
                      {item.variantName && (
                        <div className="text-[11px] text-indigo-600 dark:text-indigo-400">
                          Variant: {item.variantName}
                        </div>
                      )}
                      <div className="text-[11px] text-slate-400 font-mono">
                        SKU: {item.sku}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatBDT(item.unitCost)}
                    </td>
                    <td className="px-4 py-3 text-center font-bold">
                      {item.orderedQuantity}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                      {item.receivedQuantity}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-amber-600 dark:text-amber-400">
                      {remaining}
                    </td>
                    <td className="px-4 py-3 w-36">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              progressPct === 100
                                ? "bg-emerald-500"
                                : progressPct > 0
                                  ? "bg-amber-500"
                                  : "bg-slate-300"
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500">
                          {progressPct}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-slate-100">
                      {formatBDT(item.totalCost)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Goods Receipts Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#121A30] space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Boxes size={16} className="text-indigo-500" /> Recorded Goods Receipts (GRN)
          </h2>
          {isReceivable && (
            <button
              type="button"
              onClick={openReceiveModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500"
            >
              <Plus size={14} /> Receive Items
            </button>
          )}
        </div>

        {order.goodsReceipts.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400 italic">
            No goods receipts recorded yet. Click "Receive Goods" when physical inventory arrives from supplier.
          </p>
        ) : (
          <div className="space-y-3">
            {order.goodsReceipts.map((grn) => {
              const totalItemsReceived = grn.items.reduce(
                (sum, i) => sum + i.quantityReceived,
                0,
              );

              return (
                <div
                  key={grn.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-white/5 dark:bg-white/5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-indigo-600 dark:text-indigo-400">
                        {grn.receiptNumber}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Received on {new Date(grn.receivedAt).toLocaleString("en-BD")}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300">
                      Receiver: <span className="font-semibold">{grn.receivedBy || "Staff"}</span>
                    </div>
                  </div>

                  {grn.notes && (
                    <p className="mt-2 text-xs italic text-slate-500">
                      Note: {grn.notes}
                    </p>
                  )}

                  <div className="mt-2.5 text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Stock added to inventory:
                    </span>{" "}
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      +{totalItemsReceived} units total
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Receive Goods Modal */}
      {receiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#121A30]">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Boxes size={18} className="text-emerald-600" />
                Receive Goods & Restock Warehouse
              </h3>
              <button
                type="button"
                onClick={() => setReceiveModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReceiveSubmit} className="mt-4 space-y-4">
              {receiveError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  {receiveError}
                </div>
              )}

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Enter the verified received quantities. Submitting will automatically increment stock in the warehouse inventory and record an inventory movement.
              </p>

              <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
                {order.items.map((item) => {
                  const remaining = item.orderedQuantity - item.receivedQuantity;
                  if (remaining <= 0) return null;

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5"
                    >
                      <div>
                        <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {item.productName}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          SKU: {item.sku} · Remaining to receive:{" "}
                          <span className="font-bold text-amber-600 dark:text-amber-400">
                            {remaining}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500">Received:</label>
                        <input
                          type="number"
                          min="0"
                          max={remaining}
                          value={receiveQuantities[item.id] ?? 0}
                          onChange={(e) =>
                            setReceiveQuantities({
                              ...receiveQuantities,
                              [item.id]: Math.min(
                                remaining,
                                Math.max(0, parseInt(e.target.value) || 0),
                              ),
                            })
                          }
                          className="w-20 rounded-lg border border-slate-300 bg-white p-1.5 text-center text-xs font-bold text-slate-900 dark:border-white/10 dark:bg-[#121A30] dark:text-slate-100"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Received By (Inspector / Staff)
                  </label>
                  <input
                    type="text"
                    value={receivedBy}
                    onChange={(e) => setReceivedBy(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs dark:border-white/10 dark:bg-white/5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Receipt Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Verified carton seal, intact packaging"
                    value={receiptNotes}
                    onChange={(e) => setReceiptNotes(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs dark:border-white/10 dark:bg-white/5"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setReceiveModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 disabled:opacity-50"
                >
                  {actionLoading && <Loader2 size={14} className="animate-spin" />}
                  Confirm Receipt & Increment Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Update Modal */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#121A30]">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <DollarSign size={16} className="text-indigo-500" />
                Update Payment Status
              </h3>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Status
                </label>
                <select
                  value={newPaymentStatus}
                  onChange={(e) => setNewPaymentStatus(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs dark:border-white/10 dark:bg-white/5"
                >
                  <option value="UNPAID">UNPAID</option>
                  <option value="PARTIALLY_PAID">PARTIALLY_PAID</option>
                  <option value="PAID">PAID</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Amount Paid (BDT)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs dark:border-white/10 dark:bg-white/5"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Total PO amount: {formatBDT(order.totalAmount)}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-white/10 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500"
                >
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
