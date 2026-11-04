"use client";

import { useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

type Courier = "STEADFAST" | "PATHAO" | "REDX";
type Setting = {
  provider: Courier;
  isEnabled: boolean;
  isSandbox: boolean;
  fields: Record<string, boolean>;
};
const names = { STEADFAST: "Steadfast", PATHAO: "Pathao", REDX: "RedX" };
const labels: Record<string, string> = {
  apiKey: "API key",
  secretKey: "Secret key",
  clientId: "Client ID",
  clientSecret: "Client secret",
  username: "Merchant email / username",
  password: "Password",
  accessToken: "Access token",
};
const base = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1"
).replace(/\/$/, "");
const root =
  (base.endsWith("/api/v1") ? base : `${base}/api/v1`) + "/admin/couriers";
const input =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm";
const button =
  "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
async function api(path = "", method = "GET", body?: unknown) {
  const response = await authenticatedFetch(root + path, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      Array.isArray(result.message)
        ? result.message.join(", ")
        : result.message || "Request failed",
    );
  return result;
}
export default function CouriersPage() {
  const [settings, setSettings] = useState<Setting[] | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    api()
      .then((result: Setting[]) => {
        if (live) {
          setSettings(result);
          setError("");
        }
      })
      .catch((e: Error) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [revision]);
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <header>
        <h1 className="text-2xl font-bold">Courier &amp; Live Tracking</h1>
        <p className="mt-2 text-sm text-slate-500">
          Connect Steadfast, Pathao and RedX to refresh shipment tracking
          automatically. Add each courier&apos;s tracking number when recording
          a shipment.
        </p>
      </header>
      <p className="rounded-xl border bg-white p-4 text-sm text-slate-600">
        Courier updates refresh about once a minute. Customers see updates on
        the Track order page without reloading. Order status, stock and payment
        collection continue to use the existing order workflow.
      </p>
      {error && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setRevision((value) => value + 1)}
          >
            Retry loading couriers
          </button>
        </div>
      )}
      {!settings && !error && <p role="status">Loading couriers…</p>}
      {settings?.map((setting) => (
        <CourierCard key={setting.provider} initial={setting} />
      ))}
    </main>
  );
}
function CourierCard({ initial }: { initial: Setting }) {
  const [saved, setSaved] = useState(initial);
  const [enabled, setEnabled] = useState(initial.isEnabled);
  const [sandbox, setSandbox] = useState(initial.isSandbox);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const name = names[initial.provider];
  return (
    <section className="space-y-4 rounded-xl border bg-white p-5">
      <h2 className="font-semibold">
        {name}{" "}
        <span className="ml-2 text-sm text-slate-500">
          {saved.isEnabled ? "Enabled" : "Disabled"}
        </span>
      </h2>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          setMessage("");
          try {
            const result: Setting = await api(`/${initial.provider}`, "PUT", {
              isEnabled: enabled,
              isSandbox: sandbox,
              credentials,
            });
            setSaved(result);
            setCredentials({});
            setMessage(`${name} tracking settings saved.`);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            Enable automatic tracking
          </label>
          {initial.provider !== "STEADFAST" && (
            <label className="block text-sm">
              Environment
              <select
                className={input}
                value={sandbox ? "sandbox" : "live"}
                onChange={(event) =>
                  setSandbox(event.target.value === "sandbox")
                }
              >
                <option value="sandbox">Sandbox / Test</option>
                <option value="live">Live / Production</option>
              </select>
            </label>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.keys(saved.fields).map((field) => (
              <label key={field} className="block text-sm">
                {labels[field] || field}
                <input
                  className={input}
                  type="password"
                  autoComplete="off"
                  maxLength={2000}
                  required={enabled && !saved.fields[field]}
                  value={credentials[field] || ""}
                  placeholder={
                    saved.fields[field]
                      ? "Saved — leave blank to keep"
                      : "Add merchant credentials"
                  }
                  onChange={(event) =>
                    setCredentials((previous) => ({
                      ...previous,
                      [field]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Credentials are encrypted on the server and never displayed again.
            Leave saved fields blank to keep them.
          </p>
          <button className={button} disabled={busy}>
            {busy ? "Saving…" : `Save ${name}`}
          </button>
        </fieldset>
      </form>
      <form
        className="flex flex-wrap items-end gap-3 border-t pt-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          setMessage("");
          try {
            const result = await api(`/${initial.provider}/test`, "POST", {
              trackingNumber,
            });
            setMessage(
              `Connection successful. Courier status: ${String(result.status).replace(/[_-]/g, " ")}`,
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="min-w-0 flex-1 text-sm">
          Test a saved connection
          <input
            className={input}
            required
            maxLength={120}
            placeholder="Courier tracking number / consignment ID"
            value={trackingNumber}
            onChange={(event) => setTrackingNumber(event.target.value)}
          />
        </label>
        <button
          className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
          disabled={busy || !Object.values(saved.fields).every(Boolean)}
        >
          Test tracking
        </button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-green-700">
          {message}
        </p>
      )}
    </section>
  );
}
