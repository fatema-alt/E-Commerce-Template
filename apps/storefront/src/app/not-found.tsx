import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="container main-content">
      <h1>Page not found</h1>
      <p>This page or product is no longer available.</p>
      <Link href="/shop" className="primary-button">
        Browse the store
      </Link>
    </main>
  );
}
