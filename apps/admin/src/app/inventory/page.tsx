"use client";

import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { Modal, useCatalogRole } from "@/components/catalog/catalog-ui";

import { useCallback, useEffect, useMemo, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
type InventoryItem = {
  id: string;
  productId: string;
  variantId: string | null;
  name: string;
  sku: string;
  category: string;
  type: string;
  quantity: number;
  reserved: number;
  available: number;
  lowStockAt: number;
};
type Overview = {
  summary: {
    inventoryItems: number;
    totalQuantity: number;
    lowStock: number;
    outOfStock: number;
  };
  items: InventoryItem[];
};
type Movement = {
  id: string;
  createdAt: string;
  type: string;
  quantity: number;
  beforeQty: number;
  afterQty: number;
  reason: string | null;
  product: { name: string };
  variant: { name: string } | null;
};

export default function InventoryPage() {
  const { canEdit } = useCatalogRole();
  const [thresholdItem, setThresholdItem] = useState<InventoryItem | null>(
    null,
  );
  const [thresholdValue, setThresholdValue] = useState("");
  const [data, setData] = useState<Overview | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [type, setType] = useState<"IN" | "OUT">("IN");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const refresh = useCallback(() => {
    return Promise.all([
      authenticatedFetch(`${API_URL}/inventory`, { cache: "no-store" }),
      authenticatedFetch(`${API_URL}/inventory/movements`, {
        cache: "no-store",
      }),
    ])
      .then(async ([a, b]) => {
        if (!a.ok || !b.ok)
          throw new Error("Could not load inventory. Check the API server.");
        setData(await a.json());
        setMovements(await b.json());
        setError("");
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Could not load inventory");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rows = useMemo(
    () =>
      (data?.items ?? []).filter((item) => {
        const matches = `${item.name} ${item.sku} ${item.category}`
          .toLowerCase()
          .includes(search.toLowerCase());
        const status =
          item.available <= 0
            ? "OUT"
            : item.available <= item.lowStockAt
              ? "LOW"
              : "HEALTHY";
        return matches && (filter === "ALL" || status === filter);
      }),
    [data, search, filter],
  );

  async function submitAdjustment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const count = Number(quantity);
    if (!Number.isInteger(count) || count <= 0) {
      setError("Quantity must be a positive integer");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await authenticatedFetch(
        `${API_URL}/inventory/${selected.id}/adjust`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, quantity: count, reason }),
        },
      );
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(
          Array.isArray(result.message)
            ? result.message.join(", ")
            : result.message || "Stock adjustment failed",
        );
      }
      setSelected(null);
      setReason("");
      setQuantity("1");
      setSuccess("Stock updated successfully");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stock adjustment failed");
    } finally {
      setBusy(false);
    }
  }

  function editThreshold(item: InventoryItem) {
    setThresholdItem(item);
    setThresholdValue(String(item.lowStockAt));
  }
  async function submitThreshold(event: React.FormEvent) {
    event.preventDefault();
    if (!thresholdItem) return;
    const item = thresholdItem;
    const count = Number(thresholdValue);
    if (
      !thresholdValue.trim() ||
      !Number.isSafeInteger(count) ||
      count < 0 ||
      count > 2147483647
    ) {
      setError("Threshold must be a non-negative whole number");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await authenticatedFetch(
        `${API_URL}/inventory/${item.id}/threshold`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lowStockAt: count }),
        },
      );
      if (!response.ok) throw new Error("Could not update threshold");
      setSuccess("Low-stock threshold updated");
      setThresholdItem(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update threshold");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-indigo-500";
  return (
    <main className="space-y-7 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-indigo-600">
            COMMERCE SUITE / ADMIN
          </p>
          <h1 className="mt-2 text-3xl font-bold">Inventory Management</h1>
          <p className="mt-2 text-slate-500">
            Manage product and variant stock in one place.
          </p>
        </div>
        <button
          onClick={() => void refresh()}
          className="rounded-lg border bg-white px-4 py-2 font-medium"
        >
          Refresh
        </button>
      </header>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="rounded-lg bg-green-50 p-4 text-green-700">
          {success}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Inventory Items", data?.summary.inventoryItems ?? 0],
          ["Total Units", data?.summary.totalQuantity ?? 0],
          ["Low Stock", data?.summary.lowStock ?? 0],
          ["Out of Stock", data?.summary.outOfStock ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      <section className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="flex flex-wrap gap-3 border-b p-5">
          <input
            aria-label="Search inventory"
            placeholder="Search name, SKU or category"
            className={`${input} max-w-md`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Stock status"
            className={`${input} max-w-48`}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="ALL">All stock</option>
            <option value="HEALTHY">Healthy</option>
            <option value="LOW">Low stock</option>
            <option value="OUT">Out of stock</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {[
                  "Product / Variant",
                  "SKU",
                  "Category",
                  "On hand",
                  "Reserved",
                  "Available",
                  "Threshold",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th key={h} className="p-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const status =
                  item.available <= 0
                    ? "Out of stock"
                    : item.available <= item.lowStockAt
                      ? "Low stock"
                      : "Healthy";
                return (
                  <tr key={item.id} className="border-t">
                    <td className="p-4 font-medium">
                      {item.name}
                      <div className="text-xs font-normal text-slate-500">
                        {item.type}
                      </div>
                    </td>
                    <td className="p-4">{item.sku}</td>
                    <td className="p-4">{item.category}</td>
                    <td className="p-4">{item.quantity}</td>
                    <td className="p-4">{item.reserved}</td>
                    <td className="p-4">{item.available}</td>
                    <td className="p-4">
                      <button
                        disabled={!canEdit}
                        className="text-indigo-600 underline disabled:text-slate-500 disabled:no-underline"
                        onClick={() => void editThreshold(item)}
                      >
                        {item.lowStockAt}
                      </button>
                    </td>
                    <td
                      className={`p-4 font-medium ${status === "Healthy" ? "text-green-700" : "text-amber-700"}`}
                    >
                      {status}
                    </td>
                    <td className="p-4">
                      <button
                        disabled={!canEdit}
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-white disabled:opacity-40"
                        onClick={() => {
                          setSelected(item);
                          setType("IN");
                          setQuantity("1");
                          setReason("");
                        }}
                      >
                        Adjust
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {loading ? (
            <p className="p-5 text-slate-500">Loading inventory...</p>
          ) : rows.length === 0 ? (
            <p className="p-5 text-slate-500">No inventory records found.</p>
          ) : null}
        </div>
      </section>
      <section className="overflow-hidden rounded-xl bg-white shadow-sm">
        <h2 className="border-b p-5 text-xl font-semibold">
          Recent Stock Movements
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {[
                  "Date",
                  "Item",
                  "Movement",
                  "Quantity",
                  "Before → After",
                  "Reason",
                ].map((h) => (
                  <th key={h} className="p-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="p-4">
                    {new Date(m.createdAt).toLocaleString()}
                  </td>
                  <td className="p-4">
                    {m.product.name}
                    {m.variant ? ` / ${m.variant.name}` : ""}
                  </td>
                  <td className="p-4">{m.type.replaceAll("_", " ")}</td>
                  <td className="p-4">{m.quantity}</td>
                  <td className="p-4">
                    {m.beforeQty} → {m.afterQty}
                  </td>
                  <td className="p-4">{m.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {movements.length === 0 && (
            <p className="p-5 text-slate-500">No stock movements yet.</p>
          )}
        </div>
      </section>
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setSelected(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="adjust-title"
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 id="adjust-title" className="text-xl font-semibold">
              Adjust Stock
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {selected.name} · Available: {selected.available}
            </p>
            <form onSubmit={submitAdjustment} className="mt-5 space-y-4">
              <label className="block text-sm font-medium">
                Movement
                <select
                  className={`${input} mt-1`}
                  value={type}
                  onChange={(e) => setType(e.target.value as "IN" | "OUT")}
                >
                  <option value="IN">Stock In</option>
                  <option value="OUT">Stock Out</option>
                </select>
              </label>
              <label className="block text-sm font-medium">
                Quantity
                <input
                  className={`${input} mt-1`}
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </label>
              <label className="block text-sm font-medium">
                Reason
                <textarea
                  className={`${input} mt-1`}
                  maxLength={500}
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setSelected(null)}
                  className="rounded-lg border px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  disabled={busy}
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
                >
                  {busy ? "Saving..." : "Save Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {thresholdItem && (
        <Modal
          title="Low-stock threshold"
          busy={busy}
          onClose={() => setThresholdItem(null)}
        >
          <form onSubmit={submitThreshold} className="space-y-4">
            <p className="text-sm text-slate-500">{thresholdItem.name}</p>
            <label className="block text-sm font-medium">
              Alert threshold
              <input
                required
                type="number"
                min="0"
                max="2147483647"
                step="1"
                className={input}
                value={thresholdValue}
                onChange={(event) => setThresholdValue(event.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              disabled={busy}
              className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white"
            >
              {busy ? "Saving?" : "Save threshold"}
            </button>
          </form>
        </Modal>
      )}
    </main>
  );
}
