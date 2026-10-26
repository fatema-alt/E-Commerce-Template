"use client";

import { useCallback, useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  Building2,
  DollarSign,
  Smartphone,
  ExternalLink,
  HelpCircle,
  Copy,
  Check,
} from "lucide-react";

interface GatewayConfig {
  provider: "COD" | "BKASH" | "SSLCOMMERZ" | "BANK_TRANSFER";
  title: string;
  isEnabled: boolean;
  isSandbox: boolean;
  config: Record<string, any>;
  updatedAt?: string;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export default function PaymentSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [gateways, setGateways] = useState<Record<string, GatewayConfig>>({});
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Per-gateway saving and testing states
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<
    Record<string, { ok: boolean; message: string }>
  >({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authenticatedFetch(
        `${API_BASE}/admin/payments/settings`,
      );
      if (!res.ok) throw new Error("Failed to load payment settings");
      const data = await res.json();
      const map: Record<string, GatewayConfig> = {};
      for (const gw of data.gateways || []) {
        map[gw.provider] = gw;
      }
      setGateways(map);
    } catch (err: any) {
      setToast({
        type: "error",
        message: err.message || "Failed to load payment gateways.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 5000);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr));
    }, 2500);
  };

  const updateGatewayField = (
    provider: string,
    field: string,
    value: any,
  ) => {
    setGateways((prev) => {
      const current = prev[provider];
      if (!current) return prev;
      if (field === "isEnabled" || field === "isSandbox") {
        return {
          ...prev,
          [provider]: { ...current, [field]: value },
        };
      }
      return {
        ...prev,
        [provider]: {
          ...current,
          config: {
            ...current.config,
            [field]: value,
          },
        },
      };
    });
  };

  const handleSave = async (provider: string) => {
    const gw = gateways[provider];
    if (!gw) return;

    try {
      setSaving((p) => ({ ...p, [provider]: true }));
      const payload = {
        isEnabled: gw.isEnabled,
        isSandbox: gw.isSandbox,
        config: gw.config,
      };

      const res = await authenticatedFetch(
        `${API_BASE}/admin/payments/settings/${provider}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to save configuration");
      }

      showToast("success", `${gw.title} settings saved successfully.`);
      await fetchSettings();
    } catch (err: any) {
      showToast(
        "error",
        err.message || `Failed to update ${provider} settings.`,
      );
    } finally {
      setSaving((p) => ({ ...p, [provider]: false }));
    }
  };

  const handleTest = async (provider: string) => {
    const gw = gateways[provider];
    if (!gw) return;

    try {
      setTesting((p) => ({ ...p, [provider]: true }));
      setTestResults((p) => {
        const copy = { ...p };
        delete copy[provider];
        return copy;
      });

      const payload = {
        isSandbox: gw.isSandbox,
        config: gw.config,
      };

      const res = await authenticatedFetch(
        `${API_BASE}/admin/payments/settings/${provider}/test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const result = await res.json().catch(() => ({}));
      if (result.ok) {
        setTestResults((p) => ({
          ...p,
          [provider]: { ok: true, message: result.message || "Connection verified successfully!" },
        }));
      } else {
        setTestResults((p) => ({
          ...p,
          [provider]: {
            ok: false,
            message:
              result.message ||
              "Credentials test failed. Please verify your keys and environment.",
          },
        }));
      }
    } catch (err: any) {
      setTestResults((p) => ({
        ...p,
        [provider]: {
          ok: false,
          message: err.message || "Failed to test connection.",
        },
      }));
    } finally {
      setTesting((p) => ({ ...p, [provider]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <RefreshCw className="h-5 w-5 animate-spin text-indigo-600" />
          <span>Loading payment gateways...</span>
        </div>
      </div>
    );
  }

  const cod = gateways["COD"];
  const bkash = gateways["BKASH"];
  const ssl = gateways["SSLCOMMERZ"];
  const bank = gateways["BANK_TRANSFER"];

  const storeUrl =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:3000`
      : "https://storefront.example.com";

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Payment Gateways
          </h1>
          <p className="text-sm text-slate-500">
            Configure local Bangladesh payment processors, Cash on Delivery, and direct bank transfers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchSettings()}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            <span>Reload</span>
          </button>
        </div>
      </div>

      {/* Global Toast */}
      {toast && (
        <div
          role="alert"
          className={`flex items-center justify-between rounded-xl border p-4 text-sm shadow-sm transition-all ${
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toast.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-xs font-semibold underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Gateways Grid */}
      <div className="space-y-6">
        {/* 1. Cash on Delivery (COD) */}
        {cod && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-slate-100 pb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <DollarSign size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Cash on Delivery (COD)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Accept cash payment upon courier parcel delivery anywhere across Bangladesh.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={cod.isEnabled}
                    onChange={(e) =>
                      updateGatewayField("COD", "isEnabled", e.target.checked)
                    }
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
                  <span className="ml-3 text-xs font-semibold text-slate-700">
                    {cod.isEnabled ? "Active" : "Disabled"}
                  </span>
                </label>
                <button
                  type="button"
                  disabled={saving["COD"]}
                  onClick={() => handleSave("COD")}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Save size={14} />
                  <span>{saving["COD"] ? "Saving..." : "Save"}</span>
                </button>
              </div>
            </div>
            <div className="pt-4 text-xs text-slate-600">
              Cash on Delivery requires no API credentials. When enabled, shoppers will see "Cash on Delivery" as an option on checkout.
            </div>
          </div>
        )}

        {/* 2. bKash Tokenized Checkout */}
        {bkash && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-slate-100 pb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-pink-50 text-pink-600">
                  <Smartphone size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">
                      bKash Tokenized Checkout
                    </h2>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        bkash.isSandbox
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {bkash.isSandbox ? "Sandbox" : "Live"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Direct automated bKash Payment Gateway API (Tokenized Checkout v1.2.0-beta).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Sandbox / Live Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Sandbox</span>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={!bkash.isSandbox}
                      onChange={(e) =>
                        updateGatewayField(
                          "BKASH",
                          "isSandbox",
                          !e.target.checked,
                        )
                      }
                      className="peer sr-only"
                    />
                    <div className="peer h-5 w-9 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-pink-600 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                  </label>
                  <span className="text-xs font-semibold text-slate-700">Live</span>
                </div>

                {/* Enable Toggle */}
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={bkash.isEnabled}
                    onChange={(e) =>
                      updateGatewayField(
                        "BKASH",
                        "isEnabled",
                        e.target.checked,
                      )
                    }
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
                  <span className="ml-3 text-xs font-semibold text-slate-700">
                    {bkash.isEnabled ? "Active" : "Disabled"}
                  </span>
                </label>
              </div>
            </div>

            {/* Test Result Banner */}
            {testResults["BKASH"] && (
              <div
                className={`mt-4 flex items-center justify-between rounded-lg p-3 text-xs ${
                  testResults["BKASH"].ok
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  {testResults["BKASH"].ok ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span>{testResults["BKASH"].message}</span>
                </div>
                <button
                  onClick={() =>
                    setTestResults((p) => {
                      const c = { ...p };
                      delete c["BKASH"];
                      return c;
                    })
                  }
                  className="font-bold underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Form Fields */}
            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  App Key
                </label>
                <input
                  type="text"
                  placeholder="e.g. 4fxxxxxxxxxxxxxxxxxxxx"
                  value={bkash.config?.appKey || ""}
                  onChange={(e) =>
                    updateGatewayField("BKASH", "appKey", e.target.value)
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs shadow-sm focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  App Secret {bkash.config?.hasAppSecret && "(Saved)"}
                </label>
                <input
                  type="password"
                  placeholder={
                    bkash.config?.hasAppSecret
                      ? bkash.config?.appSecretMasked || "••••••••••••"
                      : "Enter App Secret"
                  }
                  value={bkash.config?.appSecret || ""}
                  onChange={(e) =>
                    updateGatewayField("BKASH", "appSecret", e.target.value)
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs shadow-sm focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500 font-mono"
                />
                <span className="text-[10px] text-slate-400">
                  Leave empty to keep existing secret untouched.
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Merchant Username
                </label>
                <input
                  type="text"
                  placeholder="e.g. sandboxTokenizedUser02"
                  value={bkash.config?.username || ""}
                  onChange={(e) =>
                    updateGatewayField("BKASH", "username", e.target.value)
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs shadow-sm focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Merchant Password {bkash.config?.hasPassword && "(Saved)"}
                </label>
                <input
                  type="password"
                  placeholder={
                    bkash.config?.hasPassword
                      ? "••••••••••••"
                      : "Enter Merchant Password"
                  }
                  value={bkash.config?.password || ""}
                  onChange={(e) =>
                    updateGatewayField("BKASH", "password", e.target.value)
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs shadow-sm focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500 font-mono"
                />
                <span className="text-[10px] text-slate-400">
                  Leave empty to keep existing password untouched.
                </span>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700">
                  Base API URL (Optional Override)
                </label>
                <input
                  type="text"
                  placeholder={
                    bkash.isSandbox
                      ? "https://tokenized.sandbox.bka.sh/v1.2.0-beta"
                      : "https://tokenized.pay.bka.sh/v1.2.0-beta"
                  }
                  value={bkash.config?.baseUrl || ""}
                  onChange={(e) =>
                    updateGatewayField("BKASH", "baseUrl", e.target.value)
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs shadow-sm focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500 font-mono"
                />
              </div>
            </div>

            {/* Webhook & Callback Info */}
            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">
                  Storefront Return Callback URL:
                </span>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      `${storeUrl}/api/shop/payments/bkash/callback`,
                      "bkash_cb",
                    )
                  }
                  className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800"
                >
                  {copiedKey === "bkash_cb" ? (
                    <Check size={12} className="text-emerald-600" />
                  ) : (
                    <Copy size={12} />
                  )}
                  <span>{copiedKey === "bkash_cb" ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <code className="mt-1 block rounded bg-white px-2 py-1 text-[11px] font-mono text-slate-800 border border-slate-200">
                {storeUrl}/api/shop/payments/bkash/callback
              </code>
            </div>

            {/* Action Buttons */}
            <div className="mt-5 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                disabled={testing["BKASH"]}
                onClick={() => handleTest("BKASH")}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                <ShieldCheck size={14} />
                <span>
                  {testing["BKASH"] ? "Testing..." : "Test Connection"}
                </span>
              </button>
              <button
                type="button"
                disabled={saving["BKASH"]}
                onClick={() => handleSave("BKASH")}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                <Save size={14} />
                <span>{saving["BKASH"] ? "Saving..." : "Save Settings"}</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. SSLCommerz EasyCheckout */}
        {ssl && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-slate-100 pb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <CreditCard size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">
                      SSLCommerz EasyCheckout
                    </h2>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        ssl.isSandbox
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {ssl.isSandbox ? "Sandbox" : "Live"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Supports 30+ payment channels: Visa, MasterCard, Amex, Nagad, Rocket, Upay, and Net Banking.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Sandbox / Live Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Sandbox</span>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={!ssl.isSandbox}
                      onChange={(e) =>
                        updateGatewayField(
                          "SSLCOMMERZ",
                          "isSandbox",
                          !e.target.checked,
                        )
                      }
                      className="peer sr-only"
                    />
                    <div className="peer h-5 w-9 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                  </label>
                  <span className="text-xs font-semibold text-slate-700">Live</span>
                </div>

                {/* Enable Toggle */}
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={ssl.isEnabled}
                    onChange={(e) =>
                      updateGatewayField(
                        "SSLCOMMERZ",
                        "isEnabled",
                        e.target.checked,
                      )
                    }
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
                  <span className="ml-3 text-xs font-semibold text-slate-700">
                    {ssl.isEnabled ? "Active" : "Disabled"}
                  </span>
                </label>
              </div>
            </div>

            {/* Test Result Banner */}
            {testResults["SSLCOMMERZ"] && (
              <div
                className={`mt-4 flex items-center justify-between rounded-lg p-3 text-xs ${
                  testResults["SSLCOMMERZ"].ok
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  {testResults["SSLCOMMERZ"].ok ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span>{testResults["SSLCOMMERZ"].message}</span>
                </div>
                <button
                  onClick={() =>
                    setTestResults((p) => {
                      const c = { ...p };
                      delete c["SSLCOMMERZ"];
                      return c;
                    })
                  }
                  className="font-bold underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Form Fields */}
            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Store ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. testbox_live"
                  value={ssl.config?.storeId || ""}
                  onChange={(e) =>
                    updateGatewayField("SSLCOMMERZ", "storeId", e.target.value)
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Store Password {ssl.config?.hasStorePassword && "(Saved)"}
                </label>
                <input
                  type="password"
                  placeholder={
                    ssl.config?.hasStorePassword
                      ? ssl.config?.storePasswordMasked || "••••••••••••"
                      : "Enter Store Password"
                  }
                  value={ssl.config?.storePassword || ""}
                  onChange={(e) =>
                    updateGatewayField(
                      "SSLCOMMERZ",
                      "storePassword",
                      e.target.value,
                    )
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
                <span className="text-[10px] text-slate-400">
                  Leave empty to keep existing password untouched.
                </span>
              </div>
            </div>

            {/* IPN Webhook Info */}
            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">
                  SSLCommerz IPN (Instant Payment Notification) URL:
                </span>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      `${storeUrl}/api/shop/payments/sslcommerz/ipn`,
                      "ssl_ipn",
                    )
                  }
                  className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800"
                >
                  {copiedKey === "ssl_ipn" ? (
                    <Check size={12} className="text-emerald-600" />
                  ) : (
                    <Copy size={12} />
                  )}
                  <span>{copiedKey === "ssl_ipn" ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <code className="mt-1 block rounded bg-white px-2 py-1 text-[11px] font-mono text-slate-800 border border-slate-200">
                {storeUrl}/api/shop/payments/sslcommerz/ipn
              </code>
              <p className="mt-1.5 text-[11px] text-slate-500">
                Configure this URL under your SSLCommerz Merchant Panel &gt; IPN Settings for real-time background order reconciliation.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="mt-5 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                disabled={testing["SSLCOMMERZ"]}
                onClick={() => handleTest("SSLCOMMERZ")}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                <ShieldCheck size={14} />
                <span>
                  {testing["SSLCOMMERZ"] ? "Testing..." : "Test Connection"}
                </span>
              </button>
              <button
                type="button"
                disabled={saving["SSLCOMMERZ"]}
                onClick={() => handleSave("SSLCOMMERZ")}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                <Save size={14} />
                <span>
                  {saving["SSLCOMMERZ"] ? "Saving..." : "Save Settings"}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* 4. Bank Transfer (Direct BDT Deposit) */}
        {bank && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-slate-100 pb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <Building2 size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Bank Transfer (Direct BDT Deposit)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Customers deposit BDT directly into your corporate bank account via BEFTN/NPSB.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={bank.isEnabled}
                    onChange={(e) =>
                      updateGatewayField(
                        "BANK_TRANSFER",
                        "isEnabled",
                        e.target.checked,
                      )
                    }
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
                  <span className="ml-3 text-xs font-semibold text-slate-700">
                    {bank.isEnabled ? "Active" : "Disabled"}
                  </span>
                </label>
              </div>
            </div>

            {/* Form Fields */}
            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Bank Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dutch-Bangla Bank PLC / BRAC Bank"
                  value={bank.config?.name || ""}
                  onChange={(e) =>
                    updateGatewayField("BANK_TRANSFER", "name", e.target.value)
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Account Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Commerce Suite Bangladesh Ltd"
                  value={bank.config?.accountName || ""}
                  onChange={(e) =>
                    updateGatewayField(
                      "BANK_TRANSFER",
                      "accountName",
                      e.target.value,
                    )
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Account Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. 104.120.00012345"
                  value={bank.config?.accountNumber || ""}
                  onChange={(e) =>
                    updateGatewayField(
                      "BANK_TRANSFER",
                      "accountNumber",
                      e.target.value,
                    )
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Branch / Routing Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. Gulshan Branch / Routing: 090271234"
                  value={bank.config?.branch || ""}
                  onChange={(e) =>
                    updateGatewayField(
                      "BANK_TRANSFER",
                      "branch",
                      e.target.value,
                    )
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-5 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                disabled={saving["BANK_TRANSFER"]}
                onClick={() => handleSave("BANK_TRANSFER")}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                <Save size={14} />
                <span>
                  {saving["BANK_TRANSFER"] ? "Saving..." : "Save Bank Details"}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
