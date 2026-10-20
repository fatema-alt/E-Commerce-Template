import Link from "next/link";
import { Suspense } from "react";
import { ProductCard } from "../../components/home-sections";
import { getProductPage } from "../../lib/storefront";

type Props = { searchParams: Promise<{ q?: string; page?: string }> };

async function Results({ searchParams }: Props) {
  const p = await searchParams;
  const q = (p.q ?? "").trim().slice(0, 200);
  const page = Math.max(1, Math.min(100000, Number(p.page) || 1));
  const results = q
    ? await getProductPage({ search: q, page, pageSize: 24 })
    : { items: [], total: 0 };
  const href = (n: number) => `?q=${encodeURIComponent(q)}&page=${n}`;
  return (
    <main id="main" className="container main-content">
      <h1>Search results</h1>
      <p className="muted">
        {q
          ? `${results.total} results for “${q}”`
          : "Enter a search term to find products."}
      </p>
      {results.items.length ? (
        <div className="products-grid">
          {results.items.map((x) => (
            <ProductCard key={x.id} product={x} />
          ))}
        </div>
      ) : (
        <div className="empty-content">No products found.</div>
      )}
      <nav aria-label="Pagination" className="action-row">
        {page > 1 && (
          <Link className="secondary-button" href={href(page - 1)}>
            Previous
          </Link>
        )}
        {page * 24 < results.total && (
          <Link className="secondary-button" href={href(page + 1)}>
            Next
          </Link>
        )}
      </nav>
    </main>
  );
}

export default function SearchPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main id="main" className="container main-content">
          Searching…
        </main>
      }
    >
      <Results {...props} />
    </Suspense>
  );
}