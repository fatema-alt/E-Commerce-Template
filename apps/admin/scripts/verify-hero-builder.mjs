import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function loadModule(relativePath) {
  const fullPath = resolve(__dirname, relativePath);
  const code = ts.transpileModule(readFileSync(fullPath, "utf8"), {
    fileName: fullPath,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;

  const module = { exports: {} };
  const customRequire = (id) => {
    if (id.startsWith("@/")) {
      const target = resolve(__dirname, "../src", id.slice(2));
      const ext = [target, `${target}.ts`, `${target}.tsx`].find(existsSync);
      return loadModule(ext);
    }
    if (id.startsWith(".")) {
      const target = resolve(dirname(fullPath), id);
      const ext = [target, `${target}.ts`, `${target}.tsx`].find(existsSync);
      return loadModule(ext);
    }
    return require(id);
  };

  new Function("require", "exports", "module", code)(customRequire, module.exports, module);
  return module.exports;
}

console.log("Running hero builder unit & contract tests...");

const heroSlidesModule = loadModule("../src/components/cms/hero-slides.ts");
const heroInspectorModule = loadModule("../src/components/cms/hero-inspector.tsx");

const { editableHeroSlides } = heroSlidesModule;
const { hexToLuminance, getContrastRatio } = heroInspectorModule;

// 1. Test editableHeroSlides backwards compatibility
const legacyBanner = {
  bannerType: "without_button",
  title: "Legacy Full Banner",
  bannerLink: "/sale",
  image: { assetId: "asset-1", alt: "Banner image" },
  theme: "lime",
};

const promoted = editableHeroSlides(legacyBanner);
assert.equal(promoted.length, 1, "Promoted legacy banner has 1 slide");
assert.equal(promoted[0].title, "Legacy Full Banner");
assert.equal(promoted[0].slideType, "full_banner");
assert.equal(promoted[0].enabled, true);
assert.equal(promoted[0].bannerLink, "/sale");
assert.equal(promoted[0].theme, "lime");

const splitBanner = {
  bannerType: "with_button",
  title: "Split Banner",
  subtitle: "With button",
  button: { label: "Shop", href: "/shop" },
  badge: "Eyebrow",
  themePreset: "dark",
  imageBackdrop: "circle",
};

const promotedSplit = editableHeroSlides(splitBanner);
assert.equal(promotedSplit.length, 1);
assert.equal(promotedSplit[0].slideType, "split_content");
assert.equal(promotedSplit[0].themePreset, "dark");
assert.equal(promotedSplit[0].imageBackdrop, "circle");
assert.equal(promotedSplit[0].badge, "Eyebrow");

// Slides array already present
const existingSlides = [
  { title: "Slide 1", enabled: true, themePreset: "lime" },
  { title: "Slide 2", enabled: false, themePreset: "light" },
];
const untouched = editableHeroSlides({ slides: existingSlides });
assert.deepEqual(untouched, existingSlides);

// 2. Test Contrast calculations
// Dark slate (#0f172a) on white (#ffffff)
const darkOnWhite = getContrastRatio("#0f172a", "#ffffff");
assert.ok(darkOnWhite >= 15, `Dark on white contrast should be high, got ${darkOnWhite}`);

// Near black on near black should fail
const failRatio = getContrastRatio("#0f172a", "#1e293b");
assert.ok(failRatio < 4.5, `Low contrast should be < 4.5, got ${failRatio}`);

// Lime (#d8f45a) on dark (#0f172a)
const limeOnDark = getContrastRatio("#0f172a", "#d8f45a");
assert.ok(limeOnDark >= 10, `Lime on dark contrast should be > 10, got ${limeOnDark}`);

// Warm cream (#faf8f5) on dark (#0f172a)
const creamOnDark = getContrastRatio("#0f172a", "#faf8f5");
assert.ok(creamOnDark >= 15, `Cream on dark contrast should be > 15, got ${creamOnDark}`);

// 3. Test hexToLuminance boundaries
assert.equal(hexToLuminance("invalid"), 0);
assert.equal(Math.round(hexToLuminance("#ffffff") * 100), 100);
assert.equal(Math.round(hexToLuminance("#000000") * 100), 0);

console.log("PASS: Hero builder unit tests & WCAG contrast verifications passed!");
