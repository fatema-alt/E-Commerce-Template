import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL("../src/components/cms/local-draft.ts", import.meta.url),
    "utf8",
  ),
  { compilerOptions: { module: ts.ModuleKind.ESNext } },
);
const {
  localDraftKey,
  writeLocalDraft,
  readLocalDraft,
  clearLocalDraft,
  editorStatus,
  publicationMessage,
} = await import(
  "data:text/javascript;base64," + Buffer.from(outputText).toString("base64")
);
const values = new Map();
const store = {
  getItem: (key) => values.get(key) || null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};
const key = localDraftKey("api", "admin", "PAGE", "home");
const input = {
  format: 1,
  baseRevision: 3,
  content: {
    title: "",
    sections: [
      {
        id: "one",
        type: "hero",
        visible: true,
        config: { title: "", image: { assetId: "incomplete" } },
      },
    ],
  },
  savedAt: Date.now(),
};
writeLocalDraft(store, key, input);
assert.deepEqual(readLocalDraft(store, key), input);
assert.equal(
  readLocalDraft(store, localDraftKey("api", "another-admin", "PAGE", "home")),
  null,
);
assert.notEqual(key, localDraftKey("other-api", "admin", "PAGE", "home"));
assert.notEqual(key, localDraftKey("api", "admin", "PAGE", "about"));
clearLocalDraft(store, key);
assert.equal(readLocalDraft(store, key), null);
store.setItem(key, "{broken");
assert.throws(() => readLocalDraft(store, key));
store.setItem(key, JSON.stringify({ ...input, baseRevision: -1 }));
assert.throws(() => readLocalDraft(store, key));
assert.throws(() =>
  writeLocalDraft(
    {
      setItem: () => {
        throw Error("Quota exceeded");
      },
    },
    key,
    input,
  ),
);
const doc = { publishedVersionId: "one", scheduledAt: null };
assert.equal(editorStatus(null, false), "Not saved");
assert.equal(editorStatus(doc, true, "one"), "Not saved");
assert.equal(editorStatus(doc, false, "one"), "Live");
assert.equal(editorStatus(doc, false, "two"), "Draft changes (not live)");
assert.equal(
  editorStatus({ ...doc, publishedVersionId: null }, false),
  "Saved",
);
assert.equal(
  editorStatus({ ...doc, scheduledAt: "2030-01-01" }, false, "one"),
  "Scheduled",
);
assert(publicationMessage("publish", "Home").includes("live site"));
assert(publicationMessage("rollback", "Home", 2).includes("version 2"));
assert(
  publicationMessage("unpublish", "Home").includes(
    "no longer be publicly available",
  ),
);
assert.equal(publicationMessage("draft", "Home"), null);
console.log(
  "PASS: invalid intermediate input survives local recovery; account/API/document isolation; clear, corruption, quota errors; statuses and live-impact confirmation text",
);
