# Modern Hero Spotlight Slider: Production Upgrade Proposal

**Project:** DS Mart E-Commerce Platform  
**Target:** Live Homepage CMS Configuration (`home` document)  
**Author:** DS Mart Engineering  
**Status:** Ready for Owner Review & Publication  
**Constraints Followed:** Zero Database / Prisma Schema Mutations; Zero direct SQL updates to live records; WP1 Marketing Claims Compliance.

---

## 1. Executive Summary

This proposal presents the production upgrade for the DS Mart homepage hero section. The new design replaces the legacy slider with a modern, high-contrast **Spotlight Slider** housed inside a 24px rounded card (height ~320px on desktop, fully responsive on 390px and 320px mobile viewports).

The upgrade is **100% backwards compatible**:
- Existing published and draft documents in the database continue rendering without errors or regressions.
- Legacy `full_banner` slides display edge-to-edge artwork with frosted glass controls overlaid on top.
- Legacy `theme` values (`lime`, `blue`, `pink`) preserve their original color tints via automated gradient fallbacks.
- New fields (`themePreset`, `customTheme`, `imageBackdrop`, `showArrows`, `showProgress`, `pauseOnHover`, `secondaryButton`) are optional with zero database migration required.

---

## 2. Production Database Audit (Read-Only)

A read-only audit of the production PostgreSQL database (`prisma.cmsVersion` and `prisma.cmsDocument`) identified:
- **Total CMS Document Versions:** 7 versions across 2 documents (`home` and `hero`).
- **Published Document:** `home` (Document ID `f46e9bc3`, Version ID `402a5a4a`, Revision `5`).
  - **Slide 1:** `title="Shop Smart. Live Smart."`, `theme="lime"`, `bannerType="without_button"` (Full banner graphic)
  - **Slide 2:** `title="Next-Gen Electronics & Smart Gadgets"`, `theme="blue"`, `bannerType="without_button"` (Full banner graphic)
  - **Slide 3:** `title="Save More on Every Single Order"`, `theme="pink"`, `bannerType="with_button"` (Split content)
  - **Autoplay Interval:** 5 seconds.

### How Legacy Content Maps:
| Legacy Field | Storefront Spotlight Renderer Behavior | Visual Fidelity |
| :--- | :--- | :--- |
| `theme="lime"` | Maps to `themePreset="lime"` (`#d8f45a` background, `#0f172a` ink). | Identical brand lime appearance. |
| `theme="blue"` | Maps to `themePreset="light"` with background gradient `#dff3fc`. | Preserves soft blue tint with improved typography contrast (4.53:1). |
| `theme="pink"` | Maps to `themePreset="light"` with background gradient `#fae6ef`. | Preserves soft pink tint with improved typography contrast (4.53:1). |
| `bannerType="without_button"` | Renders as `full_banner` edge-to-edge artwork. | Controls overlay on bottom with frosted glass backdrop. |

---

## 3. Proposed Modern Hero Spotlight Configuration

Below is the verified, production-ready CMS configuration JSON for the modern spotlight hero. All text copy has passed automated scanning against the store's WP1 marketing claims policy (0 unconfirmed promises, 0 invented discounts, neutral and verifiable phrasing).

```json
{
  "intervalSeconds": 5,
  "showArrows": true,
  "showProgress": true,
  "pauseOnHover": true,
  "showTrustStrip": false,
  "slides": [
    {
      "slideType": "split_content",
      "enabled": true,
      "title": "Smart Studio and Creator Gear",
      "subtitle": "Explore camera equipment, lighting, and audio accessories.",
      "badge": "Electronics",
      "themePreset": "dark",
      "imageBackdrop": "circle",
      "button": {
        "label": "View products",
        "href": "/category/electronics"
      },
      "secondaryButton": {
        "label": "Catalogue guide",
        "href": "/help"
      }
    },
    {
      "slideType": "split_content",
      "enabled": true,
      "title": "Modern Living and Workplace Essentials",
      "subtitle": "Curated items for productivity, commute, and home.",
      "badge": "Lifestyle",
      "themePreset": "lime",
      "imageBackdrop": "lime_ring",
      "button": {
        "label": "Explore collection",
        "href": "/shop"
      }
    },
    {
      "slideType": "split_content",
      "enabled": true,
      "title": "Wireless Audio and Studio Acoustics",
      "subtitle": "Audio peripherals and monitoring headphones.",
      "badge": "Audio",
      "themePreset": "light",
      "imageBackdrop": "circle",
      "button": {
        "label": "Check products",
        "href": "/category/audio"
      }
    }
  ]
}
```

---

## 4. Visual & Ergonomic Specifications

### Desktop (1366px & 1920px)
- **Container Height:** Fixed 320px spotlight card matching the Department Bento Grid styling directly below it.
- **Card Geometry:** 24px border radius (`rounded-[24px]`), 1px subtle border, smooth cross-fade + 6px translate transition (380ms).
- **Typography:** Primary headline rendered in `Hanken Grotesk` with `Hind Siliguri` font explicitly loaded via `next/font/google` for Bengali scripts.
- **Controls:** Segmented progress bar tracks (`heroProgress` CSS fill animation matching interval), active slide counter `01 / 03`, previous/next circular buttons, and pause/play toggle.

### Mobile (390px & 320px)
- **Layout:** Copy and visual stack gracefully; buttons expand to 100% width with min-height 44px to satisfy WCAG touch target recommendations.
- **Micro Viewport (320px):** Automatic reduction of padding (14px) and headline clamp (1.35rem) guaranteeing **0px horizontal overflow**.
- **Gestures:** Horizontal touch swipe support (50px distance threshold).

### Accessibility & Reduced Motion
- **WCAG 2.1 AA/AAA Contrast:**
  - Dark preset: Inactive track 3.75:1, Focus ring 8.33:1.
  - Lime preset: Inactive track 3.59:1, Button border 14.46:1.
  - Light preset: Inactive track 4.53:1, Focus ring 3.86:1.
- **`prefers-reduced-motion`:** Autoplay timer automatically stops, progress bar displays static full width, transitions are removed.

---

## 5. Owner Step-by-Step Publishing Instructions

To publish this upgraded hero on the live store:

1. **Log in to Admin Panel:** Navigate to `https://admin.dsmart.com.bd/cms` (or local `http://localhost:3001/cms`).
2. **Open Homepage Document:** Select the **Home** document (`f46e9bc3`).
3. **Inspect Hero Section:** Click on the **Hero** section in the left navigator.
4. **Review Preflight Alerts:** The upgraded Hero Inspector in the right panel verifies:
   - Contrast check: `✓ AA Pass`
   - Policy audit: `0 violations`
   - Mobile crop and alt text indicators.
5. **Preview in Canvas:** Use the center viewport toggle to preview in **Desktop**, **Tablet (768px)**, and **Mobile (390px)**.
6. **Save Draft:** Click **Save Draft** in the top bar to save revision `6`.
7. **Publish Live:** When satisfied with the visual preview, click the green **Publish live** button.

### Rollback Procedure:
If you ever wish to revert to the previous hero configuration:
- In the CMS history, select Revision `5` (`402a5a4a`) and click **Restore / Publish** to immediately revert to the legacy 3-slide configuration.
