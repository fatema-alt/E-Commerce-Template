"use client";

import { useId, useState } from "react";
import type { Value } from "./cms-api";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Code2,
  Eye,
  Info,
  Radio,
} from "lucide-react";

export interface TrackingSettings {
  enabled?: boolean;
  gtmId?: string;
  serverUrl?: string;
  ga4MeasurementId?: string;
  metaPixelId?: string;
  consentDefault?: "granted" | "denied";
  debugMode?: boolean;
}

export const GTM_ID_REGEX = /^GTM-[A-Z0-9]{4,10}$/;
export const SERVER_URL_REGEX = /^https:\/\/[a-zA-Z0-9.-]+(?::[0-9]+)?$/;
export const GA4_ID_REGEX = /^G-[A-Z0-9]{6,12}$/;
export const PIXEL_ID_REGEX = /^[0-9]{8,20}$/;

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500";

export function TrackingEditor({
  value,
  publishedValue,
  publishedAt,
  disabled,
  onChange,
}: {
  value: Record<string, Value>;
  publishedValue: Record<string, Value> | null;
  publishedAt: string | null;
  disabled: boolean;
  onChange: (value: Record<string, Value>) => void;
}) {
  const gtmIdInputId = useId();
  const serverUrlInputId = useId();
  const ga4InputId = useId();
  const pixelInputId = useId();
  const consentInputId = useId();
  const [activeTab, setActiveTab] = useState<"settings" | "preview">("settings");

  const settings: TrackingSettings = {
    enabled: Boolean(value.enabled),
    gtmId: typeof value.gtmId === "string" ? value.gtmId : "",
    serverUrl: typeof value.serverUrl === "string" ? value.serverUrl : "",
    ga4MeasurementId:
      typeof value.ga4MeasurementId === "string" ? value.ga4MeasurementId : "",
    metaPixelId:
      typeof value.metaPixelId === "string" ? value.metaPixelId : "",
    consentDefault:
      value.consentDefault === "granted" ? "granted" : "denied",
    debugMode: Boolean(value.debugMode),
  };

  const update = (partial: Partial<TrackingSettings>) => {
    onChange({
      ...value,
      ...partial,
    });
  };

  // Validation checks
  const gtmValid = settings.gtmId ? GTM_ID_REGEX.test(settings.gtmId) : false;
  const serverUrlValid = settings.serverUrl
    ? SERVER_URL_REGEX.test(settings.serverUrl)
    : true;
  const ga4Valid = settings.ga4MeasurementId
    ? GA4_ID_REGEX.test(settings.ga4MeasurementId)
    : true;
  const pixelValid = settings.metaPixelId
    ? PIXEL_ID_REGEX.test(settings.metaPixelId)
    : true;

  const isFormValid =
    (!settings.enabled || gtmValid) &&
    serverUrlValid &&
    ga4Valid &&
    pixelValid;

  // Published comparison
  const publishedTracking = (publishedValue ?? null) as TrackingSettings | null;
  const isCurrentlyLive =
    Boolean(publishedTracking?.enabled) &&
    Boolean(publishedTracking?.gtmId && GTM_ID_REGEX.test(publishedTracking.gtmId));

  const hasDraftChanges =
    JSON.stringify(settings) !== JSON.stringify(publishedTracking ?? {});

  return (
    <div className="space-y-6">
      {/* Security Callout Box - Mandatory rule: No secrets here */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-xs">
        <ShieldCheck className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-amber-950">
            🔒 Secret & Token Security Notice
          </p>
          <p>
            Meta Conversions API (CAPI) access tokens, GA4 API secrets, and server
            container credentials are <strong>NEVER stored in the admin panel, database, or repository</strong>.
            Configure all API tokens exclusively in your GTM Server Container (Stape / Google Cloud Run).
            This admin panel manages only public container IDs and routing URLs.
          </p>
        </div>
      </div>

      {/* Status & Diagnostics Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Status card */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Storefront Status
            </span>
            {isCurrentlyLive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live on Storefront
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                Inactive / Disabled
              </span>
            )}
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-800">
            {isCurrentlyLive
              ? `Container: ${publishedTracking?.gtmId}`
              : "No active container on live site"}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {publishedAt
              ? `Last published: ${new Date(publishedAt).toLocaleString()}`
              : "Never published"}
          </p>
        </div>

        {/* Validation card */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Format Validation
          </span>
          <div className="mt-2 flex items-center gap-2">
            {isFormValid ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-800">
                  All ID formats valid
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                <span className="text-sm font-semibold text-rose-800">
                  Format errors detected
                </span>
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Strict regex allowlists applied before saving or rendering.
          </p>
        </div>

        {/* Draft State card */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Draft State
          </span>
          <div className="mt-2 text-sm font-semibold text-slate-800">
            {hasDraftChanges ? (
              <span className="text-amber-700">Unpublished changes in draft</span>
            ) : (
              <span className="text-slate-600">Draft matches live publication</span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Saving draft keeps live site unchanged until published.
          </p>
        </div>
      </div>

      {/* Tabs: Configuration vs Preview / Test */}
      <div className="border-b border-slate-200">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`pb-2 text-sm font-semibold border-b-2 transition ${
              activeTab === "settings"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Tracking Configuration
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={`pb-2 text-sm font-semibold border-b-2 transition ${
              activeTab === "preview"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Preview & Test Instructions
          </button>
        </div>
      </div>

      {activeTab === "settings" ? (
        <div className="space-y-6">
          {/* Master Enable Switch */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-base font-semibold text-slate-900 cursor-pointer">
                  Enable Storefront Tracking
                </label>
                <p className="text-xs text-slate-500 mt-0.5">
                  Master switch for all analytics, GTM scripts, and pixel loaders on the storefront.
                  When disabled, no external scripts or iframes will be injected.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={settings.enabled}
                  onChange={(e) => update({ enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          {/* Core Configuration Fields */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-5">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Container & Server Settings
            </h3>

            {/* GTM Container ID */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor={gtmIdInputId}
                  className="block text-sm font-semibold text-slate-900"
                >
                  GTM Web Container ID{" "}
                  {settings.enabled && <span className="text-rose-500">*</span>}
                </label>
                {settings.gtmId && (
                  <span
                    className={`text-xs font-medium ${
                      gtmValid ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {gtmValid ? "✓ Valid format" : "✕ Format: GTM-XXXXXXX"}
                  </span>
                )}
              </div>
              <input
                id={gtmIdInputId}
                type="text"
                disabled={disabled}
                placeholder="GTM-XXXXXXX"
                value={settings.gtmId}
                onChange={(e) =>
                  update({ gtmId: e.target.value.trim().toUpperCase() })
                }
                className={`${inputClass} mt-1.5 ${
                  settings.gtmId && !gtmValid ? "border-rose-400 ring-rose-200 ring-1" : ""
                }`}
              />
              <p className="text-xs text-slate-500 mt-1">
                Where to find: In Google Tag Manager at the top of your workspace or under Admin &gt; Container ID. Must match format <code>GTM-XXXXXXX</code>.
              </p>
            </div>

            {/* Server Container / Tagging URL */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor={serverUrlInputId}
                  className="block text-sm font-semibold text-slate-900"
                >
                  Server Container / Stape Tagging URL (Optional)
                </label>
                {settings.serverUrl && (
                  <span
                    className={`text-xs font-medium ${
                      serverUrlValid ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {serverUrlValid ? "✓ Valid HTTPS hostname" : "✕ Must be https://hostname (no path)"}
                  </span>
                )}
              </div>
              <input
                id={serverUrlInputId}
                type="text"
                disabled={disabled}
                placeholder="https://analytics.digislashagency.com"
                value={settings.serverUrl}
                onChange={(e) =>
                  update({ serverUrl: e.target.value.trim() })
                }
                className={`${inputClass} mt-1.5 ${
                  settings.serverUrl && !serverUrlValid ? "border-rose-400 ring-rose-200 ring-1" : ""
                }`}
              />
              <p className="text-xs text-slate-500 mt-1">
                Where to find: In your Stape.io container settings or Google Cloud Run custom domain. Must be a secure HTTPS URL without trailing slash or path (e.g. <code>https://analytics.digislashagency.com</code>). Leave empty for direct Google CDN loader.
              </p>
            </div>

            {/* Consent Mode Default */}
            <div>
              <label
                htmlFor={consentInputId}
                className="block text-sm font-semibold text-slate-900"
              >
                Google Consent Mode v2 Default
              </label>
              <select
                id={consentInputId}
                disabled={disabled}
                value={settings.consentDefault}
                onChange={(e) =>
                  update({
                    consentDefault:
                      e.target.value === "granted" ? "granted" : "denied",
                  })
                }
                className={`${inputClass} mt-1.5`}
              >
                <option value="denied">denied (Recommended for strict privacy)</option>
                <option value="granted">granted (Standard Bangladeshi e-commerce)</option>
              </select>
              <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-indigo-600" />
                  Consent Default Behaviour Notice:
                </p>
                <p>
                  Sets initial defaults for <code>analytics_storage</code>, <code>ad_storage</code>, <code>ad_user_data</code>, and <code>ad_personalization</code>.
                </p>
                <p className="text-amber-700 font-medium">
                  ⚠️ Note: DS Mart storefront does not currently display an interactive cookie consent banner. Setting this to <strong>denied</strong> means tags run in cookieless ping mode without setting browser cookies until consent is explicitly granted.
                </p>
              </div>
            </div>

            {/* Debug Mode */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <div>
                <label className="text-sm font-semibold text-slate-900 cursor-pointer">
                  Debug Mode (Console Logging)
                </label>
                <p className="text-xs text-slate-500">
                  When enabled, all dataLayer pushes and event payloads are logged to the browser developer console (F12) on the storefront.
                </p>
              </div>
              <input
                type="checkbox"
                disabled={disabled}
                checked={settings.debugMode}
                onChange={(e) => update({ debugMode: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Optional Reference Identifiers */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Reference Identifiers (Optional)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                These fields are stored for documentation, diagnostics, and team reference. GTM and server container tags handle direct delivery.
              </p>
            </div>

            {/* GA4 Measurement ID */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor={ga4InputId}
                  className="block text-sm font-semibold text-slate-900"
                >
                  GA4 Measurement ID
                </label>
                {settings.ga4MeasurementId && (
                  <span
                    className={`text-xs font-medium ${
                      ga4Valid ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {ga4Valid ? "✓ Valid format" : "✕ Format: G-XXXXXXXXXX"}
                  </span>
                )}
              </div>
              <input
                id={ga4InputId}
                type="text"
                disabled={disabled}
                placeholder="G-XXXXXXXXXX"
                value={settings.ga4MeasurementId}
                onChange={(e) =>
                  update({
                    ga4MeasurementId: e.target.value.trim().toUpperCase(),
                  })
                }
                className={`${inputClass} mt-1.5 ${
                  settings.ga4MeasurementId && !ga4Valid ? "border-rose-400 ring-rose-200 ring-1" : ""
                }`}
              />
              <p className="text-xs text-slate-500 mt-1">
                Where to find: In Google Analytics 4 &gt; Admin &gt; Data Streams &gt; Web Stream Details. Format: <code>G-XXXXXXXXXX</code>.
              </p>
            </div>

            {/* Meta Pixel ID */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor={pixelInputId}
                  className="block text-sm font-semibold text-slate-900"
                >
                  Meta Pixel / Dataset ID
                </label>
                {settings.metaPixelId && (
                  <span
                    className={`text-xs font-medium ${
                      pixelValid ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {pixelValid ? "✓ Valid format" : "✕ Must be 8-20 digits"}
                  </span>
                )}
              </div>
              <input
                id={pixelInputId}
                type="text"
                disabled={disabled}
                placeholder="123456789012345"
                value={settings.metaPixelId}
                onChange={(e) =>
                  update({ metaPixelId: e.target.value.trim() })
                }
                className={`${inputClass} mt-1.5 ${
                  settings.metaPixelId && !pixelValid ? "border-rose-400 ring-rose-200 ring-1" : ""
                }`}
              />
              <p className="text-xs text-slate-500 mt-1">
                Where to find: In Meta Events Manager &gt; Datasets / Pixels &gt; Settings. Numeric ID (8 to 20 digits).
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Preview & Testing Helper Tab */
        <div className="space-y-6">
          {/* Injected Snippet Preview */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Code2 className="h-4 w-4 text-indigo-600" />
              Storefront Injected Code Preview
            </h3>
            <p className="text-xs text-slate-500">
              Shows the exact HTML scripts and Consent Mode defaults that will be rendered server-side into the storefront <code>&lt;head&gt;</code> based on the current settings:
            </p>

            {settings.enabled && gtmValid ? (
              <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs font-mono text-emerald-400">
                {`<!-- Consent Mode v2 Default -->\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('consent', 'default', {\n    analytics_storage: '${settings.consentDefault}',\n    ad_storage: '${settings.consentDefault}',\n    ad_user_data: '${settings.consentDefault}',\n    ad_personalization: '${settings.consentDefault}',\n    wait_for_update: 500\n  });\n</script>\n\n<!-- Google Tag Manager Async Loader -->\n<script async src="${settings.serverUrl ? settings.serverUrl : "https://www.googletagmanager.com"}/gtm.js?id=${settings.gtmId}"></script>`}
              </pre>
            ) : (
              <div className="rounded-lg bg-slate-100 p-4 text-xs font-mono text-slate-600">
                // Tracking is disabled or GTM ID is missing/invalid.
                // ZERO scripts, ZERO iframes, and ZERO network requests will be emitted on the storefront.
              </div>
            )}
          </div>

          {/* Step-by-Step Verification Guide */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Eye className="h-4 w-4 text-indigo-600" />
              How to Verify & Test Tracking
            </h3>

            <div className="space-y-4 text-xs text-slate-600">
              <div className="rounded-lg border border-slate-200 p-3 space-y-1">
                <p className="font-semibold text-slate-900 flex items-center gap-2">
                  <span>1. Verify with Google Tag Manager Preview</span>
                  <a
                    href="https://tagmanager.google.com"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center text-indigo-600 hover:underline gap-1"
                  >
                    Open GTM <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
                <p>
                  Click "Preview" in your GTM workspace, enter your store URL (<code>https://dsmart.digislashagency.com</code>), and confirm Tag Assistant connects. Check that Container Loaded fires exactly once on the first load.
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 p-3 space-y-1">
                <p className="font-semibold text-slate-900 flex items-center gap-2">
                  <span>2. Check Browser DevTools Console</span>
                </p>
                <p>
                  With Debug Mode enabled, open DevTools (F12) &gt; Console. Navigate between products and checkout to view formatted <code>[GTM Tracking]</code> push logs. Verify that <code>page_view</code> fires on route changes and ecommerce events contain <code>currency: "BDT"</code>.
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 p-3 space-y-1">
                <p className="font-semibold text-slate-900 flex items-center gap-2">
                  <span>3. Verify Meta Test Events & Deduplication</span>
                  <a
                    href="https://business.facebook.com/events_manager2"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center text-indigo-600 hover:underline gap-1"
                  >
                    Meta Events Manager <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
                <p>
                  In Events Manager &gt; Test Events, inspect events arriving from both Browser (Pixel) and Server (CAPI). Ensure they share the exact same <code>event_id</code> and display "Deduplicated" status.
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 p-3 space-y-1">
                <p className="font-semibold text-slate-900 flex items-center gap-2">
                  <span>4. Verify GA4 DebugView</span>
                  <a
                    href="https://analytics.google.com"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center text-indigo-600 hover:underline gap-1"
                  >
                    GA4 Analytics <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
                <p>
                  In Google Analytics 4 &gt; Admin &gt; DebugView, verify events like <code>page_view</code>, <code>view_item</code>, <code>add_to_cart</code>, <code>begin_checkout</code>, and <code>purchase</code> in the real-time timeline.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
