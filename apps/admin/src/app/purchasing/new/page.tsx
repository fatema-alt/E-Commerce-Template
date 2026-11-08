"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Loader2,
  Package,
  Plus,
  Trash2,
  Truck,
  Users,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

const API = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
).replace(/\/$/, "");
const ROOT = API.endsWith("/api/v1") ? API : `${API}/api/v1`;

type Supplier = {
  id: string;
  name: string;
  phone?: string | null;
  paymentTerms?: string | null;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  costPrice?: string | number | null;
  type: string;
  variants?: Array<{
    id: string;
    name: string;
    sku: string;
    costPrice?: string | number | null;
  }>;
};

type LineItem = {
  productId: string;
  variantId?: string;
  sku: string;
  productName: string;
  variantName?: string;
  orderedQuantity: number;
  unitCost: number;
};

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Form states
  const [supplierId, setSupplierId] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "ORDERED">("ORDERED");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [shippingCost, setShippingCost] = useState(0);
  const [tax, setTax] = useState(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    {
      productId: "",
      orderedQuantity: 10,
      unitCost: 0,
      sku: "",
      productName: "",
    },
  ]);

  useEffect(() => {
    async function loadCatalog() {
      try {
        const [supRes, prodRes] = await Promise.all([
          authenticatedFetch(`${ROOT}/purchasing/suppliers?limit=100&isActive=true`),
          authenticatedFetch(`${ROOT}/products?limit=100`),
        ]);

        if (supRes.ok) {
          const s = await supRes.json();
          setSuppliers(s.items || []);
          if (s.items?.length) setSupplierId(s.items[0].id);
        }
        if (prodRes.ok) {
          const p = await prodRes.json();
          setProducts(p.items || []);
        }
      } catch (err) {
        console.error("Failed to load suppliers/products", err);
      } finally {
        setLoadingInitial(false);
      }
    }
    void loadCatalog();
  }, []);

  const handleProductChange = (index: number, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const newItems = [...items];
    const defaultCost = Number(prod.costPrice || 0);

    newItems[index] = {
      ...newItems[index],
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      variantId: undefined,
      variantName: undefined,
      unitCost: defaultCost,
    };
    setItems(newItems);
  };

  const handleVariantChange = (index: number, variantId: string) => {
    const newItems = [...items];
    const currentProd = products.find((p) => p.id === newItems[index].productId);
    const variant = currentProd?.variants?.find((v) => v.id === variantId);

    if (variant) {
      newItems[index] = {
        ...newItems[index],
        variantId: variant.id,
        variantName: variant.name,
        sku: variant.sku || newItems[index].sku,
        unitCost: Number(variant.costPrice || newItems[index].unitCost),
      };
    } else {
      newItems[index] = {
        ...newItems[index],
        variantId: undefined,
        variantName: undefined,
      };
    }
    setItems(newItems);
  };

  const handleQuantityChange = (index: number, qty: number) => {
    const newItems = [...items];
    newItems[index].orderedQuantity = Math.max(1, qty);
    setItems(newItems);
  };

  const handleCostChange = (index: number, cost: number) => {
    const newItems = [...items];
    newItems[index].unitCost = Math.max(0, cost);
    setItems(newItems);
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        productId: "",
        orderedQuantity: 10,
        unitCost: 0,
        sku: "",
        productName: "",
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce(
    (sum, item) => sum + item.orderedQuantity * (item.unitCost || 0),
    0,
  );
  const totalAmount = subtotal + Number(shippingCost || 0) + Number(tax || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!supplierId) {
      setError("Please select a supplier");
      return;
    }

    const invalidItem = items.find((i) => !i.productId || i.orderedQuantity < 1);
    if (invalidItem) {
      setError("Please select a valid product and quantity for each item");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        supplierId,
        status,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        shippingCost: Number(shippingCost || 0),
        tax: Number(tax || 0),
        notes: notes.trim() || undefined,
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId || undefined,
          orderedQuantity: Number(i.orderedQuantity),
          unitCost: Number(i.unitCost),
        })),
      };

      const res = await authenticatedFetch(`${ROOT}/purchasing/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to create purchase order");
      }

      const created = await res.json();
      router.push(`/purchasing/${created.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create purchase order");
    } finally {
      setSubmitting(false);
    }
  };

  const formatBDT = (amount: number) =>
    new Intl.NumberFormat("en-BD", {
      style: "currency",
      currency: "BDT",
    }).format(amount);

  if (loadingInitial) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-5xl space-y-6">
      {/* Back link */}
      <div>
        <Link
          href="/purchasing"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft size={14} /> Back to Purchase Orders
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Create Purchase Order
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Prepare a new purchase order for supplier goods and restock warehouse inventory.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400">
          {error}
        </div>
      )}

      {/* Main Details Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#121A30] space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Truck size={16} className="text-indigo-500" /> Order Information
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Supplier *
            </label>
            {suppliers.length === 0 ? (
              <div className="text-xs text-amber-600 dark:text-amber-400">
                No active suppliers found.{" "}
                <Link
                  href="/purchasing/suppliers"
                  className="font-semibold underline"
                >
                  Create one first
                </Link>
              </div>
            ) : (
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.phone ? `(${s.phone})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Initial Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            >
              <option value="ORDERED">ORDERED (Ready to receive goods)</option>
              <option value="DRAFT">DRAFT (Save for later editing)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Expected Delivery Date
            </label>
            <input
              type="date"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Internal Notes / Instructions
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Terms, consignment instructions, warehouse bay..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Line Items Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#121A30] space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Package size={16} className="text-indigo-500" /> Order Items & Cost
          </h2>
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          >
            <Plus size={14} /> Add Item
          </button>
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => {
            const selectedProd = products.find((p) => p.id === item.productId);
            const hasVariants = Boolean(
              selectedProd?.variants && selectedProd.variants.length > 0,
            );

            return (
              <div
                key={idx}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-white/5 dark:bg-white/5 sm:flex-row sm:items-center"
              >
                {/* Product Select */}
                <div className="flex-2 min-w-[200px]">
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Product *
                  </label>
                  <select
                    value={item.productId}
                    onChange={(e) => handleProductChange(idx, e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-white/10 dark:bg-[#121A30] dark:text-slate-100"
                  >
                    <option value="">Select a product...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Variant Select (if variable product) */}
                {hasVariants && (
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Variant
                    </label>
                    <select
                      value={item.variantId || ""}
                      onChange={(e) => handleVariantChange(idx, e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-white/10 dark:bg-[#121A30] dark:text-slate-100"
                    >
                      <option value="">Default / Base</option>
                      {selectedProd?.variants?.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.sku})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Ordered Quantity */}
                <div className="w-24">
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Qty *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={item.orderedQuantity}
                    onChange={(e) =>
                      handleQuantityChange(idx, parseInt(e.target.value) || 1)
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-white/10 dark:bg-[#121A30] dark:text-slate-100"
                  />
                </div>

                {/* Unit Cost */}
                <div className="w-32">
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Unit Cost (BDT) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitCost}
                    onChange={(e) =>
                      handleCostChange(idx, parseFloat(e.target.value) || 0)
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-white/10 dark:bg-[#121A30] dark:text-slate-100"
                  />
                </div>

                {/* Line Total */}
                <div className="w-28 text-right sm:self-center">
                  <span className="block text-[10px] uppercase font-semibold text-slate-400">
                    Line Total
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {formatBDT(item.orderedQuantity * item.unitCost)}
                  </span>
                </div>

                {/* Remove Button */}
                <div className="pt-4 sm:pt-0 sm:self-center">
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    disabled={items.length <= 1}
                    className="rounded-lg p-2 text-slate-400 hover:text-rose-600 disabled:opacity-30"
                    title="Remove item"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Financials & Submission Card */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#121A30] space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <DollarSign size={16} className="text-indigo-500" /> Additional Charges
          </h2>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Freight / Shipping Cost (BDT)
            </label>
            <input
              type="number"
              min="0"
              value={shippingCost}
              onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Taxes / Customs Duty (BDT)
            </label>
            <input
              type="number"
              min="0"
              value={tax}
              onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[#121A30] flex flex-col justify-between">
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Items Subtotal:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {formatBDT(subtotal)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Freight / Shipping:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {formatBDT(shippingCost)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Tax / Customs:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {formatBDT(tax)}
              </span>
            </div>
            <div className="border-t border-slate-200 dark:border-white/10 pt-2 flex justify-between text-sm font-bold text-slate-900 dark:text-slate-100">
              <span>Total PO Amount:</span>
              <span className="text-indigo-600 dark:text-indigo-400">
                {formatBDT(totalAmount)}
              </span>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <Link
              href="/purchasing"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-50"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {status === "ORDERED" ? "Place Purchase Order" : "Save as Draft"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
