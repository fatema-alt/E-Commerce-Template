import Image from "next/image";
import Link from "next/link";
import type { Category } from "../lib/storefront";

// Shared by the existing CMS and first-run homepage category sections.
export function DepartmentGrid({ categories, title = "Shop by Department", hasMore = categories.length > 6 }: {
  categories: Category[];
  title?: string;
  hasMore?: boolean;
}) {
  return (
    <div className="department-section">
      <div className="department-heading">
        <div>
          <h2>{title}</h2>
          <p>Explore your favorite categories</p>
        </div>
        {hasMore && <Link className="department-view-all" href="/categories">View All Categories <span aria-hidden="true">↗</span></Link>}
      </div>
      {categories.length ? (
        <div className="department-grid">
          {categories.slice(0, 6).map((category, index) => (
            <Link key={category.id} href={`/category/${encodeURIComponent(category.slug)}`}
              className={`department-card department-tone-${index % 6}${category.imageUrl ? "" : " department-card-text-only"}`}>
              <h3>{category.name}</h3>
              <span className="department-card-arrow" aria-hidden="true">↗</span>
              {category.imageUrl && <div className="department-card-image">
                <Image src={category.imageUrl} alt={`${category.name} collection`} fill
                  sizes="(max-width: 700px) 50vw, (max-width: 1000px) 50vw, 420px"
                  className="department-image" loading="lazy"
                  unoptimized={category.imageUrl.startsWith("http:") || category.imageUrl.startsWith("data:")} />
              </div>}
              {!category.imageUrl && <span className="department-browse">Explore category <span aria-hidden="true">→</span></span>}
            </Link>
          ))}
        </div>
      ) : <p className="empty-content">No categories are available yet.</p>}
    </div>
  );
}
