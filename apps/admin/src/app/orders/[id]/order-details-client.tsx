"use client";
import "../order-detail.css";
import { useToastState } from "@/components/admin/toast-provider";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCopy,
  CreditCard,
  FileText,
  MapPin,
  MessageCircle,
  Phone,
  Printer,
  RefreshCw,
  ShoppingBag,
  Truck,
  UserRound,
  Wallet,
  AlertCircle,
} from "lucide-react";
import {
  InfoRows,
  OrderBadge,
  OrderCard,
  OrderInsights,
  OrderItems,
  OrderTimeline,
  PaymentOverview,
  orderMethodLabel,
  readable,
} from "../order-detail-sections";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatDate,
  formatMoney,
  nextStatus,
  orderFetch,
  type OrderDetail,
} from "../orders-client";
import { ReturnsWorkflow, ShipmentWorkflow } from "../order-workflows";

export default function OrderDetailsClient() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [role, setRole] = useState("");
  const [error, setError] = useToastState("error");
  const [, setSuccess] = useToastState("success");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [courierOpen, setCourierOpen] = useState(false);
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
      orderFetch<{ role?: string; user?: { role: string } }>("/auth/me"),
    ])
      .then(([result, admin]) => {
        if (sequence !== loadSequence.current) return;
        setOrder(result);
        setLoadedAt(Date.now());
        setRole(admin.user?.role || admin.role || "");
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
  }, [id, setError]);
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
      await orderFetch<OrderDetail>(path, {
        method,
        body: request.body,
        headers: { "Idempotency-Key": request.key },
      });
      setOrder(
        await orderFetch<OrderDetail>(`/orders/${encodeURIComponent(id)}`),
      );
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
    return (
      <main className="order-detail-v2">
        <div className="od-loading">Loading order details…</div>
      </main>
    );
  if (!order)
    return (
      <main className="order-detail-v2">
        <Link className="od-back" href="/orders">
          <ArrowLeft size={15} /> All orders
        </Link>
        <div className="od-notice od-notice-danger" role="alert">
          {error || "Order not found"}
        </div>
        <button className="od-button" onClick={() => void load()}>
          Try again
        </button>
      </main>
    );
  const write = ["ADMIN", "SUPER_ADMIN"].includes(role);
  const latest = order.manualPayments?.[0];
  const awaiting = latest?.status === "awaiting_verification";
  const next =
    awaiting || latest?.status === "rejected"
      ? undefined
      : nextStatus[order.status];
  const canCancel = ["PENDING", "CONFIRMED", "PROCESSING"].includes(
    order.status,
  );
  const shipping =
    order.addresses.find((address) => address.type === "SHIPPING") ||
    order.addresses[0];
  const shipment =
    order.shipments.find((item) => item.status !== "CANCELLED") ||
    order.shipments[0];
  const address = shipping
    ? [
        shipping.line1,
        shipping.line2,
        shipping.city,
        shipping.district,
        shipping.division,
        shipping.postalCode,
      ]
        .filter(Boolean)
        .join(", ")
    : "No shipping address recorded";
  const digits = order.customerPhone.replace(/\D/g, "");
  const whatsapp = digits.startsWith("01") ? "88" + digits : digits;
  const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const hoursAgo = Math.max(
    0,
    Math.floor((loadedAt - Date.parse(order.createdAt)) / 3600000),
  );
  const age =
    hoursAgo < 1
      ? "Less than an hour ago"
      : hoursAgo < 24
        ? `${hoursAgo} hours ago`
        : `${Math.floor(hoursAgo / 24)} days ago`;
  const openCourier = () => {
    setCourierOpen(true);
    requestAnimationFrame(() =>
      document
        .getElementById("order-courier")
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };
  return (
    <main className="order-detail-v2">
      <Link className="od-back od-no-print" href="/orders">
        <ArrowLeft size={15} /> All orders
      </Link>
      <header className="od-hero">
        <div>
          <p className="od-eyebrow">ORDER DETAILS</p>
          <h1 title={order.orderNumber}>
            Order{" "}
            {/^[a-z]+-[a-f0-9]{8}-[a-f0-9-]{27}$/i.test(order.orderNumber)
              ? order.id.slice(-8).toUpperCase()
              : order.orderNumber}
          </h1>
          <p className="od-order-meta">
            {formatDate(order.createdAt)}
            <span>·</span>
            {age}
            <span>·</span>
            {units} {units === 1 ? "item" : "items"}
          </p>
        </div>
        <div className="od-header-badges">
          <OrderBadge value={order.status}>
            Order: {readable(order.status)}
          </OrderBadge>
          <OrderBadge value={order.paymentStatus}>
            Payment: {readable(order.paymentStatus)}
          </OrderBadge>
          <OrderBadge value="method">{orderMethodLabel(order)}</OrderBadge>
        </div>
      </header>
      <div className="od-actions od-no-print">
        <a className="od-button" href={`tel:${order.customerPhone}`}>
          <Phone size={15} />
          Call
        </a>
        <a
          className="od-button"
          href={`https://wa.me/${whatsapp}`}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle size={15} />
          WhatsApp
          <ArrowUpRight size={12} />
        </a>
        <button
          className="od-button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                [
                  `Order: ${order.orderNumber}`,
                  `Customer: ${order.customerName}`,
                  `Phone: ${order.customerPhone}`,
                  `Address: ${address}`,
                  `COD to collect: ${formatMoney(order.amountDueOnDelivery)}`,
                ].join("\n"),
              );
              setSuccess("Courier details copied.");
            } catch {
              setError(
                "Could not copy. Select the shipping details and copy them manually.",
              );
            }
          }}
        >
          <ClipboardCopy size={15} />
          Copy courier details
        </button>
        <button className="od-button od-button-primary" onClick={openCourier}>
          <Truck size={15} />
          Courier details
        </button>
        <button className="od-button" onClick={() => window.print()}>
          <Printer size={15} />
          Print
        </button>
        <button
          className="od-button od-refresh"
          disabled={busy}
          onClick={() => {
            pending.current = null;
            void load();
          }}
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>
      <div className="od-stat-grid">
        {[
          {
            label: "Order total",
            value: order.grandTotal,
            icon: <ShoppingBag size={18} />,
            tone: "violet",
          },
          {
            label: "Amount paid",
            value: order.paidTotal,
            icon: <CheckCircle2 size={18} />,
            tone: "green",
          },
          {
            label: "Due now",
            value:
              order.amountDueNow ??
              (latest?.status === "confirmed" ? 0 : latest?.amountDueNow),
            icon: <Wallet size={18} />,
            tone: "amber",
          },
          {
            label: "Due on delivery",
            value: order.amountDueOnDelivery,
            icon: <Truck size={18} />,
            tone: "blue",
          },
        ].map((stat) => (
          <div className="od-stat" key={stat.label}>
            <span className={`od-stat-icon od-icon-${stat.tone}`}>
              {stat.icon}
            </span>
            <div>
              <p>{stat.label}</p>
              <strong>{formatMoney(stat.value)}</strong>
            </div>
          </div>
        ))}
      </div>
      {awaiting ? (
        <div className="od-notice">
          <AlertCircle size={19} />
          <div>
            <strong>Payment awaiting verification</strong>
            <p>
              {orderMethodLabel(order)} reference {latest.reference} has been
              submitted. Verify the receipt before confirming payment or
              dispatching this order.
            </p>
          </div>
          <a href={`/orders?manage=${encodeURIComponent(id)}`}>
            Review payment →
          </a>
        </div>
      ) : latest?.status === "rejected" ? (
        <div className="od-notice od-notice-danger">
          <AlertCircle size={19} />
          <div>
            <strong>Payment reference rejected</strong>
            <p>
              {latest.rejectReason ||
                "The customer can submit a new reference from their order page."}
            </p>
          </div>
        </div>
      ) : order.paymentStatus === "UNPAID" && order.paymentMethod !== "COD" ? (
        <div className="od-notice">
          <CreditCard size={19} />
          <div>
            <strong>Payment has not been confirmed</strong>
            <p>Check the payment details below before preparing this order.</p>
          </div>
        </div>
      ) : null}
      <div className="od-main-grid">
        <div className="od-stack od-main-column">
          <OrderItems order={order} />
          <div id="order-payment">
            <PaymentOverview order={order} />
          </div>
          <Link
            className="od-button od-no-print"
            href={`/orders?manage=${encodeURIComponent(id)}`}
          >
            Manage payment in All Orders
          </Link>
          <details className="od-workflow">
            <summary>
              <span>Order timeline</span>
              <small>{order.events.length} events</small>
            </summary>
            <OrderTimeline order={order} />
          </details>

          <OrderCard
            title="Notes"
            icon={<FileText size={17} />}
            aside={
              <span className="od-muted od-small">
                {order.notes.length} internal notes
              </span>
            }
          >
            <div className="od-customer-note">
              <span className="od-eyebrow">CUSTOMER NOTE</span>
              <p>{order.customerNote || "No customer note provided."}</p>
            </div>
            {order.notes.map((item) => (
              <article className="od-note" key={item.id}>
                <p>{item.body}</p>
                <time dateTime={item.createdAt}>
                  {formatDate(item.createdAt)}
                </time>
              </article>
            ))}
            {write && (
              <form
                className="od-note-form od-no-print"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (note.trim())
                    void act(`/orders/${id}/notes`, { body: note.trim() });
                }}
              >
                <label htmlFor="order-internal-note">
                  Add an internal note
                </label>
                <textarea
                  id="order-internal-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={2000}
                  required
                  rows={3}
                  placeholder="Add a note for your team…"
                />
                <div>
                  <span className="od-muted od-small">
                    Only visible to your team
                  </span>
                  <button
                    className="od-button od-button-primary"
                    disabled={busy || !note.trim()}
                  >
                    Add note
                  </button>
                </div>
              </form>
            )}
          </OrderCard>
          <details
            className="od-workflow od-no-print"
            open={order.returns.length > 0 || undefined}
          >
            <summary>
              <PackageIcon />
              <span>Returns & item changes</span>
              <small>
                {order.returns.length
                  ? `${order.returns.length} return records`
                  : "Manage returned items"}
              </small>
            </summary>
            <p className="od-muted od-small od-workflow-explanation">
              Use the return workflow for existing items. Product replacement is
              not available as a direct edit to this order.
            </p>
            <ReturnsWorkflow
              order={order}
              write={write}
              busy={busy}
              act={act}
            />
          </details>
        </div>
        <aside className="od-stack od-rail">
          <OrderCard title="Customer" icon={<UserRound size={17} />}>
            <div className="od-customer-identity">
              <span className="od-avatar">
                {order.customerName
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()}
              </span>
              <div>
                <h3>{order.customerName}</h3>
                <a href={`tel:${order.customerPhone}`}>{order.customerPhone}</a>
              </div>
            </div>
            <InfoRows
              rows={[
                [
                  "Email",
                  order.customerEmail ? (
                    <a href={`mailto:${order.customerEmail}`}>
                      {order.customerEmail}
                    </a>
                  ) : (
                    "Not provided"
                  ),
                ],
                [
                  "Phone history",
                  order.customerHistory
                    ? `${order.customerHistory.total} orders · ${order.customerHistory.delivered} delivered · ${order.customerHistory.cancelled} cancelled · ${order.customerHistory.returned} returned`
                    : "Not available",
                ],
              ]}
            />
          </OrderCard>
          <OrderCard
            title="Shipping"
            icon={<MapPin size={17} />}
            aside={
              <OrderBadge value="location">
                {Number(order.shippingTotal) === 0
                  ? "Free delivery"
                  : shipping?.district || shipping?.city || "Not recorded"}
              </OrderBadge>
            }
          >
            <InfoRows
              rows={[
                ["Recipient", shipping?.recipientName || order.customerName],
                ["Phone", shipping?.phone || order.customerPhone],
                ["Address", address],
                [
                  "District / city",
                  shipping
                    ? [shipping.district, shipping.city]
                        .filter(Boolean)
                        .join(" / ")
                    : undefined,
                ],
                ["Division / area", shipping?.division],
                ["Postal code", shipping?.postalCode],
                ["Delivery charge", formatMoney(order.shippingTotal)],
                ["Courier", shipment?.provider],
                ["Tracking number", shipment?.trackingNumber],
              ]}
            />
            {order.addresses
              .filter((item) => item !== shipping)
              .map((item) => (
                <JsonAddress key={item.id} address={item} />
              ))}
          </OrderCard>
          <details
            id="order-courier"
            className="od-workflow od-no-print"
            open={courierOpen}
            onToggle={(event) => setCourierOpen(event.currentTarget.open)}
          >
            <summary>
              <Truck size={16} />
              <span>Courier</span>
              <OrderBadge value={shipment?.status || "Not booked"} />
            </summary>
            <div className="od-workflow-explanation">
              <InfoRows
                rows={[
                  ["Courier", shipment?.provider || "Not booked"],
                  [
                    "Tracking number",
                    shipment?.trackingNumber || "Not assigned",
                  ],
                  [
                    "Parcel weight",
                    shipment?.parcelWeightKg
                      ? `${shipment.parcelWeightKg} kg`
                      : "Not recorded",
                  ],
                  ["Courier note", shipment?.parcelDetails || "None"],
                  ["COD to collect", formatMoney(order.amountDueOnDelivery)],
                ]}
              />
            </div>
            {awaiting || latest?.status === "rejected" ? (
              <p className="od-workflow-explanation od-muted od-small">
                Verify the advance payment before recording a shipment.
              </p>
            ) : null}
            <ShipmentWorkflow
              order={order}
              write={write && !awaiting && latest?.status !== "rejected"}
              busy={busy}
              act={act}
            />
          </details>
          <OrderCard
            title="Update order"
            icon={<RefreshCw size={17} />}
            className="od-no-print"
          >
            <InfoRows
              rows={[
                [
                  "Order status",
                  <OrderBadge key="order" value={order.status} />,
                ],
                [
                  "Payment status",
                  <OrderBadge key="payment" value={order.paymentStatus} />,
                ],
                [
                  "Advance status",
                  readable(
                    latest?.status ||
                      (order.paymentMethod === "COD"
                        ? "No advance"
                        : "Not recorded"),
                  ),
                ],
              ]}
            />
            {write ? (
              <>
                {next ? (
                  <form
                    className="od-status-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      if (
                        window.confirm(`Move this order to ${readable(next)}?`)
                      )
                        void act(
                          `/orders/${id}/status`,
                          {
                            status: next,
                            ...(String(data.get("reason") || "").trim()
                              ? { reason: String(data.get("reason")).trim() }
                              : {}),
                          },
                          "PATCH",
                        );
                    }}
                  >
                    <label>
                      Next order status
                      <select
                        defaultValue={next}
                        aria-label="Next order status"
                      >
                        <option value={next}>{readable(next)}</option>
                      </select>
                    </label>
                    <label>
                      Update note (optional)
                      <textarea
                        name="reason"
                        rows={2}
                        maxLength={500}
                        placeholder="Reason for this update"
                      />
                    </label>
                    <button
                      className="od-button od-button-primary"
                      disabled={busy}
                    >
                      Save changes
                    </button>
                  </form>
                ) : (
                  <p className="od-empty">
                    {awaiting || latest?.status === "rejected"
                      ? "Verify the payment before confirming this order."
                      : "No further order status update is available here."}
                  </p>
                )}
                <p className="od-muted od-small">
                  Payment changes use verified payment actions. Courier and
                  tracking updates are in the Courier section.
                </p>
                {canCancel && (
                  <button
                    className="od-button od-button-danger"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Cancel this order and release reserved stock? Any collected payment must be refunded separately.",
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
              <p className="od-empty">
                You have read-only access to this order.
              </p>
            )}
          </OrderCard>
        </aside>
      </div>
      <details className="od-workflow od-no-print">
        <summary>
          <span>Source, verification & technical details</span>
          <small>View saved information</small>
        </summary>
        <div className="od-context-heading">
          <div>
            <p className="od-eyebrow">BEHIND THE ORDER</p>
            <h2>Source & verification</h2>
          </div>
          <p>Attribution, tracking and saved technical details</p>
        </div>
        <OrderInsights order={order} />
      </details>
      <p className="od-footer">
        Order ID <span className="od-mono">{order.id}</span> · Revision{" "}
        {order.version}
        {order.updatedAt && ` · Updated ${formatDate(order.updatedAt)}`}
      </p>
    </main>
  );
}

function PackageIcon() {
  return <ShoppingBag size={16} />;
}
function JsonAddress({
  address,
}: {
  address: OrderDetail["addresses"][number];
}) {
  return (
    <details className="od-json">
      <summary>{readable(address.type)} address</summary>
      <pre>{JSON.stringify(address, null, 2)}</pre>
    </details>
  );
}
