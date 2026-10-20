"use client";
import { useToastState } from "@/components/admin/toast-provider";
import { useEffect, useState } from "react";
import { api, button } from "./catalog-ui";
type Event = {
  id: string;
  action: string;
  actorId: string | null;
  createdAt: string;
  changes: unknown;
};
export function CatalogAudit({
  entity,
  id,
}: {
  entity: "product" | "category";
  id: string;
}) {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Event[]>([]);
  const [, setError] = useToastState("error");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await api<Event[]>(
          "/catalog/" +
            entity +
            "/" +
            id +
            "/audit?page=" +
            page +
            "&pageSize=10",
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          setRows(result);
          setError("");
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Could not load audit events",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [entity, id, page, setError]);
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Audit and price history</h3>

      {loading ? (
        <p className="text-sm text-slate-500">Loading history…</p>
      ) : rows.length ? (
        rows.map((row) => (
          <details key={row.id} className="rounded-xl border p-3 text-sm">
            <summary className="cursor-pointer">
              <span className="font-medium">
                {row.action.replaceAll("_", " ")}
              </span>
              <time className="ml-3 text-xs text-slate-500">
                {new Date(row.createdAt).toLocaleString()}
              </time>
            </summary>
            <p className="mt-2 text-xs text-slate-500">
              Administrator: {row.actorId ?? "System / legacy operation"}
            </p>
            <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs">
              {JSON.stringify(row.changes, null, 2)}
            </pre>
          </details>
        ))
      ) : (
        <p className="text-sm text-slate-500">No audit events on this page.</p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          className={button}
          disabled={loading || page <= 1}
          onClick={() => setPage((n) => n - 1)}
        >
          Previous events
        </button>
        <button
          type="button"
          className={button}
          disabled={loading || rows.length < 10}
          onClick={() => setPage((n) => n + 1)}
        >
          Next events
        </button>
      </div>
    </div>
  );
}
