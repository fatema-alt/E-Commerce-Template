"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { safeHref } from "../lib/cms";
import { shopRequest } from "../lib/shop-client";
export function NewsletterPreferences() {
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    shopRequest<{ subscribed: boolean }>("newsletter")
      .then((result) => {
        if (live) setSubscribed(result.subscribed);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <section className="shop-panel">
      <h2>Newsletter preferences</h2>
      <p>
        {subscribed === null
          ? "Loading preference…"
          : subscribed
            ? "You are subscribed to store news."
            : "You are not subscribed."}
      </p>
      {error && (
        <p role="alert" className="shop-error">
          {error}
        </p>
      )}
      <button
        className="secondary-button"
        disabled={busy || subscribed === null}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const result = await shopRequest<{ subscribed: boolean }>(
              "newsletter/preferences",
              { consent: !subscribed },
            );
            setSubscribed(result.subscribed);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Saving…"
          : subscribed
            ? "Unsubscribe"
            : "Subscribe to store news"}
      </button>
    </section>
  );
}
export function Newsletter({
  buttonLabel = "Subscribe",
  consentText = "I agree to receive promotional emails from DS Mart.",
  title,
  description,
  privacyHref = "/help",
}: {
  buttonLabel?: string;
  consentText?: string;
  title?: string;
  description?: string;
  privacyHref?: string;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  // The subscription API records consent; it does not issue a first-order coupon.
  const claimsDiscount = /\d+\s*%|\b\d+\s*(?:off|discount)\b/i.test(
    title || "",
  );
  const heading =
    !title || claimsDiscount ? "Stay in the loop with DS Mart" : title;
  return (
    <div className="newsletter-panel" aria-labelledby={`${id}-heading`}>
      <div className="newsletter-copy">
        <span className="newsletter-eyebrow">EXCLUSIVE MEMBER OFFERS</span>
        <h2 id={`${id}-heading`}>{heading}</h2>
        <p>
          {claimsDiscount || !description
            ? "Discover new arrivals, product updates and member offers when available. Subscribe to hear what’s next."
            : description}
        </p>
        <span className="newsletter-benefit">
          Fresh finds. Store news. All in one place.
        </span>
      </div>
      <form
        className="newsletter-form"
        aria-busy={busy}
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending.current) return;
          const form = event.currentTarget;
          if (!form.reportValidity()) return;
          const fields = new FormData(form);
          pending.current = true;
          setBusy(true);
          setMessage("");
          setError("");
          try {
            const result = await shopRequest<{ message: string }>(
              "newsletter",
              {
                email: String(fields.get("email") || "").trim(),
                consent: fields.get("consent") === "on",
              },
            );
            setMessage(result.message);
            form.reset();
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : "Could not subscribe. Please try again.",
            );
          } finally {
            pending.current = false;
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          <label className="newsletter-email-label" htmlFor={`${id}-email`}>
            Email address
          </label>
          <div className="newsletter-input-row">
            <input
              id={`${id}-email`}
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              placeholder="you@example.com"
              required
              aria-describedby={`${id}-consent`}
            />
            <button type="submit">{busy ? "Subscribing…" : buttonLabel}</button>
          </div>
          <label className="newsletter-consent" id={`${id}-consent`}>
            <input type="checkbox" name="consent" required />
            <span>
              {consentText ||
                "I agree to receive promotional emails from DS Mart."}
            </span>
          </label>
          {safeHref(privacyHref) && (
            <Link className="newsletter-privacy" href={safeHref(privacyHref)!}>
              Privacy information
            </Link>
          )}
        </fieldset>
        {message && (
          <p role="status" className="newsletter-success">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="newsletter-error">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
