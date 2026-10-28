import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(
  new URL("../src/components/cms/page-address.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2023,
  },
});
const { pageSlug, validPageSlug, RESERVED_PAGE_ROUTES } = await import(
  "data:text/javascript;base64," + Buffer.from(outputText).toString("base64")
);
for (const [title, slug] of [
  ["About Us", "about-us"],
  ["  Return & Refund Policy  ", "return-refund-policy"],
  ["Caf\u00e9 Products", "cafe-products"],
  ["", ""],
])
  assert.equal(pageSlug(title), slug);
const bengali = "\u09ac\u09be\u0982\u09b2\u09be \u09aa\u09be\u09a4\u09be";
assert.equal(pageSlug(bengali), pageSlug(bengali));
assert(validPageSlug(pageSlug(bengali)));
assert(pageSlug("A".repeat(90)).length <= 64);
for (const name of RESERVED_PAGE_ROUTES)
  assert.equal(validPageSlug(name), false);
for (const value of ["../page", "UPPER", "page name", "a".repeat(65)])
  assert.equal(validPageSlug(value), false);
console.log(
  "PASS: title-to-slug generation, Bengali fallback, length bounds and reserved/invalid routes",
);
