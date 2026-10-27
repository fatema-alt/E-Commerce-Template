"use client";

import { useEffect, useId, useState } from "react";
import { request, type Value } from "./cms-api";

type Item = { id: string; name: string; sku?: string; slug?: string };

export function CatalogPicker({ kind, value, multiple, max = 100, onChange }: {
  kind: "products" | "categories"; value: Value; multiple: boolean; max?: number;
  onChange: (value: Value) => void;
}) {
  const id = useId();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Item[]>([]);
  const [known, setKnown] = useState<Record<string, Item>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const selected = (multiple ? (Array.isArray(value) ? value : []) : value ? [value] : []) as string[];

  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      const query = new URLSearchParams({ paginated: "true", page: String(page), pageSize: "20", search });
      request<{ items: Item[]; total: number }>(`/${kind}?${query}`)
        .then((result) => {
          if (!live) return;
          setItems(result.items);
          setTotal(result.total);
          setKnown((previous) => ({ ...previous, ...Object.fromEntries(result.items.map((item) => [item.id, item])) }));
        })
        .catch((e: Error) => { if (live) setError(e.message); })
        .finally(() => { if (live) setLoading(false); });
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [kind, search, page]);

  useEffect(() => {
    let live = true;
    const savedIds = (multiple ? (Array.isArray(value) ? value : []) : value ? [value] : []) as string[];
    for (const selectedId of savedIds) {
      request<Item>(`/${kind}/${encodeURIComponent(selectedId)}`).then((item) => {
        if (live) setKnown((previous) => ({ ...previous, [item.id]: item }));
      }).catch(() => { /* Keep saved selections removable even when an item was deleted. */ });
    }
    return () => { live = false; };
  }, [kind, value, multiple]);

  function remove(key: string) {
    onChange(multiple ? selected.filter((entry) => entry !== key) : "");
  }

  return <div className="space-y-3 text-sm">
    <label htmlFor={id} className="block font-semibold">{multiple ? "Choose" : "Choose a"} {kind}</label>
    <div className="flex flex-wrap gap-2">
      {selected.map((key, index) => <span key={key} className="rounded-lg border p-2">
        {known[key]?.name ?? "Saved selection"}
        {multiple && index > 0 && <button type="button" aria-label={`Move ${known[key]?.name ?? "selection"} up`} className="ml-2" onClick={() => {
          const next = [...selected]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange(next);
        }}>↑</button>}
        <button type="button" className="ml-2 text-red-600" aria-label={`Remove ${known[key]?.name ?? "selection"}`} onClick={() => remove(key)}>×</button>
      </span>)}
    </div>
    <input id={id} className="w-full rounded-lg border bg-white p-2 text-slate-900" placeholder={`Search ${kind} by name${kind === "products" ? " or SKU" : ""}…`} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
    {error ? <p role="alert" className="text-red-600">{error}</p> : loading ? <p role="status">Loading…</p> : <div className="max-h-64 overflow-y-auto space-y-1">
      {!items.length && <p>No {kind} found.</p>}
      {items.map((item) => <button type="button" key={item.id} aria-pressed={selected.includes(item.id)} disabled={!selected.includes(item.id) && multiple && selected.length >= max} className="block w-full rounded-lg border p-2 text-left disabled:opacity-50" onClick={() => {
        if (selected.includes(item.id)) remove(item.id);
        else onChange(multiple ? [...selected, item.id] : item.id);
      }}>
        {selected.includes(item.id) ? "✓ " : "+ "}{item.name}
        <span className="block text-xs text-slate-500">{item.sku || item.slug}</span>
      </button>)}
    </div>}
    <div className="flex items-center justify-between gap-2">
      <button type="button" disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>Previous</button>
      <span>Page {page} / {Math.max(1, Math.ceil(total / 20))}</span>
      <button type="button" disabled={page * 20 >= total || loading} onClick={() => setPage(page + 1)}>Next</button>
    </div>
    {multiple && <p className="text-xs text-slate-500">{selected.length} selected. Selection order controls display order.</p>}
  </div>;
}
