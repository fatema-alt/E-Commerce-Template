import type { TrackingSnapshot } from "../lib/shop-client";
import { SectionCard, StatusBadge, statusLabel } from "./shopping-ui";

const date = (value: string) =>
  new Date(value).toLocaleString("en-BD", {
    timeZone: "Asia/Dhaka",
    dateStyle: "medium",
    timeStyle: "short",
  });
const steps = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];
export function LiveTrackingStatus({
  lastChecked,
  refreshing,
  error,
  refresh,
}: {
  lastChecked: number | null;
  refreshing: boolean;
  error: string;
  refresh: () => void;
}) {
  return (
    <div className="live-tracking-status">
      <div role="status" aria-live="polite">
        <strong>
          {refreshing
            ? "Checking for updates…"
            : error
              ? "Updates delayed"
              : lastChecked
                ? "Live order updates"
                : "Connecting to tracking…"}
        </strong>
        <span className="muted small">
          {lastChecked
            ? `Last checked ${date(new Date(lastChecked).toISOString())}. `
            : ""}
          Auto-refreshes every 15 seconds while this page is open.
        </span>
        {error && (
          <span className="shop-error small">
            {error} The last received information stays visible.
          </span>
        )}
      </div>
      <button
        type="button"
        className="secondary-button"
        disabled={refreshing}
        onClick={refresh}
      >
        Refresh
      </button>
    </div>
  );
}

export function OrderTracking({ tracking }: { tracking: TrackingSnapshot }) {
  const current = steps.indexOf(tracking.status);
  return (
    <SectionCard title="Live Order Tracking">
      <p className="tracking-reference">{tracking.orderNumber}</p>
      <p>
        Current order status: <StatusBadge status={tracking.status} />
      </p>
      {current >= 0 && (
        <ol className="tracking-steps" aria-label="Order progress">
          {steps.map((step, index) => (
            <li
              key={step}
              className={index <= current ? "is-complete" : ""}
              aria-current={index === current ? "step" : undefined}
            >
              <span aria-hidden="true">
                {index < current ? "✓" : index + 1}
              </span>
              {statusLabel(step)}
            </li>
          ))}
        </ol>
      )}
      {tracking.status === "CANCELLED" && <p>This order has been cancelled.</p>}
      {tracking.status.startsWith("RETURN") && (
        <p>This order is in the return process. Contact support for help.</p>
      )}
      <ol className="order-timeline" aria-label="Recorded tracking history">
        {tracking.timeline.map((event) => (
          <li key={event.id}>
            <span className="timeline-dot" aria-hidden="true" />
            <div>
              <strong>{event.label}</strong>
              <time dateTime={event.at}>{date(event.at)}</time>
            </div>
          </li>
        ))}
      </ol>
      {tracking.shipments.length ? (
        tracking.shipments.map((shipment) => (
          <dl key={shipment.id} className="shipment-details tracking-shipment">
            <div>
              <dt>Courier</dt>
              <dd>{shipment.provider || "Not assigned"}</dd>
            </div>
            <div>
              <dt>Tracking number</dt>
              <dd>{shipment.trackingNumber || "Not assigned yet"}</dd>
            </div>
            <div>
              <dt>Shipment status</dt>
              <dd>{statusLabel(shipment.status)}</dd>
            </div>
            {shipment.courierStatus && (
              <div>
                <dt>Latest courier update</dt>
                <dd>
                  <strong>{statusLabel(shipment.courierStatus)}</strong>
                  {shipment.courierUpdatedAt && (
                    <small>{date(shipment.courierUpdatedAt)}</small>
                  )}
                </dd>
              </div>
            )}
            {shipment.refreshDelayed && (
              <div>
                <dt>Tracking refresh</dt>
                <dd>
                  Courier updates are delayed. Showing the last received status.
                </dd>
              </div>
            )}
          </dl>
        ))
      ) : (
        <p className="muted small">
          A courier and tracking number will appear once your shipment is
          booked.
        </p>
      )}
    </SectionCard>
  );
}
