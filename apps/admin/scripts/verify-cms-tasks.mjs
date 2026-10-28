import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(
  new URL("../src/components/cms/cms-task-config.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
});
const { CMS_AREAS, THEME_PRESETS, applyThemePreset, STORE_GROUPS } =
  await import(
    "data:text/javascript;base64," + Buffer.from(outputText).toString("base64")
  );
const { validateCmsContent } =
  await import("../../api/dist/cms/cms-validation.js");
assert.deepEqual(
  CMS_AREAS.map((area) => area.title),
  ["Store info", "Look", "Homepage", "Pages", "Menus"],
);
assert.equal(new Set(CMS_AREAS.map((area) => area.href)).size, 5);
assert.equal(STORE_GROUPS.length, 4);
assert(
  STORE_GROUPS.some((group) => group.fields.includes("announcementRibbon")),
);
assert(STORE_GROUPS.some((group) => group.fields.includes("contactWidget")));
for (const preset of THEME_PRESETS) {
  const original = {
    primary: "#123456",
    background: "#FFFFFF",
    heading: "#000000",
    secondarySurface: "#EEEEEE",
    accent: "#ABCDEF",
    radius: 19,
    spacing: 6,
    productCardStyle: "raised",
  };
  const result = applyThemePreset(original, preset);
  validateCmsContent("THEME", result);
  assert.equal(result.radius, 19);
  assert.equal(result.spacing, 6);
  assert.equal(result.productCardStyle, "raised");
  assert.equal(original.primary, "#123456");
}
console.log(
  "PASS: five distinct task areas; unified store fields; all four presets pass real API validation and preserve unrelated settings",
);
