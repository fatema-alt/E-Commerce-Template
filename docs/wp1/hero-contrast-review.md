# Dark hero contrast: separate follow-up commit

The only production change is one scoped CSS rule:

```css
:root[data-theme=dark] .ds-hero-copy{background:var(--glass-solid)}
```

It gives split-layout HTML copy an opaque dark surface independent of the configured image-side gradient. Light mode, full-banner images, carousel layout and navbar selectors are unchanged. Work was done in the isolated WP1 worktree; the shared main checkout's navbar file was not edited.

The browser regression failed against the old CSS because the copy had no opaque surface. After the fix, computed foreground/background colours were measured using relative luminance and alpha/opacity compositing, without rounding before pass/fail. This follows [WCAG 2.2 SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): normal text needs 4.5:1 and large text 3:1.

Command (PowerShell):

```powershell
$env:CHECK_HERO_CONTRAST='1'
node apps/storefront/scripts/verify-homepage-claims-browser.mjs
```

Final output:

```text
PASS AA template 1366px: normal minimum 6.78:1, large minimum 14.25:1 (including CTA hover)
PASS AA template 390px: normal minimum 6.78:1, large minimum 14.25:1 (including CTA hover)
PASS AA fallback 1366px: normal minimum 9.72:1, large minimum 14.25:1 (including CTA hover)
PASS AA fallback 390px: normal minimum 9.72:1, large minimum 14.25:1 (including CTA hover)
```

Tests cover heading, description, primary/secondary CTAs and amber/emerald/purple badge text on the standard slide themes. Default/fallback copy checks and horizontal-overflow assertions also passed, with no browser runtime exceptions. Desktop and 390px screenshots were visually inspected. Storefront production build and its TypeScript checks passed after the CSS change; claims/shipping regression scripts also passed.

This verifies the checked HTML hero states, not text embedded in uploaded banner images or site-wide WCAG compliance.
