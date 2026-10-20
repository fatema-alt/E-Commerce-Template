import Link from "next/link";
export default function ProductNotFound() {
  return (
    <main id="main" className="container main-content">
      <section className="shop-panel store-unavailable">
        <p className="eyebrow">DS MART</p>
        <h1>This product is no longer available.</h1>
        <p>Explore the rest of the collection to find your next favourite.</p>
        <Link className="primary-button" href="/shop">
          Explore products
        </Link>
      </section>
    </main>
  );
}
