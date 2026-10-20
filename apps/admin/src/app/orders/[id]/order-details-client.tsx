"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatDate,
  formatMoney,
  nextStatus,
  orderFetch,
  type OrderDetail,
  StatusPill,
} from "../orders-client";
import {
  Panel,
  PaymentWorkflow,
  ReturnsWorkflow,
  ShipmentWorkflow,
} from "../order-workflows";

export default function OrderDetailsClient() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const pending = useRef<{
    signature: string;
    key: string;
    body: string;
  } | null>(null);
  const loadSequence = useRef(0);
  const load = useCallback(() => {
    const sequence = ++loadSequence.current;
    return Promise.all([
      orderFetch<OrderDetail>(`/orders/${encodeURIComponent(id)}`),
      orderFetch<{ role: string }>("/auth/me"),
    ])
      .then(([result, admin]) => {
        if (sequence !== loadSequence.current) return;
        setOrder(result);
        setRole(admin.role);
        setError("");
      })
      .catch((e: unknown) => {
        if (sequence !== loadSequence.current) return;
        setOrder((existing) => (existing?.id === id ? existing : null));
        setError(e instanceof Error ? e.message : "Could not load order");
      })
      .finally(() => {
        if (sequence === loadSequence.current) setLoading(false);
      });
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  async function act(
    path: string,
    body: object,
    method: "POST" | "PATCH" = "POST",
  ) {
    if (!order || busy) return false;
    const signature = JSON.stringify({ path, body, method });
    if (pending.current?.signature !== signature)
      pending.current = {
        signature,
        key: crypto.randomUUID(),
        body: JSON.stringify({ ...body, version: order.version }),
      };
    const request = pending.current;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const updated = await orderFetch<OrderDetail>(path, {
        method,
        body: request.body,
        headers: { "Idempotency-Key": request.key },
      });
      setOrder(updated);
      pending.current = null;
      setNote("");
      setSuccess("Saved.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (loading || (order !== null && order.id !== id))
    return <main className="p-8 text-slate-500">Loading order…</main>;
  if (!order)
    return (
      <main className="p-8">
        <Link href="/orders">← Orders</Link>
        <p role="alert" className="mt-4 text-red-700">
          {error || "Order not found"}
        </p>
        <button onClick={() => void load()}>Retry</button>
      </main>
    );
  const write = ["ADMIN", "SUPER_ADMIN"].includes(role);
  const next = nextStatus[order.status];
  const canCancel = ["PENDING", "CONFIRMED", "PROCESSING"].includes(
    order.status,
  );
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
      <Link href="/orders" className="text-sm font-medium text-indigo-700">
        ← All orders
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="break-all text-2xl font-bold">{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Placed {formatDate(order.createdAt)} · Version {order.version}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill status={order.status} />
          <button
            disabled={busy}
            onClick={() => {
              pending.current = null;
              void load();
            }}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            Refresh
          </button>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700"
        >
          {success}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Items and totals">
            <div className="divide-y">
              {order.items.map((i) => (
                <div
                  key={i.id}
                  className="flex justify-between gap-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{i.nameSnapshot}</p>
                    <p className="text-slate-500">
                      {i.skuSnapshot} · Qty {i.quantity} ·{" "}
                      {formatMoney(i.unitPrice)} each
                    </p>
                  </div>
                  <span>{formatMoney(i.lineTotal)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t pt-4 text-sm">
              {(
                [
                  ["Subtotal", order.subtotal],
                  ["Shipping", order.shippingTotal],
                  ["Discount", order.discountTotal],
                  ["Tax", order.taxTotal],
                  ["Total", order.grandTotal],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span>{label}</span>
                  <span className="font-semibold">{formatMoney(value)}</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Order workflow">
            {write ? (
              <>
                <p className="text-sm text-slate-500">
                  Dispatch requires a recorded shipment and consumes reserved
                  stock. Confirm delivery after dispatch.
                </p>
                {next && (
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Move this order to ${next}?`))
                        void act(
                          `/orders/${id}/status`,
                          { status: next },
                          "PATCH",
                        );
                    }}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                  >
                    Move to {next.replaceAll("_", " ")}
                  </button>
                )}
                {canCancel && (
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Cancel this order and release reserved stock? Collected payments remain owed until a verified refund is recorded separately.",
                        )
                      )
                        void act(`/orders/${id}/cancel`, {});
                    }}
                    className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-700 disabled:opacity-50"
                  >
                    Cancel order
                  </button>
                )}
                {!next && !canCancel && (
                  <p className="text-sm text-slate-500">
                    Use the shipment or return workflow below.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500">
                STAFF has read-only access.
              </p>
            )}
          </Panel>
          <ShipmentWorkflow order={order} write={write} busy={busy} act={act} />
          <ReturnsWorkflow order={order} write={write} busy={busy} act={act} />
          <PaymentWorkflow
            order={order}
            financial={role === "SUPER_ADMIN"}
            busy={busy}
            act={act}
          />
          <Panel title="Internal notes">
            {write && (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (note.trim())
                    void act(`/orders/${id}/notes`, { body: note.trim() });
                }}
              >
                <textarea
                  aria-label="Internal note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={2000}
                  required
                  rows={3}
                  className="w-full rounded-lg border p-3 text-sm"
                />
                <button
                  disabled={busy || !note.trim()}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  Add note
                </button>
              </form>
            )}
            {!order.notes.length && (
              <p className="text-sm text-slate-500">No notes yet.</p>
            )}
            {order.notes.map((n) => (
              <div key={n.id} className="border-t pt-3">
                <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatDate(n.createdAt)}
                </p>
              </div>
            ))}
          </Panel>
          <Panel title="Audit timeline">
            <ol className="space-y-4 border-l-2 border-slate-100 pl-5">
              {order.events.map((e) => (
                <li key={e.id}>
                  <p className="text-sm font-medium">
                    {e.action.replaceAll("_", " ")}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(e.createdAt)} · {e.actorType} · {e.actorId}
                  </p>
                  {e.after != null && (
                    <pre className="mt-2 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-50 p-2 text-xs">
                      {JSON.stringify(e.after, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
            </ol>
          </Panel>
        </div>
        <aside className="space-y-6">
          <Panel title="Customer snapshot">
            <p className="text-sm font-medium">{order.customerName}</p>
            <p className="text-sm">{order.customerPhone}</p>
            {order.customerEmail && (
              <p className="break-all text-sm">{order.customerEmail}</p>
            )}
            {order.customerNote && (
              <p className="border-t pt-3 text-sm">{order.customerNote}</p>
            )}
          </Panel>
          <Panel title="Address snapshots">
            {order.addresses.map((a) => (
              <div key={a.id} className="text-sm">
                <p className="font-medium">{a.type}</p>
                <p>
                  {a.recipientName} · {a.phone}
                </p>
                <p className="text-slate-600">
                  {[
                    a.line1,
                    a.line2,
                    a.city,
                    a.district,
                    a.division,
                    a.postalCode,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            ))}
          </Panel>
        </aside>
      </div>
    </main>
  );
}
