"use client";

import { useEffect, useState } from "react";

type Gateway = {
  provider: "BKASH" | "SSLCOMMERZ";
  isSandbox: boolean;
  isEnabled: boolean;
  config: Record<string, string | boolean>;
};
type Request = (
  path: string,
  method?: string,
  body?: unknown,
) => Promise<unknown>;
const definitions = [
  {
    provider: "SSLCOMMERZ",
    title: "SSLCommerz API",
    fields: [
      { key: "storeId", label: "Store ID", saved: "" },
      {
        key: "storePassword",
        label: "Store password",
        saved: "hasStorePassword",
      },
    ],
  },
  {
    provider: "BKASH",
    title: "bKash API",
    fields: [
      { key: "appKey", label: "App key", saved: "" },
      { key: "appSecret", label: "App secret", saved: "hasAppSecret" },
      { key: "username", label: "Username", saved: "" },
      { key: "password", label: "Password", saved: "hasPassword" },
    ],
  },
] as const;
const input =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm";

export default function ApiGatewaySettings({ request }: { request: Request }) {
  const [gateways, setGateways] = useState<Gateway[] | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let live = true;
    request("/admin/payments/settings")
      .then((result) => {
        if (live) {
          setGateways((result as { gateways: Gateway[] }).gateways);
          setError("");
        }
      })
      .catch((e: Error) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [request, revision]);

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        Add your merchant API credentials, enable the gateway and save to show
        it at checkout. Disable and save to remove it. Use Sandbox to test
        before switching to Live.
      </p>
      {error ? (
        <div
          role="alert"
          className="space-y-2 rounded-lg bg-red-50 p-3 text-red-700"
        >
          <p>{error}</p>
          <button
            type="button"
            className="rounded border px-3 py-2"
            onClick={() => setRevision((value) => value + 1)}
          >
            Retry loading gateways
          </button>
        </div>
      ) : !gateways ? (
        <p role="status">Loading API settings...</p>
      ) : (
        definitions.map((definition) => {
          const gateway = gateways.find(
            (row) => row.provider === definition.provider,
          );
          return gateway ? (
            <GatewayForm
              key={gateway.provider}
              gateway={gateway}
              definition={definition}
              request={request}
            />
          ) : (
            <p role="alert" key={definition.provider}>
              {definition.title} settings are unavailable.
            </p>
          );
        })
      )}
    </div>
  );
}

function GatewayForm({
  gateway,
  definition,
  request,
}: {
  gateway: Gateway;
  definition: (typeof definitions)[number];
  request: Request;
}) {
  const [config, setConfig] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      definition.fields.map((field) => [
        field.key,
        field.saved ? "" : String(gateway.config[field.key] || ""),
      ]),
    ),
  );
  const [savedConfig, setSavedConfig] = useState(gateway.config);
  const [isSandbox, setIsSandbox] = useState(gateway.isSandbox);
  const [isEnabled, setIsEnabled] = useState(gateway.isEnabled);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  return (
    <form
      className="space-y-4 rounded-xl border bg-white p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        setMessage("");
        try {
          await request(`/admin/payments/settings/${gateway.provider}`, "PUT", {
            isSandbox,
            isEnabled,
            config,
          });
          setSavedConfig((previous) => ({
            ...previous,
            ...Object.fromEntries(
              definition.fields
                .filter((field) => field.saved && config[field.key])
                .map((field) => [field.saved, true]),
            ),
          }));
          setConfig((previous) => ({
            ...previous,
            ...Object.fromEntries(
              definition.fields
                .filter((field) => field.saved)
                .map((field) => [field.key, ""]),
            ),
          }));
          setMessage(`${definition.title} settings saved.`);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="font-semibold">{definition.title}</h2>
      <fieldset disabled={busy} className="space-y-4">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(event) => setIsEnabled(event.target.checked)}
          />
          Enable at checkout
        </label>
        <label className="block text-sm">
          Environment
          <select
            className={input}
            value={isSandbox ? "sandbox" : "live"}
            onChange={(event) => setIsSandbox(event.target.value === "sandbox")}
          >
            <option value="sandbox">Sandbox / Test</option>
            <option value="live">Live / Production</option>
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          {definition.fields.map((field) => (
            <label key={field.key} className="block text-sm">
              {field.label}
              <input
                className={input}
                type={field.saved ? "password" : "text"}
                autoComplete="off"
                maxLength={1000}
                required={
                  isEnabled && !(field.saved && savedConfig[field.saved])
                }
                value={config[field.key] || ""}
                placeholder={
                  field.saved && savedConfig[field.saved]
                    ? "Saved — leave blank to keep"
                    : "Add when available"
                }
                onChange={(event) =>
                  setConfig((previous) => ({
                    ...previous,
                    [field.key]: event.target.value,
                  }))
                }
              />
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Leave a saved password or secret blank to keep its current value. You
          can save incomplete details while the gateway is disabled.
        </p>
        <button
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={busy}
        >
          {busy ? "Saving..." : `Save ${definition.title} settings`}
        </button>
      </fieldset>
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
    </form>
  );
}
