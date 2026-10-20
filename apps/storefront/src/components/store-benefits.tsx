import Link from "next/link";
export function StoreBenefits() {
  return <div className="container store-benefits" aria-label="Explore your store">
    <Link href="/categories"><span className="benefit-symbol" aria-hidden="true">↗</span><span><strong>More to discover</strong><small>Find your everyday favourites</small></span></Link>
    <Link href="/wishlist"><span className="benefit-symbol" aria-hidden="true">♡</span><span><strong>Save what you love</strong><small>Keep your favourites in one place</small></span></Link>
    <Link href="/orders"><span className="benefit-symbol" aria-hidden="true">↦</span><span><strong>Your orders, in view</strong><small>Follow your shopping journey</small></span></Link>
  </div>;
}
