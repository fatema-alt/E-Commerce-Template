"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="container main-content">
      <h1>Store temporarily unavailable</h1>
      <p>Please try again shortly.</p>
      <button className="primary-button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
