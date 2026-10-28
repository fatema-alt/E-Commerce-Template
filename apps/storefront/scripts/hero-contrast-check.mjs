// Serialized into the browser by verify-homepage-claims-browser.mjs.
// WCAG 2.2 SC 1.4.3: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
export function checkHeroContrast() {
  const rgb = value => {
    const values = value.match(/[\d.]+/g)?.map(Number);
    if (!values || values.length < 3) throw new Error(`Unsupported colour: ${value}`);
    return [...values.slice(0, 3), values[3] ?? 1];
  };
  const blend = (foreground, background) => foreground.slice(0, 3).map((value, index) => value * foreground[3] + background[index] * (1 - foreground[3]));
  const luminance = colour => colour.map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const results = [];
  const copies = [...document.querySelectorAll('.ds-hero-copy')];
  if (!copies.length) throw new Error('Missing split hero copy');
  for (const copy of copies) {
    const base = rgb(getComputedStyle(copy).backgroundColor);
    if (base[3] !== 1) throw new Error('Dark hero copy must have an opaque surface independent of the configured gradient');
    for (const element of copy.querySelectorAll('h2,p,a,.hero-campaign-badge')) {
      const style = getComputedStyle(element);
      const background = blend(rgb(style.backgroundColor), base);
      const foreground = blend(rgb(style.color), background);
      const opacity = Number(style.opacity);
      const paintedBackground = blend([...background, opacity], base);
      const paintedForeground = blend([...foreground, opacity], base);
      const values = [luminance(paintedForeground), luminance(paintedBackground)].sort((a, b) => b - a);
      const ratio = (values[0] + 0.05) / (values[1] + 0.05);
      const fontSize = parseFloat(style.fontSize);
      const large = fontSize >= 24 || (fontSize >= 18.6667 && Number(style.fontWeight) >= 700);
      const required = large ? 3 : 4.5;
      if (ratio < required) throw new Error(`${element.tagName} ${element.textContent}: ${ratio}:1 is below ${required}:1`);
      results.push({ tag: element.tagName, text: element.textContent.trim(), ratio, required });
    }
  }
  return results;
}
