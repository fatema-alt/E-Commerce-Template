/* eslint-disable @next/next/no-img-element -- Uses the supplied DS Mart symbol. */
export function BrandArtwork() {
  return (
    <div className="hero-decoration" aria-hidden="true">
      <span className="hero-brand-label">THE SMART CHOICE</span>
      <span className="ds-symbol"><img src="/brand/ds-symbol.png" alt="" width={1254} height={1254} /></span>
      <span className="hero-brand-caption">A little more. Every day.</span>
    </div>
  );
}
