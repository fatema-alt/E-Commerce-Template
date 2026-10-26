"use client";

import { useCallback, useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import {
  Tag,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Trash2,
  Percent,
  Coins,
  Truck,
  Copy,
  Check,
  AlertCircle,
  X,
} from "lucide-react";

interface Coupon {
  id: string;
  code: string;
  description?: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING";
  value: string | number;
  minOrderAmount?: string | number | null;
  maxDiscountAmount?: string | number | null;
  usageLimit?: number | null;
  usageCount: number;
  perCustomerLimit: number;
  startsAt?: string | null;
  expiresAt?: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: {
    usages: number;
    orders: number;
  };
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export default function PromotionsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form State
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING">("PERCENTAGE");
  const [value, setValue] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("");
  const [maxDiscountAmount, setMaxDiscountAmount] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [perCustomerLimit, setPerCustomerLimit] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (statusFilter === "ACTIVE") params.set("isActive", "true");
      if (statusFilter === "INACTIVE") params.set("isActive", "false");

      const res = await authenticatedFetch(
        `${API_BASE}/promotions/coupons?${params.toString()}`,
      );
      if (!res.ok) throw new Error("Failed to load coupons");
      const data = await res.json();
      setCoupons(data.items || []);
    } catch (err) {
      showToast("error", (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchCoupons();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchCoupons]);

  const handleCopy = (couponCode: string) => {
    void navigator.clipboard.writeText(couponCode);
    setCopiedCode(couponCode);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleToggle = async (id: string) => {
    try {
      const res = await authenticatedFetch(
        `${API_BASE}/promotions/coupons/${id}/toggle`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error("Could not update coupon status");
      showToast("success", "Coupon status updated");
      void fetchCoupons();
    } catch (err) {
      showToast("error", (err as Error).message);
    }
  };

  const handleDelete = async (id: string, couponCode: string) => {
    if (!window.confirm(`Are you sure you want to delete or deactivate coupon "${couponCode}"?`)) {
      return;
    }
    try {
      const res = await authenticatedFetch(
        `${API_BASE}/promotions/coupons/${id}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Could not delete coupon");
      showToast("success", `Coupon "${couponCode}" removed`);
      void fetchCoupons();
    } catch (err) {
      showToast("error", (err as Error).message);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        code: code.trim().toUpperCase(),
        description: description.trim() || undefined,
        type,
        value: Number(value),
        minOrderAmount: minOrderAmount ? Number(minOrderAmount) : undefined,
        maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : undefined,
        usageLimit: usageLimit ? Number(usageLimit) : undefined,
        perCustomerLimit: Number(perCustomerLimit) || 1,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      };

      const res = await authenticatedFetch(`${API_BASE}/promotions/coupons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          Array.isArray(data.message) ? data.message.join(", ") : data.message || "Failed to create coupon",
        );
      }

      showToast("success", `Coupon "${payload.code}" created successfully!`);
      setIsModalOpen(false);
      // Reset form
      setCode("");
      setDescription("");
      setType("PERCENTAGE");
      setValue("");
      setMinOrderAmount("");
      setMaxDiscountAmount("");
      setUsageLimit("");
      setPerCustomerLimit("1");
      setExpiresAt("");
      void fetchCoupons();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const totalCoupons = coupons.length;
  const activeCoupons = coupons.filter((c) => c.isActive).length;
  const totalUsages = coupons.reduce((sum, c) => sum + (c.usageCount || 0), 0);

  return (
    <main className="space-y-6 pb-12">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all ${
            toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {toast.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-600">
            <Tag size={20} />
            <span className="text-xs font-bold uppercase tracking-wider">
              Marketing & Promotions
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">
            Coupons & Discounts
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure promotional discount codes, coupon rules, and customer usage limits.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          <Plus size={17} /> Create Coupon
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total Coupons</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900">{totalCoupons}</p>
          <p className="mt-1 text-xs text-slate-400">Campaigns created</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Active Coupons</p>
          <p className="mt-2 text-3xl font-extrabold text-emerald-600">{activeCoupons}</p>
          <p className="mt-1 text-xs text-slate-400">Available for checkout</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total Redemptions</p>
          <p className="mt-2 text-3xl font-extrabold text-indigo-600">{totalUsages}</p>
          <p className="mt-1 text-xs text-slate-400">Times applied in orders</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative min-w-[260px] flex-1">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search coupon code or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 py-2 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
          {(["ALL", "ACTIVE", "INACTIVE"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`rounded-lg px-3 py-1.5 transition ${
                statusFilter === filter
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {filter.charAt(0) + filter.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Coupons Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-4">Coupon Code</th>
                <th className="px-5 py-4">Discount</th>
                <th className="px-5 py-4">Requirements</th>
                <th className="px-5 py-4">Usage</th>
                <th className="px-5 py-4">Expiry</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    Loading coupons...
                  </td>
                </tr>
              ) : coupons.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    No coupons found. Create your first coupon to get started.
                  </td>
                </tr>
              ) : (
                coupons.map((c) => {
                  const isExpired = c.expiresAt && new Date(c.expiresAt) < new Date();
                  return (
                    <tr key={c.id} className="transition hover:bg-slate-50/60">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold tracking-wider text-indigo-700">
                            {c.code}
                          </span>
                          <button
                            onClick={() => handleCopy(c.code)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            title="Copy Code"
                          >
                            {copiedCode === c.code ? (
                              <Check size={14} className="text-emerald-600" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                        {c.description && (
                          <p className="mt-0.5 text-xs text-slate-400 truncate max-w-xs">
                            {c.description}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                          {c.type === "PERCENTAGE" ? (
                            <>
                              <Percent size={14} className="text-indigo-600" />
                              {Number(c.value)}% off
                            </>
                          ) : c.type === "FIXED_AMOUNT" ? (
                            <>
                              <Coins size={14} className="text-emerald-600" />
                              ৳{Number(c.value).toFixed(2)} off
                            </>
                          ) : (
                            <>
                              <Truck size={14} className="text-sky-600" />
                              Free Shipping
                            </>
                          )}
                        </div>
                        {c.maxDiscountAmount && (
                          <p className="text-xs text-slate-400">
                            Cap: ৳{Number(c.maxDiscountAmount).toFixed(0)}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs">
                        {c.minOrderAmount ? (
                          <span className="font-medium text-slate-700">
                            Min Order ৳{Number(c.minOrderAmount).toFixed(0)}
                          </span>
                        ) : (
                          <span className="text-slate-400">No minimum</span>
                        )}
                        <p className="text-slate-400">Limit {c.perCustomerLimit}/user</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-xs font-semibold text-slate-700">
                          {c.usageCount} / {c.usageLimit ?? "∞"}
                        </div>
                        {c.usageLimit && (
                          <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-indigo-600"
                              style={{
                                width: `${Math.min(100, (c.usageCount / c.usageLimit) * 100)}%`,
                              }}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs">
                        {c.expiresAt ? (
                          <span className={isExpired ? "font-semibold text-red-600" : "text-slate-700"}>
                            {new Date(c.expiresAt).toLocaleDateString()}
                            {isExpired && " (Expired)"}
                          </span>
                        ) : (
                          <span className="text-slate-400">Never</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => handleToggle(c.id)}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition ${
                            c.isActive && !isExpired
                              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          {c.isActive && !isExpired ? (
                            <>
                              <CheckCircle2 size={12} /> Active
                            </>
                          ) : (
                            <>
                              <XCircle size={12} /> Inactive
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => handleDelete(c.id, c.code)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                          title="Delete Coupon"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Coupon Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Create New Coupon</h3>
                <p className="text-xs text-slate-500">Configure promotional discount rules</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateCoupon} className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600">
                    Coupon Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SUMMER20"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm uppercase focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600">
                    Discount Type *
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED_AMOUNT">Fixed Amount (BDT)</option>
                    <option value="FREE_SHIPPING">Free Shipping</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600">
                  {type === "PERCENTAGE" ? "Discount Percentage (%) *" : "Discount Value (BDT) *"}
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={type === "PERCENTAGE" ? 100 : 1000000}
                  step="any"
                  placeholder={type === "PERCENTAGE" ? "15" : "150"}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600">
                    Min Order Amount (BDT)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    placeholder="Optional (e.g. 500)"
                    value={minOrderAmount}
                    onChange={(e) => setMinOrderAmount(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600">
                    Max Discount Cap (BDT)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    placeholder="Optional (e.g. 300)"
                    value={maxDiscountAmount}
                    onChange={(e) => setMaxDiscountAmount(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600">
                    Total Usage Limit
                  </label>
                  <input
                    type="number"
                    min={1}
                    placeholder="Unlimited"
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600">
                    Limit Per Customer
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={perCustomerLimit}
                    onChange={(e) => setPerCustomerLimit(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600">
                  Expiration Date
                </label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600">
                  Description / Internal Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Eid Flash Sale discount"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Save Coupon"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
