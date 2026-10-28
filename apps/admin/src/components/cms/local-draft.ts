import type { Document, Value } from "./cms-api";
export type LocalDraft = {
  format: 1;
  baseRevision: number;
  content: Record<string, Value>;
  savedAt: number;
};
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function localDraftKey(
  api: string,
  owner: string,
  kind: string,
  key: string,
) {
  return "cms-unsaved:v1:" + JSON.stringify([api, owner, kind, key]);
}
export function readLocalDraft(store: Store, key: string): LocalDraft | null {
  const raw = store.getItem(key);
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (
    !value ||
    value.format !== 1 ||
    !Number.isSafeInteger(value.baseRevision) ||
    value.baseRevision < 0 ||
    !Number.isFinite(value.savedAt) ||
    !value.content ||
    typeof value.content !== "object" ||
    Array.isArray(value.content)
  )
    throw Error("Invalid local safety copy");
  return value;
}
export function writeLocalDraft(store: Store, key: string, value: LocalDraft) {
  store.setItem(key, JSON.stringify(value));
}
export function clearLocalDraft(store: Store, key: string) {
  store.removeItem(key);
}
export function editorStatus(
  doc: Document | null,
  dirty: boolean,
  latestId?: string,
) {
  if (dirty || !doc) return "Not saved";
  if (doc.scheduledAt) return "Scheduled";
  if (doc.publishedVersionId)
    return latestId === doc.publishedVersionId
      ? "Live"
      : "Draft changes (not live)";
  return "Saved";
}
export function publicationMessage(
  action: string,
  name: string,
  version?: number,
) {
  if (action === "publish")
    return (
      "Publish " +
      name +
      "? Its latest saved content will become visible on the live site. Unsaved editor changes are not included."
    );
  if (action === "rollback")
    return (
      "Restore and publish saved version " +
      version +
      " of " +
      name +
      "? This replaces its current live content. Other saved versions remain in history."
    );
  if (action === "unpublish")
    return (
      "Unpublish " +
      name +
      "? Its CMS content will no longer be publicly available. Saved content and history are retained."
    );
  if (action === "archive")
    return (
      "Archive " +
      name +
      "? Its live CMS content will be removed; history is retained."
    );
  if (action === "schedule")
    return (
      "Schedule the latest saved content of " +
      name +
      "? It will replace the live content at the selected time."
    );
  return null;
}
