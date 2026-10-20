"use client";
import { useToastState } from "@/components/admin/toast-provider";
import { useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { formatMoney, orderFetch } from "./orders-client";

type Report = {
  totalOrders: number;
  grossSales: string;
  netSales: string;
  paidTotal: string;
  unpaidTotal: string;
  codOutstanding: string;
  refundTotal: string;
  cancellationRate: number;
  returnRate: number;
  basis: string;
  summaries: Array<{
    period: string;
    orders: number;
    grossSales: string;
    paidTotal: string;
    refundTotal: string;
  }>;
};
export function OrdersReports({
  filters,
}: {
  filters: Record<string, string>;
}) {
  const query = new URLSearchParams(filters).toString();
  const [period, setPeriod] = useState("daily");
  const key = `${query}&period=${period}`;
  const [result, setResult] = useState<{
    key: string;
    report: Report | null;
    error: string;
  } | null>(null);
  const [exportError, setError] = useToastState("error");
  const report = result?.key === key ? result.report : null;
  const error = exportError || (result?.key === key ? result.error : "");
  const [busy, setBusy] = useState(false);
  const [canExport, setCanExport] = useState(false);
  useEffect(() => {
    void orderFetch<{ role: string }>("/auth/me")
      .then((a) => setCanExport(["ADMIN", "SUPER_ADMIN"].includes(a.role)))
      .catch(() => {});
  }, []);
  useEffect(() => {
    let live = true;
    void orderFetch<Report>(`/orders/reports?${query}&period=${period}`)
      .then((r) => {
        if (live) setResult({ key, report: r, error: "" });
      })
      .catch((e) => {
        if (live) setResult({ key, report: null, error: e.message });
      });
    return () => {
      live = false;
    };
  }, [query, period, key]);
  async function download() {
    setBusy(true);
    setError("");
    try {
      const root = (
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
      ).replace(/\/$/, "");
      const response = await authenticatedFetch(
        `${root.endsWith("/api/v1") ? root : `${root}/api/v1`}/orders/export?${query}`,
      );
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.message ?? "Export failed");
      }
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "orders.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Sales reports</h2>
        <div className="flex gap-2">
          <select
            aria-label="Summary period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
          </select>
          {canExport && (
            <button
              disabled={busy}
              onClick={() => void download()}
              className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
            >
              {busy ? "Exporting…" : "Export filtered CSV"}
            </button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {!report && !error && (
        <p className="text-sm text-slate-500">Loading report…</p>
      )}
      {report && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Object.entries({
              Orders: String(report.totalOrders),
              "Gross sales": formatMoney(report.grossSales),
              "Net sales": formatMoney(report.netSales),
              Paid: formatMoney(report.paidTotal),
              Unpaid: formatMoney(report.unpaidTotal),
              "Courier-held COD": formatMoney(report.codOutstanding),
              Refunds: formatMoney(report.refundTotal),
              "Cancellation / return rate": `${(report.cancellationRate * 100).toFixed(1)}% / ${(report.returnRate * 100).toFixed(1)}%`,
            }).map(([k, v]) => (
              <div key={k}>
                <p className="text-xs text-slate-500">{k}</p>
                <p className="mt-1 font-semibold">{v}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">{report.basis}</p>
          <details>
            <summary className="cursor-pointer text-sm font-medium">
              View {period} summary
            </summary>
            <div className="mt-3 max-h-80 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    {["Period", "Orders", "Gross", "Paid", "Refunds"].map(
                      (h) => (
                        <th className="p-2" key={h}>
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {report.summaries.map((r) => (
                    <tr key={r.period} className="border-t">
                      <td className="p-2">{r.period}</td>
                      <td className="p-2">{r.orders}</td>
                      <td className="p-2">{formatMoney(r.grossSales)}</td>
                      <td className="p-2">{formatMoney(r.paidTotal)}</td>
                      <td className="p-2">{formatMoney(r.refundTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!report.summaries.length && (
                <p className="p-3 text-slate-500">No matching orders.</p>
              )}
            </div>
          </details>
        </>
      )}
    </section>
  );
}
