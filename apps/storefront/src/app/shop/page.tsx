import Link from "next/link";
import { Suspense } from "react";
import { getCategories, getProductPage } from "../../lib/storefront";
import { ProductCard } from "../../components/home-sections";
export const metadata = { title: "Shop all products" };
type Props = {
  searchParams: Promise<{
    q?: string;
    page?: string;
    category?: string;
    sort?: string;
    min?: string;
    max?: string;
  }>;
};
async function Content({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(
    1,
    Math.min(100000, Math.floor(Number(params.page) || 1)),
  );
  const q = (params.q || "").slice(0, 200);
  const sort = ["latest", "price-asc", "price-desc", "name"].includes(
    params.sort || "",
  )
    ? params.sort!
    : "latest";
  const category = /^[a-f0-9-]{36}$/i.test(params.category || "")
    ? params.category
    : undefined;
  const min = /^\d{1,10}(\.\d{1,2})?$/.test(params.min || "")
    ? params.min
    : undefined;
  const max = /^\d{1,10}(\.\d{1,2})?$/.test(params.max || "")
    ? params.max
    : undefined;
  const [categories, results] = await Promise.all([
    getCategories(),
    getProductPage({
      page,
      pageSize: 24,
      search: q,
      categoryId: category,
      sort,
      min,
      max,
    }),
  ]);
  const url = (next: number) =>
    "/shop?" +
    new URLSearchParams({
      ...(q ? { q } : {}),
      ...(category ? { category } : {}),
      ...(min ? { min } : {}),
      ...(max ? { max } : {}),
      sort,
      page: String(next),
    });
  return (
    <main id="main" className="container main-content">
      <p className="eyebrow">Find your next favorite</p>
      <h1>Shop all products</h1>
      <form className="catalog-filters" action="/shop">
        <label>
          Search
          <input
            name="q"
            defaultValue={q}
            placeholder="Product name or SKU"
            maxLength={200}
          />
        </label>
        <label>
          Category
          <select name="category" defaultValue={category || ""}>
            <option value="">All departments</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort
          <select name="sort" defaultValue={sort}>
            <option value="latest">Newest</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="name">Name: A–Z</option>
          </select>
        </label>
        <label>
          Min price
          <input
            name="min"
            type="number"
            min="0"
            step="0.01"
            defaultValue={min}
          />
        </label>
        <label>
          Max price
          <input
            name="max"
            type="number"
            min="0"
            step="0.01"
            defaultValue={max}
          />
        </label>
        <button className="primary-button">Apply filters</button>
        <Link href="/shop">Reset</Link>
      </form>
      <p className="muted">{results.total} products</p>
      {results.items.length ? (
        <div className="products-grid">
          {results.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="empty-content">
          <h2>No products found</h2>
          <p>Try a broader search or remove a filter.</p>
          <Link href="/shop">Clear filters</Link>
        </div>
      )}
      <nav aria-label="Product pagination" className="action-row">
        {page > 1 && (
          <Link className="secondary-button" href={url(page - 1)}>
            Previous
          </Link>
        )}
        <span>Page {page}</span>
        {page * 24 < results.total && (
          <Link className="secondary-button" href={url(page + 1)}>
            Next
          </Link>
        )}
      </nav>
    </main>
  );
}
export default function Page(props: Props) {
  return (
    <Suspense
      fallback={
        <main id="main" className="container main-content">
          Loading products…
        </main>
      }
    >
      <Content {...props} />
    </Suspense>
  );
}
