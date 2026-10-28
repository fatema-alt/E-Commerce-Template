"use client";
import { button, input } from "./schema-fields";
import type { Document } from "./cms-api";
type Version = { id: string; version: number; createdAt: string };
type Props = {
  doc: Document | null;
  status: string;
  dirty: boolean;
  busy: boolean;
  conflict: boolean;
  editable: boolean;
  publisher: boolean;
  versions: Version[];
  historyPage: number;
  historyTotal: number;
  scheduledAt: string;
  onDate: (date: string) => void;
  onAction: (action: string, version?: number) => void;
  onHistory: (page: number) => void;
  onRestore: (version: number) => void;
};
export function PublicationControls(p: Props) {
  const blocked = p.busy || p.conflict;
  return (
    <section className="cms-publication" aria-label="Save and publish">
      <div className="cms-publication-main">
        <p role="status" aria-live="polite">
          <strong>{p.status}</strong>
          {p.doc?.scheduledAt && (
            <span>
              Scheduled for {new Date(p.doc.scheduledAt).toLocaleString()}
            </span>
          )}
        </p>
        <div>
          {p.editable && (
            <button
              type="button"
              className={button}
              disabled={blocked || !p.dirty}
              onClick={() => p.onAction("draft")}
            >
              Save draft
            </button>
          )}
          <button
            type="button"
            className="cms-publish-primary"
            disabled={
              blocked || p.dirty || !p.doc?.latestVersion || !p.publisher
            }
            aria-describedby={
              !p.publisher ? "cms-publish-permission" : undefined
            }
            onClick={() => p.onAction("publish")}
          >
            Publish
          </button>
        </div>
      </div>
      {!p.publisher && (
        <p id="cms-publish-permission">Ask a Super Admin to publish.</p>
      )}
      {p.dirty && (
        <p>
          Not saved to the server. Use Save draft to create a saved version.
        </p>
      )}
      {p.doc && (
        <details className="cms-publication-options">
          <summary>History and options</summary>
          {p.publisher && (
            <div className="cms-publication-tools">
              <label htmlFor="cms-schedule">
                Schedule publication (your local time)
              </label>
              <input
                id="cms-schedule"
                type="datetime-local"
                className={input}
                value={p.scheduledAt}
                disabled={blocked || p.dirty}
                onChange={(e) => p.onDate(e.target.value)}
              />
              <div>
                <button
                  type="button"
                  className={button}
                  disabled={blocked || p.dirty || !p.scheduledAt}
                  onClick={() => p.onAction("schedule")}
                >
                  Schedule
                </button>
                {p.doc.scheduledAt && (
                  <button
                    type="button"
                    className={button}
                    disabled={blocked || p.dirty}
                    onClick={() => p.onAction("cancel-schedule")}
                  >
                    Cancel schedule
                  </button>
                )}
                <button
                  type="button"
                  className={button}
                  disabled={blocked || p.dirty || !p.doc.publishedVersionId}
                  onClick={() => p.onAction("unpublish")}
                >
                  Unpublish
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={blocked || p.dirty}
                  onClick={() => p.onAction("archive")}
                >
                  Archive
                </button>
              </div>
            </div>
          )}
          <h2>Saved history</h2>
          {p.versions.map((v) => (
            <div className="cms-history-row" key={v.id}>
              <span>
                Version {v.version}
                {v.id === p.doc?.publishedVersionId ? " - Live" : ""}
                <small>{new Date(v.createdAt).toLocaleString()}</small>
              </span>
              <div>
                {p.editable && (
                  <button
                    type="button"
                    className={button}
                    disabled={blocked}
                    onClick={() => p.onRestore(v.version)}
                  >
                    Load into editor
                  </button>
                )}
                {p.publisher && (
                  <button
                    type="button"
                    className={button}
                    disabled={blocked || p.dirty}
                    onClick={() => p.onAction("rollback", v.version)}
                  >
                    Restore and publish
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="cms-history-pager">
            <button
              type="button"
              className={button}
              disabled={p.busy || p.historyPage === 1}
              onClick={() => p.onHistory(p.historyPage - 1)}
            >
              Previous history
            </button>
            <span>Page {p.historyPage}</span>
            <button
              type="button"
              className={button}
              disabled={p.busy || p.historyPage * 10 >= p.historyTotal}
              onClick={() => p.onHistory(p.historyPage + 1)}
            >
              Next history
            </button>
          </div>
        </details>
      )}
    </section>
  );
}
