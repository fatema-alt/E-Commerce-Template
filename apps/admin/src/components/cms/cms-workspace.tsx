"use client";
import { useToastState } from "@/components/admin/toast-provider";
/* eslint-disable @next/next/no-img-element -- CMS assets support local and configured remote storage. */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  API,
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
import { PublicationControls } from "./publication-controls";
import { localDraftKey,readLocalDraft,writeLocalDraft,clearLocalDraft,editorStatus,publicationMessage,type LocalDraft } from "./local-draft";
import { pageSlug, validPageSlug } from "./page-address";
import { StoreLookEditor } from "./store-look-editor";
import { CMS_AREAS, THEME_PRESETS } from "./cms-task-config";
import { EngagementPreview, engagementDefaults } from "./engagement-preview";

const tabs = [
  ["SITE_SETTINGS", "Store info", "settings"],
  ["THEME", "Look", "theme"],
  ["PAGE", "Pages", "pages"],
  ["NAVIGATION", "Menus", "navigation"],
  ["MEDIA", "Media Library", "media"],
  ["ANNOUNCEMENTS", "Announcement Bar", "announcements"],
  ["CONTACT_WIDGET", "Floating Contact Widget", "contact-widget"],
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
  area,
  settingsDocumentKey = "default",
  fallbackHomeKey = "home",
}: {
  kind: string;
  area?: "homepage" | "pages";
  settingsDocumentKey?: string;
  fallbackHomeKey?: string;
  defaultKey?: string;
  scope?: "announcementRibbon" | "contactWidget";
}) {
  const [registry, setRegistry] = useState<Registry | null>(null);
  const [role, setRole] = useState("STAFF");
  const [owner,setOwner]=useState<string|null>(null);
  const [editRevision,setEditRevision]=useState(0);
  const [pendingRecovery,setPendingRecovery]=useState<LocalDraft|null>(null);
  const [localWarning,setLocalWarning]=useState("");
  const [conflict,setConflict]=useState(false);
  const mutationInFlight=useRef(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetPage, setAssetPage] = useState(1);
  const [assetTotal, setAssetTotal] = useState(0);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [listPage, setListPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [key, setKey] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newTitle,setNewTitle]=useState("");
  const [customSlug,setCustomSlug]=useState(false);
  const [homepage,setHomepage]=useState<{settingsKey:string;settingsRevision:number;settingsPublished:boolean;homePageKey:string}|null>(null);
  const [publishedElsewhere,setPublishedElsewhere]=useState(false);
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
  const [builderMode, setBuilderMode] = useState(area !== "pages");
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
      request<{ user: { role: string; id:string } }>("/auth/me"),
      request<{ items: Asset[]; total: number }>("/admin/cms/media?limit=100"),
    ])
      .then(([schema, auth, media]) => {
        if (live) {
          setRegistry(schema);
          setRole(auth.user.role);
          setOwner(auth.user.id);
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
      event.returnValue="";
    };
    window.addEventListener("beforeunload", prevent);
    const navigate = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest("a");
      if(anchor){const target=new URL(anchor.href);const current=new URL(window.location.href);if(anchor.target==='_blank'||target.origin===current.origin&&target.pathname===current.pathname&&target.search===current.search)return;}
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
  const recoveryFor=useCallback((documentKey:string)=>{
    if(!owner)return null;
    try{return readLocalDraft(window.localStorage,localDraftKey(API,owner,kind,documentKey));}
    catch{setLocalWarning('Local safety copy unavailable or damaged. Keep this tab open and save your work explicitly.');return null;}
  },[owner,kind]);
  const beginEditing=useCallback((documentKey:string,revision:number)=>{
    setEditRevision(revision);setConflict(false);setPendingRecovery(recoveryFor(documentKey));
  },[recoveryFor]);
  function preserveLocal(value:Record<string,Value>,documentKey=key,revision=editRevision){
    if(!owner||!documentKey||!editable)return;
    try{writeLocalDraft(window.localStorage,localDraftKey(API,owner,kind,documentKey),{format:1,baseRevision:revision,content:value,savedAt:Date.now()});setLocalWarning('');}
    catch{setLocalWarning('Browser storage is unavailable or full. Your changes are only in this tab until you save.');}
  }
  function clearSafetyCopy(){
    if(!owner)return;
    try{clearLocalDraft(window.localStorage,localDraftKey(API,owner,kind,key));setLocalWarning('');}
    catch{setLocalWarning('Saved to the server, but the old browser safety copy could not be removed.');}
  }
  function restoreLocal(){
    if(!pendingRecovery || !editable)return;
    setContent(pendingRecovery.content);setEditRevision(pendingRecovery.baseRevision);setDirty(true);
    setConflict(pendingRecovery.baseRevision!==(doc?.revision??0));setPendingRecovery(null);
  }
  function change(value:Value){
    if(!editable||pendingRecovery)return;
    setContent(value as Record<string,Value>);setDirty(true);setNotice('');preserveLocal(value as Record<string,Value>);
  }
  const open = useCallback(async (documentKey: string) => {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    setPublishedElsewhere(false);
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
      beginEditing(documentKey,next.revision);
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
      if (kind === "SITE_SETTINGS" && e instanceof CmsRequestError && e.status === 404) {
        if (current !== sequence.current) return;
        setKey(documentKey); setDoc(null); beginEditing(documentKey,0);
        setContent({ storeName: "DS Mart", locale: "en", currency: "BDT", ...(scope ? { [scope]: engagementDefaults[scope] } : {}) });
        setVersions([]); setHistoryTotal(0); setDirty(true);
        setNotice("New Site Settings draft. Configure, save and publish when ready.");
      } else if (kind === "THEME" && e instanceof CmsRequestError && e.status === 404) {
        if (current !== sequence.current) return;
        setKey(documentKey); setDoc(null); beginEditing(documentKey,0);setContent({...THEME_PRESETS[1].values});
        setVersions([]); setHistoryTotal(0); setDirty(true);
        setNotice("Choose a look, save a draft and publish when ready.");
      } else if (kind === "PAGE" && (area === "homepage" && documentKey === homepage?.homePageKey || !!recoveryFor(documentKey)) && e instanceof CmsRequestError && e.status === 404) {
        if (current !== sequence.current) return;
        setKey(documentKey);
        setDoc(null);beginEditing(documentKey,0);
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
  }, [dirty, kind, scope, area, homepage, beginEditing, recoveryFor, setError, setNotice]);

  const loadHomepage=useCallback(async()=>{
    const next=await request<{settingsKey:string;settingsRevision:number;settingsPublished:boolean;homePageKey:string}>("/admin/cms/homepage/context?"+new URLSearchParams({settingsKey:settingsDocumentKey,fallbackHomeKey}));
    setHomepage(next);return next;
  },[settingsDocumentKey,fallbackHomeKey]);
  useEffect(()=>{if(kind==='PAGE')void Promise.resolve().then(loadHomepage).catch(error=>setError(error.message));},[kind,loadHomepage,setError]);
  async function assignHomepage(target:Document){
    if(!publisher || !target.publishedVersionId || !homepage || busy || !canLeave())return;
    if(!window.confirm('Use this published page as your homepage? Only the live homepage selection changes. Unpublished Store info changes remain private.'))return;
    setBusy(true);setError('');
    try{
      await request('/admin/cms/homepage/assign',{method:'POST',body:JSON.stringify({settingsKey:settingsDocumentKey,pageKey:target.key,expectedSettingsRevision:homepage.settingsRevision,expectedPageRevision:target.revision})});
      await loadHomepage();setPublishedElsewhere(false);setNotice('Homepage updated. Other unpublished Store info changes were not published.');
    }catch(error){setError((error as Error).message);}finally{setBusy(false);}
  }
  const initialOpenedRef = useRef(false);
  useEffect(() => {
    if (initialOpenedRef.current || loading || !owner || (kind === "PAGE" && !homepage)) return;
    initialOpenedRef.current = true;
    const urlKey =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("key")
        : null;
    const targetKey = area === "homepage" ? homepage!.homePageKey : urlKey || defaultKey || (kind === "PAGE" && area !== "pages" ? "home" : "");
    if (targetKey) {
      void Promise.resolve().then(() => open(targetKey));
    }
  }, [loading, kind, defaultKey, open, area, homepage,owner]);
  async function create() {
    if (!registry || !canLeave()) return;
    if(kind === 'PAGE') {
      if(!newTitle.trim() || !validPageSlug(newKey)){setError('Enter a page title and choose an available URL that does not use a store route.');return;}
      setBusy(true);
      try{const result=await request<{available:boolean}>('/admin/cms/page-address/'+encodeURIComponent(newKey));if(!result.available){setError('This page URL is already used or reserved. Choose another in Advanced.');return;}}
      catch(error){setError((error as Error).message);return;}finally{setBusy(false);}
    }
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(newKey)) {
      setError(
        "Use 1â€“64 lowercase letters, numbers, hyphens or underscores for the document key.",
      );
      return;
    }
    setKey(newKey);
    setDoc(null);
    setPublishedElsewhere(false);
    let initial =
      kind === "THEME"
        ? { ...registry.defaultTheme }
        : (initialValue(registry.documents[kind]) as Record<string, Value>);
    if (kind === "PAGE") {
      initial = {
        ...initial,
        title: newTitle.trim(),
        sections: [] as unknown as Value,
      };
    }
    setContent(initial);
    beginEditing(newKey,0);if(!recoveryFor(newKey))preserveLocal(initial,newKey,0);
    if(kind==='PAGE'){const url=new URL(window.location.href);url.searchParams.set('key',newKey);window.history.replaceState(null,'',url);}
    setVersions([]);
    setHistoryTotal(0);
    setDirty(true);
    setError("");
    setNotice("");
  }
  async function mutate(action: string, version?: number) {
    if(mutationInFlight.current || conflict || pendingRecovery)return;
    if(action==='draft'&&!editable || action!=='draft'&&!publisher)return;
    if (action !== "draft" && dirty) {
      setError(
        "Save your draft before publishing or changing publication status.",
      );
      return;
    }
    const confirmation=publicationMessage(action,String(content.title || heading || 'this content'),version);
    if(confirmation&&!window.confirm(confirmation))return;
    if (
      action === "schedule" &&
      (!scheduledAt || !Number.isFinite(new Date(scheduledAt).getTime()))
    ) {
      setError("Choose a valid future publication time.");
      return;
    }
    mutationInFlight.current=true;
    setBusy(true);
    setError("");
    setNotice("");
    const payloadContent = { ...content };
    let committed=false;
    try {
      const saved=await request<{revision:number}>(`/admin/cms/${kind}/${key}/${action}`, {
        method: action === "draft" ? "PATCH" : "POST",
        body: JSON.stringify({
          expectedRevision: action==='draft'?editRevision:(doc?.revision??0),
          ...(action === "draft" ? { content: payloadContent } : {}),
          ...(version ? { version } : {}),
          ...(action === "schedule"
            ? { scheduledAt: new Date(scheduledAt).toISOString() }
            : {}),
        }),
      });
      committed=true;
      if(action==='draft'){clearSafetyCopy();setDirty(false);setEditRevision(saved.revision);}
      const next = await request<Document>(`/admin/cms/${kind}/${key}`);
      setDoc(next);setEditRevision(next.revision);
      if(kind === 'PAGE' && ['publish','rollback'].includes(action)) {
        const currentHomepage=await loadHomepage();setPublishedElsewhere(currentHomepage.homePageKey!==key);
      }
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
      if(committed){setConflict(true);setError('The server saved your action, but refreshing failed. Reload saved content before making another change.');}
      else if(e instanceof CmsRequestError && e.status===409){setConflict(true);setError('Content changed on the server. Your local changes are retained. Reload and review before saving or publishing.');}
      else setError((e as Error).message);
    } finally {
      mutationInFlight.current=false;
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
      change(result.content);
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
  const heading = area === "homepage" ? "Homepage" : scope === "announcementRibbon" ? "Announcement Bar" : scope === "contactWidget" ? "Floating Contact Widget" : tabs.find((tab) => tab[0] === kind)?.[1];
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
      </div>
      <nav
        aria-label="CMS navigation"
        className="flex flex-wrap gap-2 border-b pb-4"
      >
        {CMS_AREAS.map(item => {
          const active = item.kind === kind && (kind !== "PAGE" || item.id === (area || "pages"));
          return <Link key={item.id} href={item.href} onClick={event=>{if(!canLeave())event.preventDefault();}} aria-current={active ? "page" : undefined} className={"cms-area-link " + (active ? "cms-area-active" : "")}>{item.title}</Link>;
        })}
        <Link className="cms-area-link" href="/cms/media" onClick={event=>{if(!canLeave())event.preventDefault();}} aria-current={kind === "MEDIA" ? "page" : undefined}>Media library</Link>
      </nav>
      {kind === 'PAGE' && <div className="cms-homepage-status" role="status">
        {!homepage ? <p>Loading homepage selection?</p> : <>
          <p>Homepage: <Link className="underline" href="/cms/homepage">/{homepage.homePageKey}</Link></p>
          {!homepage.settingsPublished && <p>Publish <Link href="/cms/settings" className="underline">Store info</Link> before changing the homepage.</p>}
          {key === homepage.homePageKey ? <strong>Current homepage</strong> : key && <span>Page URL: /{key}</span>}
          {publishedElsewhere && <p>Published. This page is not your homepage.</p>}
          {doc?.publishedVersionId && key !== homepage.homePageKey && <button type="button" className={button} disabled={busy || dirty || !publisher} onClick={()=>assignHomepage(doc)}>Use as homepage</button>}
          {!publisher && doc?.publishedVersionId && key!==homepage.homePageKey && <p>Ask a Super Admin to change the homepage.</p>}
          {key && <details><summary>Advanced</summary><label htmlFor="cms-page-url">Page URL (read-only after creation)</label><input id="cms-page-url" className={input} value={'/'+key} readOnly /></details>}
        </>}
      </div>}



      {key && kind!=='MEDIA' && <>
        {localWarning&&<p role="alert" className="cms-recovery-warning">{localWarning}</p>}
        {pendingRecovery&&<section className="cms-recovery" aria-label="Local recovery"><p>Unsaved changes found, restore?</p><p>These changes are stored only in this browser and have not been saved to the server.</p>{editable&&<div><button type="button" className={button} onClick={restoreLocal}>Restore unsaved changes</button><button type="button" className={button} onClick={()=>{clearSafetyCopy();setPendingRecovery(null);}}>Discard local copy</button></div>}</section>}
        {conflict&&<section role="alert" className="cms-recovery-warning"><p>Content changed on the server. Saving and publishing are stopped. Your local changes are retained; reload and review before continuing.</p><button type="button" className={button} disabled={busy} onClick={()=>open(key)}>Reload saved content</button></section>}
        <PublicationControls doc={doc} status={editorStatus(doc,dirty,doc?.latestVersion?.id || versions.find(v=>v.version===doc?.latestVersion?.version)?.id)} dirty={dirty} busy={busy} conflict={conflict||!!pendingRecovery} editable={editable} publisher={publisher} versions={versions} historyPage={historyPage} historyTotal={historyTotal} scheduledAt={scheduledAt} onDate={setScheduledAt} onAction={mutate} onHistory={history} onRestore={restore} />
      </>}
      {loading ? (
        <p role="status">Loading CMSâ€¦</p>
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
                  aria-label="Switch page"
                  value={key}
                  disabled={busy}
                  onChange={(e) => open(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {!documents.some(item=>item.key===key) && <option value={key}>{String(content.title || key)}</option>}
                  {documents.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.title || item.key} ({item.state.toLowerCase()})
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
            busy={busy}
            editable={editable&&!pendingRecovery}
            onNotice={(msg) => setNotice(msg)}
          />


        </div>
      ) : (
        <div className={kind === "SITE_SETTINGS" || kind === "THEME" ? "grid items-start gap-6" : "grid items-start gap-6 xl:grid-cols-[240px_minmax(0,1fr)]"}>
          <aside style={{order: kind === "SITE_SETTINGS" || kind === "THEME" ? 2 : undefined}} className="cms-config-browser space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <details open={kind === "PAGE" || kind === "NAVIGATION"}>
            <summary className="cursor-pointer font-semibold">{kind === "PAGE" ? "Pages" : kind === "NAVIGATION" ? "Menus" : "Advanced: saved configurations"}</summary>
            {documents.map((item) => (
              <div key={item.key} className="space-y-2">
              <button
                key={item.key}
                disabled={busy}
                onClick={() => open(item.key)}
                className={`cms-page-open w-full rounded-lg border p-3 text-left text-sm ${key === item.key ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40" : "border-slate-200 dark:border-slate-800"}`}
              >
                <span className="cms-page-label block break-all font-medium">{item.title || item.key}{kind === "PAGE" && item.key === homepage?.homePageKey && <span className="cms-homepage-badge block text-xs">Current homepage</span>}</span>
                <span className="text-xs text-slate-500">
                  {item.state.toLowerCase()}
                </span>
              </button>
              {kind === 'PAGE' && item.publishedVersionId && item.key!==homepage?.homePageKey && <button type="button" className={button} disabled={busy || !publisher || dirty} onClick={()=>assignHomepage(item)} aria-label={'Use '+(item.title || item.key)+' as homepage'}>Use as homepage</button>}
              </div>
            ))}
            {!documents.length && (
              <p className="text-sm text-slate-500">
                Create your first page below.
              </p>
            )}
            {editable && (
              <div className="space-y-2 border-t dark:border-slate-800 pt-4">
                {kind === 'PAGE' ? <>
                  <label className="text-sm font-semibold" htmlFor="cms-new-title">Page title</label>
                  <input id="cms-new-title" className={input} value={newTitle} disabled={busy} onChange={event=>{setNewTitle(event.target.value);if(!customSlug)setNewKey(pageSlug(event.target.value));}} />
                  <p className="text-xs">URL: /{newKey || 'your-page'}</p>
                  <details><summary className="cursor-pointer">Advanced</summary><label htmlFor="cms-new-key">URL slug</label><input id="cms-new-key" className={input} value={newKey} disabled={busy} onChange={event=>{setCustomSlug(true);setNewKey(event.target.value);}} /></details>
                </> : <>
                  <label htmlFor="cms-new-key">New configuration</label><input id="cms-new-key" className={input} value={newKey} disabled={busy} onChange={event=>setNewKey(event.target.value)} />
                </>}
                <button
                  className={button + " w-full"}
                  disabled={busy || !registry}
                  onClick={create}
                >
                  + Create {kind === "PAGE" ? "page" : heading}
                </button>
              </div>
            )}
            </details>
          </aside>
          {key && registry ? (
            <div className="min-w-0 space-y-5">
              <section className="rounded-xl border bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="break-all text-xl font-semibold">{kind === "SITE_SETTINGS" || kind === "THEME" ? heading : String(content.title || content.label || key)}</h2>

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
                  disabled={!editable || busy || !!pendingRecovery}
                  className="mt-6 min-w-0 space-y-5"
                >
                  {scope ? (
                    <div className="engagement-editor">
                      <div><p className="mb-4 text-sm text-slate-500">Settings are part of the selected Site Settings document. Publishing also publishes its other saved changes. Times use your local timezone and are saved in UTC. Array order controls display order.</p><SchemaField name={heading || scope} schema={registry.documents.SITE_SETTINGS.properties![scope]} value={content[scope] ?? engagementDefaults[scope]} assets={assets} onChange={value => change({ ...content, [scope]: value })} /></div>
                      <EngagementPreview scope={scope} value={content[scope] ?? engagementDefaults[scope]} />
                    </div>
                  ) : preview ? (
                    <DraftPreview
                      kind={kind}
                      content={content}
                      assets={assets}
                    />
                  ) : kind === "SITE_SETTINGS" || kind === "THEME" ? (
                    <StoreLookEditor kind={kind} schema={registry.documents[kind]} content={content} assets={assets} onChange={value=>change(value)} />
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
                                {delta < 0 ? "â†‘" : "â†“"}
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
                {!editable && (
                  <p className="mt-4 text-sm text-slate-500">
                    Read-only access. An administrator can edit this content.
                  </p>
                )}
              </section>

            </div>
          ) : (
            <div className="rounded-xl border border-dashed bg-white p-12 text-center text-slate-500">
              {kind === "PAGE" ? "Choose a page or create one to start editing." : "Select a configuration or create one to start editing."}
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
          Page {listPage} / {Math.max(1,Math.ceil(total/24))} - {total} {kind === "MEDIA" ? "images" : kind === "PAGE" ? "pages" : "configurations"}
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
        Draft content preview Â· layout is illustrative
      </p>
      {render(content)}
    </div>
  );
}
