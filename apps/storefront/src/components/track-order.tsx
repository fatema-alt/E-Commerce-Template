"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { shopRequest, type TrackingSnapshot } from "../lib/shop-client";
import { useLiveRefresh } from "../lib/use-live-refresh";
import { LiveTrackingStatus, OrderTracking } from "./order-tracking";

export function TrackOrder() {
  const [tracking, setTracking] = useState<TrackingSnapshot | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const load = useCallback(
    async (signal: AbortSignal) => {
      const result = await shopRequest<TrackingSnapshot>(
        `tracking/${encodeURIComponent(token)}`,
        undefined,
        undefined,
        signal,
      );
      if (!signal.aborted) setTracking(result);
    },
    [token],
  );
  const live = useLiveRefresh(load, Boolean(token));
  return (
    <main
      id="main"
      className="container main-content shopping-page track-order-page"
    >
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link> / Track order
      </nav>
      <header className="shopping-header">
        <h1>Track your order</h1>
        <p className="muted">
          Enter your order number and the phone number used at checkout.
        </p>
      </header>
      <form
        className="shop-panel tracking-lookup"
        onSubmit={async (event) => {
          event.preventDefault();
          if (lock.current) return;
          const form = event.currentTarget;
          const data = new FormData(form);
          lock.current = true;
          setBusy(true);
          setError("");
          setToken("");
          setTracking(null);
          try {
            const result = await shopRequest<{
              trackingToken: string;
              tracking: TrackingSnapshot;
            }>("tracking", {
              orderNumber: String(data.get("orderNumber") || "").trim(),
              phone: String(data.get("phone") || "").trim(),
            });
            setTracking(result.tracking);
            setToken(result.trackingToken);
            const phone = form.elements.namedItem("phone");
            if (phone instanceof HTMLInputElement) phone.value = "";
          } catch (e) {
            setError((e as Error).message);
          } finally {
            lock.current = false;
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="form-grid">
          <label>
            Order number
            <input
              name="orderNumber"
              required
              maxLength={100}
              minLength={3}
              autoComplete="off"
              placeholder="ORD-…"
            />
          </label>
          <label>
            Phone number
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              required
              maxLength={32}
              autoComplete="tel"
              placeholder="01712345678"
            />
          </label>
          <button className="primary-button" type="submit">
            {busy ? "Finding your order…" : "Track order"}
          </button>
        </fieldset>
        {error && (
          <p role="alert" className="shop-error">
            {error}
          </p>
        )}
        <p className="muted small">
          Only delivery progress is shown here.{" "}
          <Link href="/orders">View orders from this browser</Link> or{" "}
          <Link href="/account">sign in</Link> for full order details.
        </p>
      </form>
      {tracking && (
        <>
          <LiveTrackingStatus {...live} />
          <OrderTracking tracking={tracking} />
        </>
      )}
    </main>
  );
}
