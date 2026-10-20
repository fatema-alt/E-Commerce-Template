"use client";
import { useEffect, useState } from "react";
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
  buttonLabel,
  consentText,
}: {
  buttonLabel: string;
  consentText: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return (
    <form
      className="newsletter-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        setBusy(true);
        setError("");
        setMessage("");
        try {
          const result = await shopRequest<{ message: string }>("newsletter", {
            email: data.get("email"),
            consent: data.get("consent") === "on",
          });
          setMessage(result.message);
          form.reset();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>
        <label>
          Email address
          <input
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            placeholder="you@example.com"
            required
          />
        </label>
        <label className="consent-row">
          <input type="checkbox" name="consent" required />
          {consentText}
        </label>
        <button className="primary-button">
          {busy ? "Saving…" : buttonLabel}
        </button>
      </fieldset>
      {message && (
        <p role="status" className="shop-success">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="shop-error">
          {error}
        </p>
      )}
    </form>
  );
}
