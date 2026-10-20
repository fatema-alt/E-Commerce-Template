export function ProductSkeleton() {
  return (
    <main
      id="main"
      className="container main-content pdp-page"
      aria-busy="true"
    >
      <p role="status" className="sr-only">
        Loading product details…
      </p>
      <div className="pdp-skeleton-line pdp-skeleton-breadcrumb" />
      <div className="product-detail-grid">
        <div className="pdp-skeleton-image" />
        <div className="pdp-skeleton-info">
          <div className="pdp-skeleton-line" />
          <div className="pdp-skeleton-line" />
          <div className="pdp-skeleton-line" />
          <div className="pdp-skeleton-image" />
        </div>
      </div>
    </main>
  );
}
