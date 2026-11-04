"use client";
import { useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import ProductRichEditor from "@/components/catalog/product-rich-editor";
import ApiGatewaySettings from "@/components/payments/api-gateway-settings";

const base = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1"
).replace(/\/$/, "");
const root = base.endsWith("/api/v1") ? base : base + "/api/v1";
const input =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm";
const button =
  "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
type Settings = {
  fullEnabled: boolean;
  discountType: string;
  discountValue: number | string;
  maxDiscountCap: number | string | null;
  partialEnabled: boolean;
  advanceType: string;
  advanceValue: number | string;
  codEnabled: boolean;
  codMin: number | string | null;
  codMax: number | string | null;
  allowStacking: boolean;
  maxTotalDiscountPercent: number | string | null;
};
type Method = {
  id?: string;
  name: string;
  type: "mobile_banking" | "bank";
  logo: string | null;
  instruction: string;
  details: Record<string, string>;
  isEnabled: boolean;
  sortOrder: number;
};
const blankMethod = (): Method => ({
  name: "",
  type: "mobile_banking",
  logo: null,
  instruction: "",
  details: { accountNumber: "", accountType: "Personal" },
  isEnabled: false,
  sortOrder: 0,
});
const defaults: Settings = {
  fullEnabled: true,
  discountType: "percentage",
  discountValue: 0,
  maxDiscountCap: null,
  partialEnabled: true,
  advanceType: "delivery_charge_only",
  advanceValue: 0,
  codEnabled: false,
  codMin: null,
  codMax: null,
  allowStacking: false,
  maxTotalDiscountPercent: null,
};
async function api(path: string, method = "GET", body?: unknown) {
  const response = await authenticatedFetch(root + path, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      Array.isArray(data.message)
        ? data.message.join(", ")
        : data.message || "Request failed",
    );
  return data;
}
export default function PaymentSettingsPage() {
  const [tab, setTab] = useState<"Plans" | "Methods" | "API Gateways">("Plans");
  const [settings, setSettings] = useState<Settings>(defaults);
  const [methods, setMethods] = useState<Method[]>([]);
  const [editing, setEditing] = useState<Method | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function load() {
    const data = await api("/admin/checkout-payments");
    const { id: _id, updatedAt: _time, ...values } = data.settings;
    setSettings({ ...defaults, ...values });
    setMethods(data.methods);
  }
  useEffect(() => {
    let live = true;
    api("/admin/checkout-payments")
      .then((data) => {
        if (!live) return;
        const values = Object.fromEntries(
          Object.keys(defaults).map((key) => [
            key,
            data.settings[key] ?? defaults[key as keyof Settings],
          ]),
        );
        setSettings({ ...defaults, ...values });
        setMethods(data.methods);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);
  async function act(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
      setMessage("Saved successfully");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function numberField(
    key: keyof Settings,
    label: string,
    optional = false,
    max?: number,
  ) {
    return (
      <label className="block text-sm">
        {label}
        <input
          className={input}
          type="number"
          min="0"
          max={max}
          step="0.01"
          required={!optional}
          value={String(settings[key] ?? "")}
          onChange={(e) =>
            setSettings({
              ...settings,
              [key]:
                e.target.value === "" ? (optional ? null : "") : e.target.value,
            })
          }
        />
      </label>
    );
  }
  function toggle(
    key: "fullEnabled" | "partialEnabled" | "codEnabled" | "allowStacking",
    label: string,
  ) {
    return (
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={settings[key]}
          onChange={(e) =>
            setSettings({ ...settings, [key]: e.target.checked })
          }
        />
        {label}
      </label>
    );
  }
  const fields =
    editing?.type === "bank"
      ? ["bankName", "accountName", "accountNumber", "branch", "routingNumber"]
      : ["accountNumber"];
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold">Payment Settings</h1>
        <p className="mt-2 text-sm text-slate-500">
          Configure payment plans and accounts used at checkout.
        </p>
      </div>
      <div
        role="tablist"
        aria-label="Payment settings"
        className="flex flex-wrap gap-2"
      >
        {(["Plans", "Methods", "API Gateways"] as const).map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            className={tab === value ? button : "rounded-lg border px-4 py-2"}
            onClick={() => setTab(value)}
          >
            {value}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-green-700">
          {message}
        </p>
      )}
      {tab === "API Gateways" ? (
        <ApiGatewaySettings request={api} />
      ) : loading ? (
        <p>Loading payment settings...</p>
      ) : tab === "Plans" ? (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void act(async () => {
              const payload: Record<string, unknown> = { ...settings };
              for (const key of [
                "discountValue",
                "maxDiscountCap",
                "advanceValue",
                "codMin",
                "codMax",
                "maxTotalDiscountPercent",
              ] as const)
                payload[key] =
                  settings[key] == null || settings[key] === ""
                    ? null
                    : Number(settings[key]);
              await api("/admin/checkout-payments/settings", "PUT", payload);
              await load();
            });
          }}
        >
          <fieldset disabled={busy} className="space-y-5">
            <section className="space-y-4 rounded-xl border bg-white p-5">
              {toggle("fullEnabled", "Full Payment")}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm">
                  Discount type
                  <select
                    className={input}
                    value={settings.discountType}
                    onChange={(e) =>
                      setSettings({ ...settings, discountType: e.target.value })
                    }
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed amount</option>
                  </select>
                </label>
                {numberField(
                  "discountValue",
                  "Discount value",
                  false,
                  settings.discountType === "percentage" ? 100 : undefined,
                )}
                {settings.discountType === "percentage" &&
                  numberField(
                    "maxDiscountCap",
                    "Maximum discount amount (৳, optional)",
                    true,
                  )}
              </div>
              <p className="text-xs text-slate-500">
                Applies to products only. Zero hides discount messaging.
              </p>
            </section>
            <section className="space-y-4 rounded-xl border bg-white p-5">
              {toggle("partialEnabled", "Partial Advance + Cash on Delivery")}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm">
                  Advance type
                  <select
                    className={input}
                    value={settings.advanceType}
                    onChange={(e) =>
                      setSettings({ ...settings, advanceType: e.target.value })
                    }
                  >
                    <option value="delivery_charge_only">
                      Delivery charge only
                    </option>
                    <option value="fixed_amount">Fixed amount</option>
                    <option value="percentage_of_order">
                      Percentage of final order total
                    </option>
                  </select>
                </label>
                {settings.advanceType !== "delivery_charge_only" &&
                  numberField("advanceValue", "Advance value")}
              </div>
            </section>
            <section className="space-y-4 rounded-xl border bg-white p-5">
              {toggle("codEnabled", "Cash on Delivery")}
              <div className="grid gap-4 sm:grid-cols-2">
                {numberField("codMin", "Minimum order total (optional)", true)}
                {numberField("codMax", "Maximum order total (optional)", true)}
              </div>
            </section>
            <section className="space-y-4 rounded-xl border bg-white p-5">
              <h2 className="font-semibold">
                Coupons and Full Payment discount
              </h2>
              {toggle(
                "allowStacking",
                "Allow coupon + Full Payment discount together",
              )}
              {numberField(
                "maxTotalDiscountPercent",
                "Maximum combined discount (% of subtotal, optional)",
                true,
                100,
              )}
              <p className="text-sm text-slate-500">
                Coupons can individually allow stacking. Free shipping always
                combines. Without stacking, the larger discount wins.
              </p>
            </section>
            <button className={button} disabled={busy}>
              Save plans
            </button>
          </fieldset>
        </form>
      ) : (
        <div className="space-y-5">
          <button
            className={button}
            disabled={busy}
            onClick={() => setEditing(blankMethod())}
          >
            Add payment method
          </button>
          {!methods.length && !editing && (
            <p>No methods yet. Add an account to enable prepaid checkout.</p>
          )}
          <div className="space-y-3">
            {methods.map((method) => (
              <div
                key={method.id}
                className="flex flex-wrap items-center gap-4 rounded-xl border bg-white p-4"
              >
                {method.logo && (
                  <img
                    src={method.logo}
                    alt=""
                    className="h-12 w-16 object-contain"
                  />
                )}
                <div className="min-w-0 basis-full sm:flex-1 sm:basis-0">
                  <strong>{method.name}</strong>
                  <p className="text-sm text-slate-500">
                    {method.type === "bank" ? "Bank" : "Mobile Banking"} | Sort{" "}
                    {method.sortOrder}
                  </p>
                </div>
                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={method.isEnabled}
                    onChange={() =>
                      void act(async () => {
                        await api(
                          "/admin/checkout-payments/methods/" + method.id,
                          "PUT",
                          {
                            name: method.name,
                            type: method.type,
                            logo: method.logo,
                            details: method.details,
                            instruction: method.instruction,
                            isEnabled: !method.isEnabled,
                            sortOrder: method.sortOrder,
                          },
                        );
                        await load();
                      })
                    }
                  />
                  Enabled
                </label>
                <button
                  className="rounded border px-3 py-2"
                  onClick={() =>
                    setEditing({ ...method, details: { ...method.details } })
                  }
                >
                  Edit
                </button>
                <button
                  disabled={busy}
                  className="rounded border px-3 py-2 text-red-700"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Remove this method from checkout? Existing payments will be preserved.",
                      )
                    )
                      void act(async () => {
                        await api(
                          "/admin/checkout-payments/methods/" + method.id,
                          "DELETE",
                        );
                        await load();
                      });
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
          {editing && (
            <form
              className="space-y-4 rounded-xl border bg-white p-5"
              onSubmit={(e) => {
                e.preventDefault();
                void act(async () => {
                  const { id, ...payload } = editing;
                  await api(
                    "/admin/checkout-payments/methods" + (id ? "/" + id : ""),
                    id ? "PUT" : "POST",
                    {
                      name: payload.name,
                      type: payload.type,
                      logo: payload.logo,
                      details: payload.details,
                      instruction: payload.instruction,
                      isEnabled: payload.isEnabled,
                      sortOrder: payload.sortOrder,
                    },
                  );
                  setEditing(null);
                  await load();
                });
              }}
            >
              <h2 className="font-semibold">
                {editing.id ? "Edit" : "Add"} payment method
              </h2>
              <fieldset disabled={busy} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    Name *
                    <input
                      className={input}
                      required
                      maxLength={120}
                      value={editing.name}
                      onChange={(e) =>
                        setEditing({ ...editing, name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Category *
                    <select
                      className={input}
                      value={editing.type}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          type: e.target.value as Method["type"],
                          details:
                            e.target.value === "bank"
                              ? {}
                              : { accountType: "Personal" },
                        })
                      }
                    >
                      <option value="mobile_banking">Mobile Banking</option>
                      <option value="bank">Bank</option>
                    </select>
                  </label>
                  {fields.map((key) => (
                    <label key={key}>
                      {
                        {
                          bankName: "Bank name",
                          accountName: "Account name",
                          accountNumber: "Account number",
                          branch: "Branch",
                          routingNumber: "Routing number",
                        }[key]
                      }{" "}
                      *
                      <input
                        className={input}
                        required
                        maxLength={240}
                        value={editing.details[key] || ""}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            details: {
                              ...editing.details,
                              [key]: e.target.value,
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                  {editing.type === "mobile_banking" && (
                    <label>
                      Account type *
                      <select
                        className={input}
                        value={editing.details.accountType || "Personal"}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            details: {
                              ...editing.details,
                              accountType: e.target.value,
                            },
                          })
                        }
                      >
                        {["Personal", "Agent", "Merchant"].map((type) => (
                          <option key={type}>{type}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    Sort order
                    <input
                      className={input}
                      type="number"
                      min="0"
                      max="100000"
                      required
                      value={editing.sortOrder}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          sortOrder: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
                <label className="block">
                  Logo
                  <input
                    className={input}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      void act(async () => {
                        if (
                          !["image/png", "image/jpeg", "image/webp"].includes(
                            file.type,
                          )
                        )
                          throw new Error("Choose a PNG, JPG or WebP logo");
                        if (file.size > 1024 * 1024)
                          throw new Error("Logo must be at most 1 MB");
                        const body = new FormData();
                        body.append("file", file);
                        const response = await authenticatedFetch(
                          root + "/admin/cms/media",
                          { method: "POST", body },
                        );
                        const result = await response.json();
                        if (!response.ok)
                          throw new Error(result.message || "Upload failed");
                        setEditing((current) =>
                          current ? { ...current, logo: result.url } : current,
                        );
                      });
                    }}
                  />
                </label>
                <p className="text-xs text-slate-500">
                  PNG/JPG/WebP, max 1MB. Uploaded logos appear in the preview
                  below.
                </p>
                {editing.logo && (
                  <img
                    src={editing.logo}
                    alt="Logo preview"
                    className="h-16 w-24 object-contain"
                  />
                )}
                <div className="payment-instruction-editor">
                  <p className="mb-2 text-sm font-semibold">
                    Transfer instructions
                  </p>
                  <ProductRichEditor
                    label="Transfer instructions"
                    maxLength={20000}
                    value={editing.instruction}
                    onChange={(instruction) =>
                      setEditing({ ...editing, instruction })
                    }
                    disabled={busy}
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editing.isEnabled}
                    onChange={(e) =>
                      setEditing({ ...editing, isEnabled: e.target.checked })
                    }
                  />
                  Enabled at checkout
                </label>
                <div className="flex gap-3">
                  <button className={button} disabled={busy}>
                    Save method
                  </button>
                  <button
                    type="button"
                    className="rounded border px-4 py-2"
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </button>
                </div>
              </fieldset>
            </form>
          )}
        </div>
      )}
    </main>
  );
}
