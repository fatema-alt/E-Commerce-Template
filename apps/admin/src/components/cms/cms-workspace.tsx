"use client";
import { useToastState } from "@/components/admin/toast-provider";
/* eslint-disable @next/next/no-img-element -- CMS assets support local and configured remote storage. */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type Asset,
  type Document,
  type Registry,
  type Value,
  assetUrl,
  initialValue,
  label,
  request,
  CmsRequestError,
} from "./cms-api";
import { button, input, SchemaField } from "./schema-fields";
import { getStandardEcommerceTemplate } from "./standard-template";
import { VisualHomepageBuilder } from "./visual-homepage-builder";
import { EngagementPreview, engagementDefaults } from "./engagement-preview";
import { TrackingEditor } from "./tracking-editor";

const tabs = [
  ["SITE_SETTINGS", "Site Settings", "settings"],
  ["THEME", "Theme", "theme"],
  ["PAGE", "Pages", "pages"],
  ["NAVIGATION", "Navigation", "navigation"],
  ["MEDIA", "Media Library", "media"],
  ["ANNOUNCEMENTS", "Announcement Bar", "announcements"],
  ["CONTACT_WIDGET", "Floating Contact Widget", "contact-widget"],
  ["TRACKING", "Tracking & Pixels", "tracking"],
];
type Version = { id: string; version: number; createdAt: string };
type Section = {
  id: string;
  type: string;
  visible: boolean;
  config: Record<string, Value>;
  responsive?: Record<string, Value>;
};
export function CmsWorkspace({
  kind,
  defaultKey,
  scope,
}: {
  kind: string;
  defaultKey?: string;
  scope?: "announcementRibbon" | "contactWidget" | "tracking";
}) {
  const [registry, setRegistry] = useState<Registry | null>(null);
  const [role, setRole] = useState("STAFF");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetPage, setAssetPage] = useState(1);
  const [assetTotal, setAssetTotal] = useState(0);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [listPage, setListPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [key, setKey] = useState("");
  const [newKey, setNewKey] = useState("");
  const [doc, setDoc] = useState<Document | null>(null);
  const [content, setContent] = useState<Record<string, Value>>({});
  const [versions, setVersions] = useState<Version[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [, setError] = useToastState("error");
  const [, setNotice] = useToastState("success");
  const [scheduledAt, setScheduledAt] = useState("");
  const [block, setBlock] = useState("hero");
  const [preview, setPreview] = useState(false);
  const [builderMode, setBuilderMode] = useState(true);
  const sequence = useRef(0);
  const editable = role === "ADMIN" || role === "SUPER_ADMIN";
  const publisher = role === "SUPER_ADMIN";
  useEffect(() => {
    const addAsset = (event: Event) => {
      const asset = (event as CustomEvent<Asset>).detail;
      setAssets((previous) => [asset, ...previous.filter((item) => item.id !== asset.id)]);
    };
    window.addEventListener("cms-media-uploaded", addAsset);
    return () => window.removeEventListener("cms-media-uploaded", addAsset);
  }, []);
  const refreshList = useCallback(async () => {
    if (kind === "MEDIA") {
      const result = await request<{ items: Asset[]; total: number }>(
        `/admin/cms/media?page=${listPage}&limit=24`,
      );
      setAssets(result.items);
      setTotal(result.total);
    } else {
      const result = await request<{ items: Document[]; total: number }>(
        `/admin/cms?kind=${kind}&page=${listPage}&limit=24`,
      );
      setDocuments(result.items);
      setTotal(result.total);
    }
  }, [kind, listPage]);
  useEffect(() => {
    let live = true;
    Promise.all([
      request<Registry>("/admin/cms/schema"),
      request<{ user: { role: string } }>("/auth/me"),
      request<{ items: Asset[]; total: number }>("/admin/cms/media?limit=100"),
    ])
      .then(([schema, auth, media]) => {
        if (live) {
          setRegistry(schema);
          setRole(auth.user.role);
          if (kind !== "MEDIA") {
            setAssets(media.items);
            setAssetTotal(media.total);
          }
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [kind, setError]);
  useEffect(() => {
    let live = true;
    Promise.resolve()
      .then(refreshList)
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [refreshList, setError]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", prevent);
    const navigate = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest("a");
      if (
        anchor &&
        !anchor.closest('[aria-label="CMS navigation"]') &&
        anchor.href !== window.location.href &&
        !window.confirm("Discard unsaved changes?")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", prevent);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty]);
  function canLeave() {
    return !dirty || window.confirm("Discard unsaved changes?");
  }
  function change(value: Value) {
    setContent(value as Record<string, Value>);
    setDirty(true);
    setNotice("");
  }
  const open = useCallback(async (documentKey: string) => {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    const current = ++sequence.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const [next, history] = await Promise.all([
        request<Document>(`/admin/cms/${kind}/${documentKey}`),
        request<{ items: Version[]; total: number }>(
          `/admin/cms/${kind}/${documentKey}/versions?limit=10`,
        ),
      ]);
      if (current !== sequence.current) return;
      setKey(documentKey);
      setDoc(next);
      const loadedContent = { ...(next.latestVersion?.content ?? {}) };
      if (
        kind === "PAGE" &&
        (!loadedContent.title || !(loadedContent.title as string).trim())
      ) {
        loadedContent.title =
          documentKey === "home"
            ? "Home"
            : documentKey.charAt(0).toUpperCase() + documentKey.slice(1);
      }
      setContent(loadedContent);
      setVersions(history.items);
      setHistoryTotal(history.total);
      setHistoryPage(1);
      setDirty(false);
      setPreview(false);
    } catch (e) {
      if (scope && kind === "SITE_SETTINGS" && e instanceof CmsRequestError && e.status === 404) {
        if (current !== sequence.current) return;
        setKey(documentKey); setDoc(null);
        setContent({ storeName: "DS Mart", locale: "en", currency: "BDT", [scope]: engagementDefaults[scope] });
        setVersions([]); setHistoryTotal(0); setDirty(true);
        setNotice("New Site Settings draft. Configure, save and publish when ready.");
      } else if (documentKey === "home" && kind === "PAGE" && e instanceof CmsRequestError && e.status === 404) {
        if (current !== sequence.current) return;
        setKey("home");
        setDoc(null);
        setContent({
          title: "Home",
          sections: getStandardEcommerceTemplate() as unknown as Value,
        });
        setVersions([]);
        setHistoryTotal(0);
        setDirty(true);
        setNotice(
          "Loaded Pre-built Standard Homepage Template. Customize sections and click 'Save Draft' or 'Publish Now' to activate.",
        );
      } else {
        setError((e as Error).message);
      }
    } finally {
      if (current === sequence.current) setBusy(false);
    }
  }, [dirty, kind, scope, setError, setNotice]);

  const initialOpenedRef = useRef(false);
  useEffect(() => {
    if (initialOpenedRef.current || loading) return;
    initialOpenedRef.current = true;
    const urlKey =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("key")
        : null;
    const targetKey = urlKey || defaultKey || (kind === "PAGE" ? "home" : "");
    if (targetKey) {
      void Promise.resolve().then(() => open(targetKey));
    }
  }, [loading, kind, defaultKey, open]);
  function create() {
    if (!registry || !canLeave()) return;
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(newKey)) {
      setError(
        "Use 1–64 lowercase letters, numbers, hyphens or underscores for the document key.",
      );
      return;
    }
    setKey(newKey);
    setDoc(null);
    let initial =
      kind === "THEME"
        ? { ...registry.defaultTheme }
        : (initialValue(registry.documents[kind]) as Record<string, Value>);
    if (kind === "PAGE") {
      initial = {
        ...initial,
        title:
          newKey === "home"
            ? "Home"
            : newKey.charAt(0).toUpperCase() + newKey.slice(1),
        sections: getStandardEcommerceTemplate() as unknown as Value,
      };
    }
    setContent(initial);
    setVersions([]);
    setHistoryTotal(0);
    setDirty(true);
    setError("");
    setNotice("");
  }
  async function mutate(action: string, version?: number) {
    if (action !== "draft" && dirty) {
      setError(
        "Save your draft before publishing or changing publication status.",
      );
      return;
    }
    if (action === "publish") {
      if (scope === "tracking" || (kind === "SITE_SETTINGS" && content.tracking)) {
        const draftTracking = ((content.tracking as Record<string, Value>) || {}) as Record<string, Value>;
        const pubTracking = (((doc?.publishedContent?.tracking as Record<string, Value>) || {}) as Record<string, Value>);

        const trackingLabels: Record<string, string> = {
          enabled: "Tracking Active",
          gtmId: "GTM Web Container ID",
          serverUrl: "Server Tagging URL",
          ga4MeasurementId: "GA4 Measurement ID",
          metaPixelId: "Meta Pixel ID",
          consentDefault: "Consent Mode Default",
          debugMode: "Debug Mode",
        };

        const changes: string[] = [];
        for (const [k, lbl] of Object.entries(trackingLabels)) {
          const draftVal = draftTracking[k] ?? (k === "enabled" || k === "debugMode" ? false : k === "consentDefault" ? "denied" : "");
          const pubVal = pubTracking[k] ?? (k === "enabled" || k === "debugMode" ? false : k === "consentDefault" ? "denied" : "");
          if (draftVal !== pubVal) {
            changes.push(`${lbl}: "${String(pubVal)}" → "${String(draftVal)}"`);
          }
        }

        let hasOtherChanges = false;
        if (doc?.publishedContent) {
          for (const k of Object.keys(content)) {
            if (k === "tracking") continue;
            if (JSON.stringify(content[k]) !== JSON.stringify(doc.publishedContent[k])) {
              hasOtherChanges = true;
              break;
            }
          }
        }

        const changesText = changes.length > 0 ? changes.map((c) => `• ${c}`).join("\n") : "• No tracking changes (republishing live version)";
        const otherWarning = hasOtherChanges
          ? "\n\n⚠️ WARNING: This Site Settings document contains other unpublished changes (e.g. store info, announcements) that will also be published to the live store."
          : "";

        const confirmed = window.confirm(
          `This changes tracking on the live store.\n\nChanged fields:\n${changesText}${otherWarning}\n\nDo you want to proceed?`
        );
        if (!confirmed) return;
      }
    }
    if (
      ["archive", "unpublish", "rollback"].includes(action) &&
      !window.confirm(
        `${label(action)} ${key}${version ? ` to version ${version}` : ""}?`,
      )
    )
      return;
    if (
      action === "schedule" &&
      (!scheduledAt || !Number.isFinite(new Date(scheduledAt).getTime()))
    ) {
      setError("Choose a valid future publication time.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const payloadContent = { ...content };
    if (kind === "PAGE") {
      const currentTitle = (payloadContent.title as string)?.trim();
      if (!currentTitle) {
        payloadContent.title =
          key === "home"
            ? "Home"
            : key.charAt(0).toUpperCase() + key.slice(1);
        setContent(payloadContent);
      }
    }
    try {
      await request(`/admin/cms/${kind}/${key}/${action}`, {
        method: action === "draft" ? "PATCH" : "POST",
        body: JSON.stringify({
          expectedRevision: doc?.revision ?? 0,
          ...(action === "draft" ? { content: payloadContent } : {}),
          ...(version ? { version } : {}),
          ...(action === "schedule"
            ? { scheduledAt: new Date(scheduledAt).toISOString() }
            : {}),
        }),
      });
      const next = await request<Document>(`/admin/cms/${kind}/${key}`);
      setDoc(next);
      setDirty(false);
      setNotice(
        action === "draft"
          ? "Draft saved. Your live content is unchanged."
          : `${label(action)} completed.`,
      );
      const history = await request<{ items: Version[]; total: number }>(
        `/admin/cms/${kind}/${key}/versions?limit=10`,
      );
      setVersions(history.items);
      setHistoryTotal(history.total);
      setHistoryPage(1);
      await refreshList();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function history(page: number) {
    setBusy(true);
    setError("");
    try {
      const result = await request<{ items: Version[]; total: number }>(
        `/admin/cms/${kind}/${key}/versions?page=${page}&limit=10`,
      );
      setVersions(result.items);
      setHistoryTotal(result.total);
      setHistoryPage(page);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function restore(version: number) {
    if (!canLeave()) return;
    setBusy(true);
    setError("");
    try {
      const result = await request<{ content: Record<string, Value> }>(
        `/admin/cms/${kind}/${key}/versions/${version}`,
      );
      setContent(result.content);
      setDirty(true);
      setNotice(
        `Version ${version} loaded into the editor. Save to create a new draft.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const sections = (content.sections ?? []) as unknown as Section[];
  function updateSections(next: Section[]) {
    change({ ...content, sections: next as unknown as Value });
  }
  const heading =
    scope === "announcementRibbon"
      ? "Announcement Bar"
      : scope === "contactWidget"
        ? "Floating Contact Widget"
        : scope === "tracking"
          ? "Tracking & Pixels"
          : tabs.find((tab) => tab[0] === kind)?.[1];
  const isTabActive = (id: string) => {
    if (scope) {
      if (scope === "announcementRibbon") return id === "ANNOUNCEMENTS";
      if (scope === "contactWidget") return id === "CONTACT_WIDGET";
      if (scope === "tracking") return id === "TRACKING";
    }
    return kind === id;
  };
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
          Storefront CMS
        </p>
        <h1 className="mt-2 text-3xl font-bold">{heading}</h1>
        <p className="mt-2 text-sm text-slate-500">
          Manage your storefront content. Save drafts and publish when ready.
        </p>
          {kind === 'PAGE' && <p className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">Each page has its own URL: the key “hero” publishes at /hero. To display a page on the storefront homepage, choose its Home Page Key in <Link className="font-semibold underline" href="/cms/settings">Site Settings</Link> and publish those settings. The default homepage key is “home”.</p>}
      </div>
      <nav
        aria-label="CMS navigation"
        className="flex flex-wrap gap-2 border-b pb-4"
      >
        {tabs.map(([id, title, path]) => (
          <Link
            key={id}
            href={`/cms/${path}`}
            onClick={(e) => {
              if (!canLeave()) e.preventDefault();
            }}
            aria-current={isTabActive(id) ? "page" : undefined}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${isTabActive(id) ? "bg-indigo-600 text-white" : "bg-white text-slate-600"}`}
          >
            {title}
          </Link>
        ))}
      </nav>


      {loading ? (
        <p role="status">Loading CMS…</p>
      ) : kind === "MEDIA" ? (
        <>
          <div className="rounded-xl border bg-white p-5">
            <h2 className="font-semibold">Upload storefront images</h2>
            <p className="mt-1 text-sm text-slate-500">
              JPG, PNG or WebP, up to 5 MB. Images are optimized automatically.
            </p>
            {editable && (
              <input
                className="mt-4 block text-sm"
                aria-label="Upload CMS image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) {
                    setError("Image must be at most 5 MB.");
                    return;
                  }
                  setBusy(true);
                  setError("");
                  try {
                    const form = new FormData();
                    form.append("file", file);
                    await request("/admin/cms/media", {
                      method: "POST",
                      body: form,
                    });
                    await refreshList();
                    setNotice(
                      "Image uploaded. It is now available in CMS image selectors.",
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                    event.target.value = "";
                  }
                }}
              />
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {assets.map((asset) => (
              <article
                key={asset.id}
                className="overflow-hidden rounded-xl border bg-white"
              >
                <div className="flex h-40 items-center justify-center bg-slate-100">
                  {asset.url && (
                    <img
                      src={assetUrl(asset.thumbnailUrl || asset.url)}
                      alt={asset.altText || "CMS media"}
                      className="h-full w-full object-contain"
                    />
                  )}
                </div>
                <div className="space-y-2 p-4">
                  <p className="break-all text-xs text-slate-500">{asset.id}</p>
                  <p className="text-sm">{Math.round(asset.bytes / 1024)} KB</p>
                  <button
                    className={button}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(asset.id);
                        setNotice("Asset ID copied.");
                      } catch {
                        setError(
                          "Clipboard unavailable. Select and copy the asset ID above.",
                        );
                      }
                    }}
                  >
                    Copy asset ID
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!assets.length && (
            <p className="rounded-xl border border-dashed p-10 text-center text-slate-500">
              No images yet. Upload your first storefront image.
            </p>
          )}
        </>
      ) : kind === "PAGE" && builderMode && key && registry ? (
        <div className="w-full space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                <span>✨</span>
                <span>Visual Homepage Builder</span>
              </span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <span className="text-slate-500">Page:</span>
                <select
                  aria-label="Switch document"
                  value={key}
                  disabled={busy}
                  onChange={(e) => open(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {documents.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.key} ({item.state.toLowerCase()} · v{item.revision})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setBuilderMode(false)}
                className="text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
              >
                ← Switch to Classic Form View
              </button>
              <button
                className={button}
                disabled={busy || !doc}
                onClick={() => open(key)}
              >
                Reload
              </button>
            </div>
          </div>

          <VisualHomepageBuilder
            pageTitle={content.title ? String(content.title) : key}
            sections={sections as unknown as Section[]}
            onUpdateSections={(next) => updateSections(next as unknown as Section[])}
            registry={registry}
            assets={assets}
            dirty={dirty}
            busy={busy}
            doc={doc}
            onSaveDraft={() => mutate("draft")}
            onPublish={() => mutate("publish")}
            editable={editable}
            publisher={publisher}
            onNotice={(msg) => setNotice(msg)}
          />

          {doc && (
            <details className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-xs">
              <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                Version History & Audit ({versions.length} versions recorded)
              </summary>
              <div className="mt-3 space-y-2">
                {versions.map((version) => (
                  <div key={version.id} className="flex items-center justify-between border-b dark:border-slate-800 pb-2">
                    <span>
                      Version {version.version} {version.id === doc.publishedVersionId ? "· Live" : ""} — {new Date(version.createdAt).toLocaleString()}
                    </span>
                    <div className="flex gap-2">
                      {editable && (
                        <button
                          className="text-indigo-600 hover:underline font-semibold"
                          disabled={busy}
                          onClick={() => restore(version.version)}
                        >
                          Load version
                        </button>
                      )}
                      {publisher && (
                        <button
                          className="text-emerald-600 hover:underline font-semibold"
                          disabled={busy || dirty}
                          onClick={() => mutate("rollback", version.version)}
                        >
                          Publish version
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Documents</h2>
            {documents.map((item) => (
              <button
                key={item.key}
                disabled={busy}
                onClick={() => open(item.key)}
                className={`w-full rounded-lg border p-3 text-left text-sm ${key === item.key ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40" : "border-slate-200 dark:border-slate-800"}`}
              >
                <span className="block break-all font-medium text-slate-900 dark:text-slate-100">{item.key}</span>
                <span className="text-xs text-slate-500">
                  {item.state.toLowerCase()} · revision {item.revision}
                </span>
              </button>
            ))}
            {!documents.length && (
              <p className="text-sm text-slate-500">
                Create your first document below.
              </p>
            )}
            {editable && (
              <div className="space-y-2 border-t dark:border-slate-800 pt-4">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300" htmlFor="cms-new-key">
                  New document key
                </label>
                <input
                  id="cms-new-key"
                  placeholder={kind === "PAGE" ? "home" : "default"}
                  value={newKey}
                  className={input}
                  disabled={busy}
                  onChange={(e) => setNewKey(e.target.value)}
                />
                <button
                  className={button + " w-full"}
                  disabled={busy || !registry}
                  onClick={create}
                >
                  + Create {heading}
                </button>
              </div>
            )}
          </aside>
          {key && registry ? (
            <div className="min-w-0 space-y-5">
              <section className="rounded-xl border bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="break-all text-xl font-semibold">{key}</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {doc?.state ?? "NEW"} · revision {doc?.revision ?? 0} ·{" "}
                      {dirty ? "Unsaved changes" : "Saved"}
                      {doc?.scheduledAt
                        ? ` · Scheduled ${new Date(doc.scheduledAt).toLocaleString()}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {kind === "PAGE" && (
                      <button
                        type="button"
                        className="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition shadow-2xs"
                        onClick={() => setBuilderMode(true)}
                      >
                        🎨 Visual Builder Mode
                      </button>
                    )}
                    <button
                      className={button}
                      disabled={busy || !doc}
                      onClick={() => open(key)}
                    >
                      Reload
                    </button>
                    <button
                      className={button}
                      onClick={() => setPreview(!preview)}
                    >
                      {preview ? "Edit content" : "Preview draft"}
                    </button>
                  </div>
                </div>
                {assets.length < assetTotal && (
                  <button
                    className={button + " mt-4"}
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const result = await request<{ items: Asset[] }>(
                          `/admin/cms/media?page=${assetPage + 1}&limit=100`,
                        );
                        setAssets((previous) => [...previous, ...result.items]);
                        setAssetPage((p) => p + 1);
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Load more images for image selectors
                  </button>
                )}
                <fieldset
                  disabled={!editable || busy}
                  className="mt-6 min-w-0 space-y-5"
                >
                  {scope ? (
                    scope === "tracking" ? (
                      <TrackingEditor
                        value={((content.tracking as Record<string, Value>) || engagementDefaults.tracking)}
                        publishedValue={((doc?.publishedContent?.tracking as Record<string, Value>) || null)}
                        publishedAt={doc?.publishedAt || null}
                        disabled={!editable || busy}
                        onChange={(val) => change({ ...content, tracking: val })}
                      />
                    ) : (
                      <div className="engagement-editor">
                        <div><p className="mb-4 text-sm text-slate-500">Settings are part of the selected Site Settings document. Publishing also publishes its other saved changes. Times use your local timezone and are saved in UTC. Array order controls display order.</p><SchemaField name={heading || scope} schema={registry.documents.SITE_SETTINGS.properties![scope]} value={content[scope] ?? engagementDefaults[scope]} assets={assets} onChange={value => change({ ...content, [scope]: value })} /></div>
                        <EngagementPreview scope={scope} value={content[scope] ?? engagementDefaults[scope]} />
                      </div>
                    )
                  ) : preview ? (
                    <DraftPreview
                      kind={kind}
                      content={content}
                      assets={assets}
                    />
                  ) : kind === "PAGE" ? (
                    <>
                      <SchemaField
                        name="Page"
                        schema={{
                          ...registry.documents.PAGE,
                          properties: Object.fromEntries(
                            Object.entries(
                              registry.documents.PAGE.properties!,
                            ).filter(([name]) => name !== "sections"),
                          ),
                        }}
                        value={content}
                        assets={assets}
                        onChange={change}
                      />
                      <div className="flex flex-wrap gap-2">
                        <select
                          aria-label="Section type"
                          className={input + " max-w-xs"}
                          value={block}
                          onChange={(e) => setBlock(e.target.value)}
                        >
                          {Object.keys(registry.blocks).map((type) => (
                            <option key={type} value={type}>
                              {label(type)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className={button}
                          disabled={sections.length >= 100}
                          onClick={() =>
                            updateSections([
                              ...sections,
                              {
                                id: crypto.randomUUID(),
                                type: block,
                                visible: true,
                                config: initialValue(
                                  registry.blocks[block],
                                ) as Record<string, Value>,
                              },
                            ])
                          }
                        >
                          + Add section
                        </button>
                        <button
                          type="button"
                          className="rounded-lg bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition shadow-sm"
                          onClick={() => {
                            if (
                              sections.length > 0 &&
                              !window.confirm(
                                "Replace existing sections with the Standard E-Commerce Template?",
                              )
                            ) {
                              return;
                            }
                            updateSections(
                              getStandardEcommerceTemplate() as unknown as Section[],
                            );
                            setNotice(
                              "Standard E-Commerce Template loaded. You can now customize each section.",
                            );
                          }}
                        >
                          ✨ Load Standard Template
                        </button>
                      </div>
                      {!sections.length && (
                        <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 p-8 text-center space-y-3">
                          <p className="text-sm font-semibold text-slate-800">
                            This page has no sections configured yet.
                          </p>
                          <p className="text-xs text-slate-500 max-w-md mx-auto">
                            Instead of building from scratch, click below to load our standard e-commerce layout (Hero, Categories, Flash Deals, Best Sellers, Promo Banners, Value Features, FAQ, and Newsletter).
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              updateSections(
                                getStandardEcommerceTemplate() as unknown as Section[],
                              );
                              setNotice(
                                "Standard E-Commerce Template loaded. You can now customize each section.",
                              );
                            }}
                            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
                          >
                            <span>✨ Start with Standard Template</span>
                          </button>
                        </div>
                      )}
                      {sections.map((section, index) => (
                        <details
                          key={section.id}
                          open
                          className="rounded-xl border p-4 bg-white shadow-sm"
                        >
                          <summary className="cursor-pointer font-semibold flex items-center justify-between text-slate-900">
                            <span>
                              {index + 1}. {label(section.type)}{" "}
                              {section.config?.title
                                ? `— "${section.config.title}"`
                                : ""}{" "}
                              <span
                                className={`text-xs font-normal ${
                                  section.visible
                                    ? "text-emerald-600"
                                    : "text-amber-600"
                                }`}
                              >
                                {section.visible ? "(Active)" : "(Hidden)"}
                              </span>
                            </span>
                          </summary>
                          <div className="my-4 flex flex-wrap gap-2">
                            <label className="mr-auto flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={section.visible}
                                onChange={(e) =>
                                  updateSections(
                                    sections.map((s, i) =>
                                      i === index
                                        ? { ...s, visible: e.target.checked }
                                        : s,
                                    ),
                                  )
                                }
                              />
                              Visible
                            </label>
                            {[-1, 1].map((delta) => (
                              <button
                                key={delta}
                                type="button"
                                className={button}
                                disabled={
                                  index + delta < 0 ||
                                  index + delta >= sections.length
                                }
                                aria-label={`${delta < 0 ? "Move up" : "Move down"} section ${index + 1}`}
                                onClick={() => {
                                  const next = [...sections];
                                  [next[index], next[index + delta]] = [
                                    next[index + delta],
                                    next[index],
                                  ];
                                  updateSections(next);
                                }}
                              >
                                {delta < 0 ? "↑" : "↓"}
                              </button>
                            ))}
                            <button
                              className={button}
                              type="button"
                              onClick={() =>
                                updateSections(
                                  sections.flatMap((s, i) =>
                                    i === index
                                      ? [
                                          s,
                                          {
                                            ...structuredClone(s),
                                            id: crypto.randomUUID(),
                                          },
                                        ]
                                      : [s],
                                  ),
                                )
                              }
                              disabled={sections.length >= 100}
                            >
                              Duplicate
                            </button>
                            <button
                              className={button}
                              type="button"
                              onClick={() => {
                                if (window.confirm("Remove this section?"))
                                  updateSections(
                                    sections.filter((_, i) => i !== index),
                                  );
                              }}
                            >
                              Remove
                            </button>
                          </div>
                          <SchemaField
                            name="Section content"
                            schema={registry.blocks[section.type]}
                            value={section.config}
                            assets={assets}
                            onChange={(next) =>
                              updateSections(
                                sections.map((s, i) =>
                                  i === index
                                    ? {
                                        ...s,
                                        config: next as Record<string, Value>,
                                      }
                                    : s,
                                ),
                              )
                            }
                          />
                          <div className="mt-4">
                            <SchemaField
                              name="Section display"
                              schema={{
                                type: "object",
                                properties: {
                                  responsive:
                                    registry.documents.PAGE.properties!.sections
                                      .items!.properties!.responsive,
                                },
                              }}
                              value={section as unknown as Value}
                              assets={assets}
                              onChange={(next) =>
                                updateSections(
                                  sections.map((s, i) =>
                                    i === index
                                      ? (next as unknown as Section)
                                      : s,
                                  ),
                                )
                              }
                            />
                          </div>
                        </details>
                      ))}
                    </>
                  ) : (
                    <SchemaField
                      name={heading || kind}
                      schema={registry.documents[kind]}
                      value={content}
                      assets={assets}
                      onChange={change}
                    />
                  )}
                </fieldset>
                {editable && (
                  <button
                    disabled={busy || !dirty}
                    onClick={() => mutate("draft")}
                    className="mt-6 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {busy ? "Working…" : "Save draft"}
                  </button>
                )}
                {!editable && (
                  <p className="mt-4 text-sm text-slate-500">
                    Read-only access. An administrator can edit this content.
                  </p>
                )}
              </section>
              {publisher && doc && (
                <section className="space-y-4 rounded-xl border bg-white p-5">
                  <h2 className="font-semibold">Publishing</h2>
                  {kind === 'PAGE' && <p className="text-sm text-slate-500">Page URL: /{key}. Publishing this page does not automatically replace the homepage.</p>}
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={busy || dirty}
                      className={button}
                      onClick={() => mutate("publish")}
                    >
                      Publish latest saved version
                    </button>
                    <button
                      disabled={busy || dirty || !doc.publishedVersionId}
                      className={button}
                      onClick={() => mutate("unpublish")}
                    >
                      Unpublish
                    </button>
                    <button
                      disabled={busy || dirty}
                      className={button}
                      onClick={() => mutate("archive")}
                    >
                      Archive
                    </button>
                  </div>
                  <label
                    className="block text-sm font-medium"
                    htmlFor="cms-schedule"
                  >
                    Schedule publication (your local time)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      id="cms-schedule"
                      type="datetime-local"
                      className={input + " max-w-xs"}
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                    />
                    <button
                      className={button}
                      disabled={busy || dirty || !scheduledAt}
                      onClick={() => mutate("schedule")}
                    >
                      Schedule saved version
                    </button>
                    {doc.scheduledAt && (
                      <button
                        className={button}
                        disabled={busy || dirty}
                        onClick={() => mutate("cancel-schedule")}
                      >
                        Cancel schedule
                      </button>
                    )}
                  </div>
                </section>
              )}
              {doc && (
                <section className="rounded-xl border bg-white p-5">
                  <h2 className="mb-4 font-semibold">Version history</h2>
                  <div className="space-y-3">
                    {versions.map((version) => (
                      <div
                        key={version.id}
                        className="flex flex-wrap items-center gap-2 border-b pb-3 text-sm"
                      >
                        <div className="mr-auto">
                          Version {version.version}
                          {version.id === doc.publishedVersionId
                            ? " · Live"
                            : ""}
                          <p className="text-xs text-slate-500">
                            {new Date(version.createdAt).toLocaleString()}
                          </p>
                        </div>
                        {editable && (
                          <button
                            className={button}
                            disabled={busy}
                            onClick={() => restore(version.version)}
                          >
                            Load into editor
                          </button>
                        )}
                        {publisher && (
                          <button
                            className={button}
                            disabled={busy || dirty}
                            onClick={() => mutate("rollback", version.version)}
                          >
                            Publish this version
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      className={button}
                      disabled={busy || historyPage === 1}
                      onClick={() => history(historyPage - 1)}
                    >
                      Previous
                    </button>
                    <span className="p-2 text-sm">Page {historyPage}</span>
                    <button
                      className={button}
                      disabled={busy || historyPage * 10 >= historyTotal}
                      onClick={() => history(historyPage + 1)}
                    >
                      Next
                    </button>
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed bg-white p-12 text-center text-slate-500">
              Select a document or create one to start editing.
            </div>
          )}
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          className={button}
          disabled={busy || listPage === 1}
          onClick={() => setListPage((p) => p - 1)}
        >
          Previous
        </button>
        <span className="text-sm text-slate-500">
          Page {listPage} · {total} {kind === "MEDIA" ? "images" : "documents"}
        </span>
        <button
          className={button}
          disabled={busy || listPage * 24 >= total}
          onClick={() => setListPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
function DraftPreview({
  kind,
  content,
  assets,
}: {
  kind: string;
  content: Record<string, Value>;
  assets: Asset[];
}) {
  if (kind === "THEME")
    return (
      <div
        className="space-y-6 rounded-xl border p-6"
        style={{
          background: String(content.background || "#ffffff"),
          color: String(content.heading || "#000000"),
          borderRadius: Number(content.radius ?? 12),
          fontFamily:
            content.fontFamily === "serif"
              ? "Georgia, serif"
              : "Arial, sans-serif",
        }}
      >
        <p className="text-xs uppercase tracking-widest">Theme preview</p>
        <h2 className="text-3xl font-bold">A fresh look for your store</h2>
        <div className="flex flex-wrap gap-3">
          {Object.entries(content)
            .filter(
              ([, value]) =>
                typeof value === "string" && /^#[a-f0-9]{6}$/i.test(value),
            )
            .map(([name, value]) => (
              <div key={name} className="rounded-lg border p-3 text-xs">
                <div
                  className="mb-2 h-10 w-16 rounded"
                  style={{ background: String(value) }}
                />
                {label(name)}
              </div>
            ))}
        </div>
        <span
          className="inline-block rounded-lg px-5 py-3 text-sm"
          style={{
            background: String(content.primary || "#48725c"),
            color: "#ffffff",
          }}
        >
          Shop collection
        </span>
        <p className="text-xs">
          Preview sample. Save and publish to make the theme available to the
          storefront.
        </p>
      </div>
    );
  const render = (value: Value, name = ""): React.ReactNode => {
    if (Array.isArray(value))
      return (
        <div className="space-y-3">
          {value.map((item, i) => (
            <div key={i} className="rounded-lg border p-3">
              {render(item)}
            </div>
          ))}
        </div>
      );
    if (value && typeof value === "object") {
      if (value.visible === false) return null;
      return (
        <div className="space-y-2">
          {Object.entries(value)
            .filter(([key]) => !["id", "responsive", "visible"].includes(key))
            .map(([key, item]) => (
              <div key={key}>{render(item, key)}</div>
            ))}
        </div>
      );
    }
    if (name === "assetId" || name.endsWith("AssetId")) {
      const asset = assets.find((a) => a.id === value);
      return asset?.url ? (
        <img
          src={assetUrl(asset.url)}
          alt={asset.altText || ""}
          className="max-h-52 rounded-lg object-contain"
        />
      ) : (
        <p className="text-xs text-slate-500">
          Image not in current library selection
        </p>
      );
    }
    return (
      <p
        className={
          ["title", "storeName", "label"].includes(name)
            ? "text-xl font-semibold"
            : "break-words text-sm text-slate-600"
        }
      >
        {String(value ?? "")}
      </p>
    );
  };
  return (
    <div className="space-y-4 rounded-lg bg-slate-50 p-5">
      <p className="text-xs font-semibold uppercase text-slate-500">
        Draft content preview · layout is illustrative
      </p>
      {render(content)}
    </div>
  );
}
