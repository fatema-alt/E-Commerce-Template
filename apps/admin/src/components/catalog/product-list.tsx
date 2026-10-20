"use client";
import { useToastState } from "@/components/admin/toast-provider";
/* eslint-disable @next/next/no-img-element -- Media is served by the configured API storage provider. */
import { useEffect, useState } from "react";
import type { Product } from "./products-page";
import {
  API,
  api,
  button,
  control,
  json,
  Pagination,
  useCatalogRole,
  useConfirm,
} from "./catalog-ui";

type Category = { id: string; name: string };
type Query = Record<string, string>;
type Summary = Record<string, number>;
const initial: Query = {
  search: "",
  categoryId: "",
  status: "",
  type: "",
  brand: "",
  stockStatus: "",
  minPrice: "",
  maxPrice: "",
  createdFrom: "",
  createdTo: "",
  updatedFrom: "",
  updatedTo: "",
  sortBy: "createdAt",
  sortDirection: "desc",
};
const columns = [
  "SKU",
  "Type",
  "Category",
  "Brand",
  "Price",
  "Sale",
  "Stock",
  "Status",
  "Visibility",
  "Featured",
  "Created",
  "Updated",
];

export function ProductList({
  revision,
  categories,
  onEdit,
  onStock,
  onHistory,
  onDelete,
}: {
  revision: number;
  categories: Category[];
  onEdit: (product: Product) => void;
  onStock: (product: Product, type: "IN" | "OUT") => void;
  onHistory: (product: Product) => void;
  onDelete: (product: Product) => void;
}) {
  const [query, setQuery] = useState<Query>(initial);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recent, setRecent] = useState<
    { id: string; name: string; updatedAt: string }[]
  >([]);
  const [trends, setTrends] = useState<{ date: string; count: number }[]>([]);
  const [valuations, setValuations] = useState<
    { currency: string; value: string }[]
  >([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [visible, setVisible] = useState(columns.slice(0, 10));
  const [saved, setSaved] = useState<Record<string, Query>>({});
  const [filterName, setFilterName] = useState("");
  const [action, setAction] = useState("DRAFT");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useToastState("error");
  const [results, setResults] = useState<
    { id: string; success: boolean; error?: string }[]
  >([]);
  const [refresh, setRefresh] = useState(0);
  const { canEdit, canDelete } = useCatalogRole();
  const { confirm, confirmation } = useConfirm();

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const prefs = JSON.parse(
          localStorage.getItem("commerce.catalog.products") ?? "{}",
        );
        const category = new URLSearchParams(window.location.search).get(
          "categoryId",
        );
        if (category) setQuery((prev) => ({ ...prev, categoryId: category }));
        if (Array.isArray(prefs.columns))
          setVisible(
            prefs.columns.filter((item: string) => columns.includes(item)),
          );
        if (prefs.filters && typeof prefs.filters === "object")
          setSaved(prefs.filters);
      } catch {
        /* Ignore corrupted browser preferences. */
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        paginated: "true",
        page: String(page),
        pageSize: String(pageSize),
      });
      Object.entries(query).forEach(([key, value]) => {
        if (value)
          params.set(
            key,
            key.endsWith("From") || key.endsWith("To")
              ? new Date(
                  value +
                    (key.endsWith("To") ? "T23:59:59.999Z" : "T00:00:00Z"),
                ).toISOString()
              : value,
          );
      });
      try {
        const [data, stats] = await Promise.all([
          api<{ items: Product[]; total: number }>("/products?" + params, {
            signal: controller.signal,
          }),
          api<{
            [key: string]: unknown;
            recent: typeof recent;
            trends: typeof trends;
            inventoryValuation?: typeof valuations;
          }>("/products/summary", { signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        setItems(data.items);
        setTotal(data.total);
        setSummary(
          Object.fromEntries(
            Object.entries(stats).filter(
              (entry): entry is [string, number] =>
                typeof entry[1] === "number",
            ),
          ),
        );
        setRecent(stats.recent ?? []);
        setValuations(stats.inventoryValuation ?? []);
        const now = new Date();
        setTrends(
          Array.from({ length: 30 }, (_, index) => {
            const date = new Date(
              Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate() - 29 + index,
              ),
            )
              .toISOString()
              .slice(0, 10);
            return {
              date,
              count:
                stats.trends?.find((item) => item.date === date)?.count ?? 0,
            };
          }),
        );
        setSelected([]);
        if (page > 1 && (page - 1) * pageSize >= data.total)
          setPage(Math.max(1, Math.ceil(data.total / pageSize)));
      } catch (error) {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error ? error.message : "Could not load products",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, page, pageSize, revision, refresh, setError]);

  function change(key: string, value: string) {
    setQuery((prev) => ({ ...prev, [key]: value }));
    setPage(1);
    setSelected([]);
    setLoading(true);
  }
  function preferences(
    nextColumns: string[],
    nextSaved: Record<string, Query>,
  ) {
    setVisible(nextColumns);
    setSaved(nextSaved);
    try {
      localStorage.setItem(
        "commerce.catalog.products",
        JSON.stringify({ columns: nextColumns, filters: nextSaved }),
      );
    } catch {
      setError("Browser preferences could not be saved");
    }
  }
  async function bulk() {
    if (
      !selected.length ||
      busy ||
      !(await confirm(
        "Apply " +
          action.toLowerCase() +
          " to " +
          selected.length +
          " selected products? Each result will be reported.",
      ))
    )
      return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ results: typeof results }>(
        "/products/bulk",
        json("POST", {
          ids: selected,
          action,
          ...(action === "CATEGORY"
            ? { categoryId: value }
            : action === "PRICE"
              ? { price: value }
              : {}),
        }),
      );
      setResults(result.results);
      setRefresh((n) => n + 1);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Bulk operation failed",
      );
    } finally {
      setBusy(false);
    }
  }
  function exportSelected() {
    const cell = (value: unknown) =>
      '"' +
      String(value ?? "")
        .replace(/^[=+@\-\t\r]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    const rows = [
      [
        "Name",
        "SKU",
        "Type",
        "Category",
        "Brand",
        "Price",
        "Sale price",
        "Currency",
        "Available",
        "Status",
      ],
      ...items
        .filter((item) => selected.includes(item.id))
        .map((item) => [
          item.name,
          item.sku,
          item.type,
          item.category.name,
          item.brand,
          item.price,
          item.salePrice,
          item.currency,
          item.availableStock,
          item.status,
        ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "products.csv";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const stats: [string, string][] = [
    ["total", "Total products"],
    ["active", "Active"],
    ["draft", "Drafts"],
    ["archived", "Archived"],
    ["lowStock", "Low stock"],
    ["outOfStock", "Out of stock"],
    ["missingImages", "Missing images"],
    ["missingCategories", "Missing categories"],
    ["categoryAttention", "Category attention"],
    ["attention", "Requires attention"],
  ];
  return (
    <div className="space-y-5">
      {confirmation}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(([key, label]) => (
          <div
            key={key}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight">
              {summary?.[key] ?? "—"}
            </p>
          </div>
        ))}
      </div>
      {!!valuations.length && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            On-hand inventory valuation at recorded cost
          </p>
          <div className="mt-2 flex flex-wrap gap-6">
            {valuations.map((item) => (
              <p key={item.currency} className="text-xl font-semibold">
                {item.currency} {item.value}
              </p>
            ))}
          </div>
        </div>
      )}
      <details className="rounded-2xl border border-slate-200 bg-white p-5">
        <summary className="cursor-pointer text-sm font-semibold">
          Catalog activity · Last 30 days
        </summary>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div>
            <p className="mb-3 text-sm text-slate-500">
              Products created per day (UTC)
            </p>
            <div
              className="flex h-24 items-end gap-1"
              role="img"
              aria-label={
                trends
                  .map((item) => item.date + ": " + item.count)
                  .join(", ") || "No products created in the last 30 days"
              }
            >
              {trends.map((item) => (
                <div
                  key={item.date}
                  title={item.date + ": " + item.count}
                  className="min-w-2 flex-1 rounded-t bg-indigo-500"
                  style={{
                    height:
                      Math.max(
                        3,
                        (item.count /
                          Math.max(...trends.map((row) => row.count), 1)) *
                          100,
                      ) + "%",
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Recently updated</p>
            {recent.map((item) => (
              <p
                key={item.id}
                className="flex justify-between gap-2 py-1 text-sm"
              >
                <span>{item.name}</span>
                <time className="text-slate-500">
                  {new Date(item.updatedAt).toLocaleDateString()}
                </time>
              </p>
            ))}
          </div>
        </div>
      </details>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b p-5">
          <h2 className="text-lg font-bold">
            Product catalog{" "}
            <span className="ml-2 rounded-full bg-indigo-50 px-2.5 py-1 text-sm text-indigo-600">
              {total}
            </span>
          </h2>
          <button className={button} onClick={() => setRefresh((n) => n + 1)}>
            Refresh
          </button>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <input
            aria-label="Search products"
            className={control + " lg:col-span-2"}
            placeholder="Search name, SKU, barcode or variant SKU"
            value={query.search}
            onChange={(e) => change("search", e.target.value)}
          />
          <select
            aria-label="Category filter"
            className={control}
            value={query.categoryId}
            onChange={(e) => change("categoryId", e.target.value)}
          >
            <option value="">All categories and descendants</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Product status"
            className={control}
            value={query.status}
            onChange={(e) => change("status", e.target.value)}
          >
            <option value="">All statuses</option>
            {["DRAFT", "ACTIVE", "ARCHIVED"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            aria-label="Product type"
            className={control}
            value={query.type}
            onChange={(e) => change("type", e.target.value)}
          >
            <option value="">All types</option>
            <option>SIMPLE</option>
            <option>VARIABLE</option>
          </select>
          <select
            aria-label="Stock status"
            className={control}
            value={query.stockStatus}
            onChange={(e) => change("stockStatus", e.target.value)}
          >
            <option value="">All stock</option>
            <option value="HEALTHY">Healthy stock</option>
            <option value="LOW">Low stock</option>
            <option value="OUT">Out of stock</option>
          </select>
          <input
            aria-label="Brand filter"
            className={control}
            placeholder="Brand (exact match)"
            value={query.brand}
            onChange={(e) => change("brand", e.target.value)}
          />
          <select
            aria-label="Sort products"
            className={control}
            value={query.sortBy + ":" + query.sortDirection}
            onChange={(e) => {
              const [sortBy, sortDirection] = e.target.value.split(":");
              setQuery((prev) => ({ ...prev, sortBy, sortDirection }));
              setPage(1);
            }}
          >
            {[
              ["createdAt:desc", "Newest first"],
              ["createdAt:asc", "Oldest first"],
              ["updatedAt:desc", "Recently updated"],
              ["name:asc", "Name A–Z"],
              ["name:desc", "Name Z–A"],
              ["price:asc", "Price low–high"],
              ["price:desc", "Price high–low"],
              ["sku:asc", "SKU A–Z"],
            ].map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </div>
        <details className="border-t px-5 py-3">
          <summary className="cursor-pointer text-sm font-medium text-indigo-600">
            Advanced filters & preferences
          </summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ["minPrice", "Minimum price"],
              ["maxPrice", "Maximum price"],
              ["createdFrom", "Created from (UTC)"],
              ["createdTo", "Created to (UTC)"],
              ["updatedFrom", "Updated from (UTC)"],
              ["updatedTo", "Updated to (UTC)"],
            ].map(([key, label]) => (
              <label key={key} className="text-xs text-slate-500">
                {label}
                <input
                  className={control + " mt-1"}
                  type={key.includes("Price") ? "number" : "date"}
                  min={key.includes("Price") ? "0" : undefined}
                  step={key.includes("Price") ? ".01" : undefined}
                  value={query[key]}
                  onChange={(e) => change(key, e.target.value)}
                />
              </label>
            ))}
          </div>
          <div className="my-4 flex flex-wrap gap-3">
            {columns.map((column) => (
              <label key={column} className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={visible.includes(column)}
                  onChange={(e) =>
                    preferences(
                      e.target.checked
                        ? [...visible, column]
                        : visible.filter((item) => item !== column),
                      saved,
                    )
                  }
                />
                {column}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              aria-label="Saved filter name"
              placeholder="Filter name"
              className={control + " max-w-48"}
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              maxLength={50}
            />
            <button
              className={button}
              disabled={!filterName.trim()}
              onClick={() => {
                preferences(visible, { ...saved, [filterName.trim()]: query });
                setFilterName("");
              }}
            >
              Save filter
            </button>
            <select
              aria-label="Saved filters"
              className={control + " max-w-48"}
              value=""
              onChange={(e) => {
                setQuery({ ...initial, ...saved[e.target.value] });
                setPage(1);
              }}
            >
              <option value="">Apply saved filter</option>
              {Object.keys(saved).map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
            <button
              className={button}
              onClick={() => {
                setQuery(initial);
                setPage(1);
              }}
            >
              Reset filters
            </button>
            <button className={button} onClick={() => preferences(visible, {})}>
              Clear saved filters
            </button>
          </div>
        </details>
        {error && (
          <div
            role="alert"
            className="m-5 rounded-xl bg-red-50 p-4 text-sm text-red-700"
          >
            {error}{" "}
            <button
              onClick={() => setRefresh((n) => n + 1)}
              className="ml-2 underline"
            >
              Retry
            </button>
          </div>
        )}
        {results.length > 0 && (
          <div
            role="status"
            className="m-5 rounded-xl bg-indigo-50 p-4 text-sm"
          >
            <p>
              {results.filter((item) => item.success).length} succeeded ·{" "}
              {results.filter((item) => !item.success).length} failed
            </p>
            {results
              .filter((item) => !item.success)
              .map((item) => (
                <p key={item.id} className="mt-1 text-red-700">
                  {item.id}: {item.error}
                </p>
              ))}
          </div>
        )}
        {!!selected.length && (
          <div className="flex flex-wrap items-center gap-3 border-y bg-indigo-50 p-4">
            <span className="text-sm font-semibold">
              {selected.length} selected
            </span>
            <button className={button} onClick={exportSelected}>
              Export selected CSV
            </button>
            {canEdit && (
              <>
                <select
                  aria-label="Bulk action"
                  className={control + " max-w-48"}
                  value={action}
                  onChange={(e) => {
                    setAction(e.target.value);
                    setValue("");
                  }}
                >
                  {[
                    ["ACTIVATE", "Activate"],
                    ["DRAFT", "Move to draft"],
                    ["ARCHIVE", "Archive"],
                    ["CATEGORY", "Assign category"],
                    ["PRICE", "Set regular price"],
                    ...(canDelete ? [["DELETE", "Soft delete"]] : []),
                  ].map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                {action === "CATEGORY" && (
                  <select
                    aria-label="Bulk category"
                    className={control + " max-w-48"}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                  >
                    <option value="">Select category</option>
                    {categories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                )}
                {action === "PRICE" && (
                  <input
                    aria-label="Bulk regular price"
                    className={control + " max-w-36"}
                    type="number"
                    min="0"
                    step=".01"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                  />
                )}
                <button
                  disabled={
                    busy || (["PRICE", "CATEGORY"].includes(action) && !value)
                  }
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  onClick={() => void bulk()}
                >
                  {busy ? "Applying…" : "Apply"}
                </button>
              </>
            )}
          </div>
        )}
        <div className="overflow-x-auto" aria-busy={loading}>
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="p-4">
                  <input
                    aria-label="Select current page"
                    type="checkbox"
                    checked={
                      items.length > 0 && selected.length === items.length
                    }
                    onChange={(e) =>
                      setSelected(
                        e.target.checked ? items.map((item) => item.id) : [],
                      )
                    }
                  />
                </th>
                <th className="p-4">Product</th>
                {columns
                  .filter((column) => visible.includes(column))
                  .map((column) => (
                    <th className="p-4" key={column}>
                      {column}
                    </th>
                  ))}
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading &&
                items.map((product) => {
                  const image =
                    product.images?.find((item) => item.isPrimary) ??
                    product.images?.[0];
                  const values: Record<string, React.ReactNode> = {
                    SKU: product.sku,
                    Type: product.type,
                    Category: product.category.name,
                    Brand: product.brand || "—",
                    Price: product.currency + " " + product.price,
                    Sale: product.salePrice ?? "—",
                    Stock: (
                      <span
                        className={
                          product.availableStock <= 0
                            ? "text-red-700"
                            : "text-slate-700"
                        }
                      >
                        {product.availableStock} available
                      </span>
                    ),
                    Status: (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">
                        {product.status}
                      </span>
                    ),
                    Visibility: product.isVisible ? "Public" : "Hidden",
                    Featured: product.isFeatured ? "Yes" : "No",
                    Created: new Date(product.createdAt).toLocaleDateString(),
                    Updated: new Date(product.updatedAt).toLocaleDateString(),
                  };
                  return (
                    <tr
                      key={product.id}
                      className="border-t hover:bg-slate-50/70"
                    >
                      <td className="p-4">
                        <input
                          aria-label={"Select " + product.name}
                          type="checkbox"
                          checked={selected.includes(product.id)}
                          onChange={(e) =>
                            setSelected((prev) =>
                              e.target.checked
                                ? [...prev, product.id]
                                : prev.filter((id) => id !== product.id),
                            )
                          }
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {image ? (
                            <img
                              loading="lazy"
                              src={new URL(
                                image.url,
                                new URL(API).origin,
                              ).toString()}
                              alt={image.altText || product.name}
                              className="h-12 w-12 rounded-xl border object-cover"
                            />
                          ) : (
                            <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-xs text-slate-400">
                              Image
                            </div>
                          )}
                          <div>
                            <p className="font-semibold">{product.name}</p>
                            <p className="text-xs text-slate-400">
                              /{product.slug}
                            </p>
                          </div>
                        </div>
                      </td>
                      {columns
                        .filter((column) => visible.includes(column))
                        .map((column) => (
                          <td key={column} className="p-4 text-slate-600">
                            {values[column]}
                          </td>
                        ))}
                      <td className="p-4">
                        <div className="flex gap-3">
                          {canEdit && (
                            <button
                              className="font-medium text-indigo-600"
                              onClick={() => onEdit(product)}
                            >
                              Edit
                            </button>
                          )}
                          {canEdit && product.type === "SIMPLE" && (
                            <>
                              <button onClick={() => onStock(product, "IN")}>
                                Stock in
                              </button>
                              <button onClick={() => onStock(product, "OUT")}>
                                Stock out
                              </button>
                            </>
                          )}
                          <button onClick={() => onHistory(product)}>
                            History
                          </button>
                          {canDelete && (
                            <button
                              className="text-red-600"
                              onClick={() => onDelete(product)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          {loading ? (
            <div className="space-y-3 p-5" aria-label="Loading products">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-14 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : (
            !items.length && (
              <p className="p-12 text-center text-slate-500">
                No products match these filters.
              </p>
            )
          )}
        </div>
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPage={setPage}
          onSize={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </section>
    </div>
  );
}
