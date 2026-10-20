"use client";
import Link from "next/link";
export default function ProductError() {
  return (
    <main id="main" className="container main-content">
      <section className="shop-panel store-unavailable">
        <p className="eyebrow">DS MART</p>
        <h1>We couldn’t load this product.</h1>
        <p>Please try again in a moment, or continue browsing the store.</p>
        <button
          type="button"
          className="primary-button"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
        <Link className="secondary-button" href="/shop">
          Continue shopping
        </Link>
      </section>
    </main>
  );
}
