"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { formatMoney, type OrderDetail } from "./orders-client";

export type OrderAction = (
  path: string,
  body: object,
  method?: "POST" | "PATCH",
) => Promise<boolean>;
const inputClass = "mt-1 block w-full rounded-lg border px-3 py-2 text-sm";
export function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
function Field({
  name,
  label,
  type = "text",
  required = true,
  min,
  max,
  step,
  maxLength = 500,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: string;
  maxLength?: number;
}) {
  return (
    <label className="block text-sm text-slate-600">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        min={min}
        max={max}
        step={step}
        maxLength={maxLength}
        className={inputClass}
      />
    </label>
  );
}
function Submit({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button
      disabled={busy}
      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
    >
      {children}
    </button>
  );
}
function data(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  return new FormData(e.currentTarget);
}
const text = (f: FormData, key: string) => String(f.get(key) ?? "").trim();

export function ShipmentWorkflow({
  order,
  write,
  busy,
  act,
}: {
  order: OrderDetail;
  write: boolean;
  busy: boolean;
  act: OrderAction;
}) {
  const root = `/orders/${order.id}`;
  return (
    <Panel title="Shipment management">
      <p className="text-xs text-slate-500">
        Manual records document a booking made with the courier. No courier API
        booking is performed.
      </p>
      {!order.shipments.length && (
        <p className="text-sm text-slate-500">No shipment recorded.</p>
      )}
      {order.shipments.map((s) => (
        <div key={s.id} className="space-y-2 rounded-lg border p-3 text-sm">
          <p className="font-semibold">
            {s.provider} · {s.status.replaceAll("_", " ")}
          </p>
          <p>Tracking: {s.trackingNumber}</p>
          <p>
            Cost: {formatMoney(s.shippingCost)} · Weight:{" "}
            {s.parcelWeightKg ?? "—"} kg
          </p>
          {s.parcelDetails && <p>{s.parcelDetails}</p>}
          <p>
            COD collected {formatMoney(s.codCollected)} · Settled{" "}
            {formatMoney(s.codSettled)} · Fees {formatMoney(s.codFees)}
          </p>
          {write &&
            ["MANUAL_BOOKED", "IN_TRANSIT", "FAILED"].includes(s.status) && (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  const f = data(e);
                  if (
                    window.confirm(`Record shipment as ${text(f, "status")}?`)
                  )
                    void act(
                      `${root}/shipments/${s.id}`,
                      { status: text(f, "status"), note: text(f, "note") },
                      "PATCH",
                    );
                }}
              >
                <label className="block">
                  New status
                  <select name="status" className={inputClass}>
                    {(s.status === "MANUAL_BOOKED"
                      ? ["IN_TRANSIT", "CANCELLED"]
                      : s.status === "IN_TRANSIT"
                        ? ["DELIVERED", "FAILED"]
                        : ["IN_TRANSIT"]
                    ).map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <Field
                  name="note"
                  label="Shipment update / delivery confirmation note (min 5 characters)"
                />
                <Submit busy={busy}>Update shipment</Submit>
              </form>
            )}
        </div>
      ))}
      {write &&
        ["CONFIRMED", "PROCESSING"].includes(order.status) &&
        !order.shipments.some((s) => s.status !== "CANCELLED") && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              const form = e.currentTarget;
              const f = data(e);
              void act(`${root}/shipments/manual`, {
                provider: text(f, "provider"),
                trackingNumber: text(f, "trackingNumber"),
                ...(text(f, "providerBookingId")
                  ? { providerBookingId: text(f, "providerBookingId") }
                  : {}),
                ...(text(f, "parcelWeightKg")
                  ? { parcelWeightKg: Number(text(f, "parcelWeightKg")) }
                  : {}),
                ...(text(f, "shippingCost")
                  ? { shippingCost: Number(text(f, "shippingCost")) }
                  : {}),
                ...(text(f, "parcelDetails")
                  ? { parcelDetails: text(f, "parcelDetails") }
                  : {}),
              }).then((ok) => {
                if (ok) form.reset();
              });
            }}
          >
            <Field name="provider" label="Courier provider" maxLength={80} />
            <Field
              name="trackingNumber"
              label="Tracking number"
              maxLength={120}
            />
            <Field
              name="providerBookingId"
              label="Booking reference"
              required={false}
              maxLength={120}
            />
            <Field
              name="parcelWeightKg"
              label="Parcel weight (kg)"
              type="number"
              min={0}
              step="0.001"
              required={false}
            />
            <Field
              name="shippingCost"
              label="Actual shipping cost (BDT)"
              type="number"
              min={0}
              step="0.01"
              required={false}
            />
            <Field
              name="parcelDetails"
              label="Parcel details"
              required={false}
            />
            <Submit busy={busy}>Record manual shipment</Submit>
          </form>
        )}
    </Panel>
  );
}

export function ReturnsWorkflow({
  order,
  write,
  busy,
  act,
}: {
  order: OrderDetail;
  write: boolean;
  busy: boolean;
  act: OrderAction;
}) {
  const root = `/orders/${order.id}`;
  return (
    <Panel title="Returns and inspection">
      <p className="text-xs text-slate-500">
        Select item quantities, approve the request, then record physical
        receipt and inspection. Only sellable received stock is restocked.
        Refunds are recorded separately.
      </p>
      {write && order.status === "DELIVERED" && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            const f = data(e);
            const items = order.items
              .map((i) => ({
                orderItemId: i.id,
                quantity: Number(f.get(i.id)),
              }))
              .filter((i) => i.quantity > 0);
            if (!items.length) return;
            void act(`${root}/returns/request`, {
              reason: text(f, "reason"),
              items,
            });
          }}
        >
          {order.items.map((i) => {
            const received = order.returns
              .filter((r) => r.status === "RECEIVED")
              .flatMap((r) => r.items)
              .filter((r) => r.orderItemId === i.id)
              .reduce((n, r) => n + r.receivedQuantity, 0);
            return (
              <label key={i.id} className="block text-sm">
                {i.nameSnapshot} — remaining {i.quantity - received}
                <input
                  name={i.id}
                  type="number"
                  defaultValue={0}
                  min={0}
                  max={i.quantity - received}
                  className={inputClass}
                />
              </label>
            );
          })}
          <Field name="reason" label="Return reason (min 5 characters)" />
          <Submit busy={busy}>Request return</Submit>
        </form>
      )}
      {!order.returns.length && (
        <p className="text-sm text-slate-500">No returns.</p>
      )}
      {order.returns.map((r) => (
        <div key={r.id} className="space-y-3 rounded-lg border p-4">
          <p className="text-sm font-semibold">
            {r.status} · {r.reason}
          </p>
          {r.adminNote && (
            <p className="text-sm text-slate-600">{r.adminNote}</p>
          )}
          {r.items.map((i) => (
            <p key={i.orderItemId} className="text-sm">
              {order.items.find((x) => x.id === i.orderItemId)?.nameSnapshot} ·
              Requested {i.quantity} · Received {i.receivedQuantity} · Sellable{" "}
              {i.sellableQuantity} · Restocked {i.restockedQuantity} · Eligible{" "}
              {formatMoney(i.refundableAmount)}
            </p>
          ))}
          {write && r.status === "REQUESTED" && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                const f = data(e);
                void act(`${root}/returns/${r.id}/decision`, {
                  approved: text(f, "decision") === "approve",
                  note: text(f, "note"),
                });
              }}
            >
              <label className="block text-sm">
                Decision
                <select name="decision" className={inputClass}>
                  <option value="approve">Approve</option>
                  <option value="reject">Reject</option>
                </select>
              </label>
              <Field name="note" label="Decision note (min 5 characters)" />
              <Submit busy={busy}>Save decision</Submit>
            </form>
          )}
          {write && r.status === "APPROVED" && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                const f = data(e);
                if (
                  window.confirm(
                    "Confirm these quantities were physically received and inspected? This restocks sellable goods once.",
                  )
                )
                  void act(`${root}/returns/${r.id}/receive`, {
                    note: text(f, "note"),
                    items: r.items.map((i) => ({
                      orderItemId: i.orderItemId,
                      receivedQuantity: Number(
                        f.get(`${i.orderItemId}-received`),
                      ),
                      sellableQuantity: Number(
                        f.get(`${i.orderItemId}-sellable`),
                      ),
                    })),
                  });
              }}
            >
              {r.items.map((i) => (
                <div key={i.orderItemId} className="grid gap-3 sm:grid-cols-2">
                  <Field
                    name={`${i.orderItemId}-received`}
                    label={`Received: ${order.items.find((x) => x.id === i.orderItemId)?.nameSnapshot}`}
                    type="number"
                    min={0}
                    max={i.quantity}
                  />
                  <Field
                    name={`${i.orderItemId}-sellable`}
                    label="Sellable quantity"
                    type="number"
                    min={0}
                    max={i.quantity}
                  />
                </div>
              ))}
              <Field name="note" label="Inspection note (min 5 characters)" />
              <Submit busy={busy}>Confirm receipt and restock</Submit>
            </form>
          )}
        </div>
      ))}
    </Panel>
  );
}

export function PaymentWorkflow({
  order,
  financial,
  busy,
  act,
}: {
  order: OrderDetail;
  financial: boolean;
  busy: boolean;
  act: OrderAction;
}) {
  const [kind, setKind] = useState(
    order.paymentMethod === "COD" ? "COD_COLLECTION" : "MANUAL_VERIFIED",
  );
  return (
    <Panel title="Payment and COD accounting">
      <p className="text-sm">
        {order.paymentMethod} · {order.paymentStatus.replaceAll("_", " ")}
      </p>
      <p className="text-sm">
        Paid {formatMoney(order.paidTotal)} · Refunded{" "}
        {formatMoney(order.refundedTotal)} · Refund eligible{" "}
        {formatMoney(order.refundableBalance)}
      </p>
      <p className="text-xs text-slate-500">
        Entries record manually verified evidence of completed transfers. They
        do not execute a payment or refund and are never gateway verified.
      </p>
      {financial && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            const form = e.currentTarget;
            const f = data(e);
            if (
              !window.confirm(
                "Confirm you independently verified this completed transfer and the amount, reference and evidence are correct?",
              )
            )
              return;
            void act(`/orders/${order.id}/payments`, {
              kind,
              amount: text(f, "amount"),
              provider: text(f, "provider"),
              reference: text(f, "reference"),
              evidence: text(f, "evidence"),
              ...(["COD_COLLECTION", "COD_SETTLEMENT"].includes(kind)
                ? { shipmentId: text(f, "shipmentId") }
                : {}),
              ...(kind === "COD_SETTLEMENT"
                ? { fee: text(f, "fee") || "0" }
                : {}),
            }).then((ok) => {
              if (ok) form.reset();
            });
          }}
        >
          <label className="block text-sm">
            Accounting action
            <select
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className={inputClass}
            >
              {(order.paymentMethod === "COD"
                ? ["COD_COLLECTION", "COD_SETTLEMENT", "REFUND_RECORDED"]
                : ["MANUAL_VERIFIED", "REFUND_RECORDED"]
              ).map((x) => (
                <option key={x} value={x}>
                  {x.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          {["COD_COLLECTION", "COD_SETTLEMENT"].includes(kind) && (
            <label className="block text-sm">
              Shipment
              <select name="shipmentId" required className={inputClass}>
                <option value="">Choose shipment</option>
                {order.shipments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.provider} · {s.trackingNumber}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Field
            name="amount"
            label={
              kind === "COD_SETTLEMENT"
                ? "Net remitted amount (BDT)"
                : "Completed transfer amount (BDT)"
            }
            type="number"
            min={0.01}
            step="0.01"
          />
          {kind === "COD_SETTLEMENT" && (
            <Field
              name="fee"
              label="Courier withheld fees (BDT)"
              type="number"
              min={0}
              step="0.01"
              required={false}
            />
          )}
          <Field
            name="provider"
            label="Bank / mobile service / courier"
            maxLength={80}
          />
          <Field
            name="reference"
            label="Unique transfer / settlement reference"
            maxLength={120}
          />
          <Field
            name="evidence"
            label="Independent verification evidence (min 10 characters; no secrets)"
          />
          <Submit busy={busy}>Record verified accounting entry</Submit>
        </form>
      )}
      {!financial && (
        <p className="text-xs text-slate-500">
          Financial entries require SUPER_ADMIN.
        </p>
      )}
      <div className="divide-y">
        {!order.payments.length && (
          <p className="text-sm text-slate-500">No transactions.</p>
        )}
        {order.payments.map((p) => (
          <div key={p.id} className="py-3 text-sm">
            <p className="font-medium">
              {p.metadata?.kind ?? p.type} · {p.status} ·{" "}
              {formatMoney(p.amount)}
            </p>
            <p className="text-xs text-slate-500">
              {p.provider} · {p.providerReference} ·{" "}
              {p.metadata?.verification ?? "Unspecified verification"}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}
