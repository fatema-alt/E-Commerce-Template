"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  nextStatus,
  orderFetch,
  StatusPill,
  type OrderDetail,
} from "./orders-client";
import { PaymentWorkflow } from "./order-workflows";

export function OrderQuickActions({
  id,
  initialTab,
  onClose,
  onUpdated,
}: {
  id: string;
  initialTab: "status" | "payment";
  onClose: () => void;
  onUpdated: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [role, setRole] = useState("");
  const [tab, setTab] = useState(initialTab);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const attempt = useRef<{
    signature: string;
    key: string;
    body: string;
  } | null>(null);
  useEffect(() => {
    dialog.current?.showModal();
    const abort = new AbortController();
    void Promise.all([
      orderFetch<OrderDetail>(`/orders/${encodeURIComponent(id)}`, {
        signal: abort.signal,
      }),
      orderFetch<{ role?: string; user?: { role: string } }>("/auth/me", {
        signal: abort.signal,
      }),
    ])
      .then(([result, user]) => {
        if (!abort.signal.aborted) {
          setOrder(result);
          setRole(user.user?.role || user.role || "");
        }
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [id]);
  async function act(
    path: string,
    body: object,
    method: "POST" | "PATCH" = "POST",
  ) {
    if (!order || lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const signature = JSON.stringify({
      path,
      body,
      method,
      version: order.version,
    });
    if (attempt.current?.signature !== signature)
      attempt.current = {
        signature,
        key: crypto.randomUUID(),
        body: JSON.stringify({ ...body, version: order.version }),
      };
    try {
      await orderFetch(path, {
        method,
        body: attempt.current.body,
        headers: { "Idempotency-Key": attempt.current.key },
      });
      attempt.current = null;
      onUpdated();
      setOrder(
        await orderFetch<OrderDetail>(`/orders/${encodeURIComponent(id)}`),
      );
      setNotice("Order updated successfully.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update order");
      // Refresh the revision after a concurrent update; never overwrite it.
      try {
        setOrder(
          await orderFetch<OrderDetail>(`/orders/${encodeURIComponent(id)}`),
        );
      } catch {
        /* Keep the error and allow retry. */
      }
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const latest = order?.manualPayments?.[0];
  const next =
    order &&
    !["awaiting_verification", "rejected"].includes(latest?.status || "")
      ? nextStatus[order.status]
      : undefined;
  return (
    <dialog
      ref={dialog}
      aria-labelledby="manage-order-title"
      className="m-auto max-h-[90dvh] w-[min(720px,calc(100%-24px))] overflow-y-auto rounded-2xl border bg-white p-5 text-slate-900 shadow-xl backdrop:bg-black/60"
      onCancel={(event) => {
        if (lock.current) event.preventDefault();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget && !lock.current)
          dialog.current?.close();
      }}
    >
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 id="manage-order-title" className="text-xl font-semibold">
            Manage order
          </h2>
          <p className="mt-1 break-all text-xs text-slate-500">
            {order?.orderNumber || id}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close order actions"
          disabled={busy}
          onClick={() => dialog.current?.close()}
          className="rounded-lg border px-3 py-2"
        >
          Close
        </button>
      </header>
      <div className="mb-4 flex gap-2">
        {(["status", "payment"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
            className={`rounded-lg border px-4 py-2 text-sm ${tab === value ? "bg-indigo-600 text-white" : "bg-white"}`}
          >
            {value === "status" ? "Order status" : "Payment status & review"}
          </button>
        ))}
      </div>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-300 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-emerald-300 p-3 text-sm"
        >
          {notice}
        </p>
      )}
      {!order && !error && <p role="status">Loading order…</p>}
      {order && tab === "status" && (
        <div className="space-y-4">
          <StatusPill status={order.status} />
          {["ADMIN", "SUPER_ADMIN"].includes(role) ? (
            <>
              {next ? (
                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    void act(
                      `/orders/${id}/status`,
                      {
                        status: next,
                        reason:
                          String(form.get("reason") || "").trim() || undefined,
                      },
                      "PATCH",
                    );
                  }}
                >
                  <label className="block text-sm">
                    Next order status
                    <select
                      aria-label="Next order status"
                      className="mt-1 block w-full rounded-lg border p-2"
                      value={next}
                      onChange={() => {}}
                    >
                      <option value={next}>{next.replaceAll("_", " ")}</option>
                    </select>
                  </label>
                  <label className="block text-sm">
                    Update note (optional)
                    <textarea
                      name="reason"
                      rows={2}
                      maxLength={500}
                      className="mt-1 block w-full rounded-lg border p-2"
                    />
                  </label>
                  <button
                    disabled={busy}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-white"
                  >
                    Save order status
                  </button>
                </form>
              ) : (
                <p className="text-sm text-slate-500">
                  {latest?.status === "awaiting_verification" ||
                  latest?.status === "rejected"
                    ? "Verify the payment before confirming this order."
                    : "No further direct status transition is available. Use order details for shipment or return workflows."}
                </p>
              )}
              {["PENDING", "CONFIRMED", "PROCESSING"].includes(
                order.status,
              ) && (
                <button
                  disabled={busy}
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Cancel this order and release stock? Collected payments require a separate refund.",
                      )
                    )
                      void act(`/orders/${id}/cancel`, {});
                  }}
                >
                  Cancel order
                </button>
              )}
            </>
          ) : (
            <p>You have read-only access to this order.</p>
          )}
        </div>
      )}
      {order && tab === "payment" && (
        <PaymentWorkflow
          key={`${order.id}:${order.paymentMethod}`}
          order={order}
          financial={role === "SUPER_ADMIN"}
          busy={busy}
          act={act}
          compact
        />
      )}
      <footer className="mt-5 border-t pt-4">
        <Link
          className="text-sm font-semibold text-indigo-600"
          href={`/orders/${encodeURIComponent(id)}`}
        >
          View full order details →
        </Link>
      </footer>
    </dialog>
  );
}
