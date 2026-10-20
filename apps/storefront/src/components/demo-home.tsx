import Link from "next/link";
import { BrandArtwork } from "./brand-artwork";
import { ProductCard } from "./home-sections";
import type { Product } from "../lib/storefront";

// Readymade home content. CMS e real content dile ei component ta ar lagbe na.
const categories = [
  { name: "Electronics", note: "Phones, audio and everyday tech", q: "electronics" },
  { name: "Fashion", note: "Easy pieces for every day", q: "fashion" },
  { name: "Home essentials", note: "Make your space work harder", q: "home" },
  { name: "Gifts", note: "Something for someone you like", q: "gift" },
];
const trust = [
  { icon: "✓", title: "Clear totals", text: "See delivery charges and your final total before you order." },
  { icon: "↦", title: "Order updates", text: "Follow your order from your account or the browser you checked out with." },
  { icon: "?", title: "Help when you need it", text: "Ask our team about a product, a return or an existing order." },
];
const faq = [
  { q: "How do I pay?", a: "Enter your delivery address at checkout to see the available payment methods and your final total." },
  { q: "How do I track my order?", a: "Signed-in customers can see orders in their account. For a guest order, use the browser you placed it from." },
  { q: "Who do I contact about a return?", a: "Use the contact page and include your order number if you have one." },
];

export function DemoHome({ products = [] }: { products?: Product[] }) {
  return (
    <main id="main" className="container main-content">
      <section className="hero" aria-labelledby="demo-hero">
        <div className="hero-content">
          <p className="eyebrow">Welcome to DS Mart</p>
          <h1 id="demo-hero">Shop smart. Live smart.</h1>
          <p>Everyday essentials and fresh finds, all in one place.</p>
          <div className="action-row">
            <Link className="primary-button" href="/shop">
              Shop all products<span className="btn-arrow" aria-hidden="true">↗</span>
            </Link>
            <Link className="secondary-button" href="/categories">Browse categories</Link>
          </div>
        </div>
        <BrandArtwork />
      </section>

      <section className="section" aria-labelledby="demo-cats">
        <div className="section-head">
          <h2 id="demo-cats">Shop by category</h2>
          <Link href="/categories">See all</Link>
        </div>
        <div className="demo-cats">
          {categories.map((c) => (
            <Link key={c.name} href={`/shop?q=${encodeURIComponent(c.q)}`} className="demo-cat">
              <strong>{c.name}</strong>
              <span>{c.note}</span>
              <span className="btn-arrow" aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      </section>

      {products.length > 0 && (
        <section className="section" aria-labelledby="demo-products">
          <div className="section-head">
            <h2 id="demo-products">Featured products</h2>
            <Link href="/shop">Shop all</Link>
          </div>
          <div className="products-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      <section className="section" aria-label="Why shop with DS Mart">
        <div className="cms-tiles">
          {trust.map((t) => (
            <article key={t.title} className="cms-tile">
              <span className="trust-icon" aria-hidden="true">{t.icon}</span>
              <h3>{t.title}</h3>
              <p className="muted">{t.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="demo-promo">
        <div className="cms-promo demo-promo">
          <div>
            <h2 id="demo-promo">New here? Start with the whole range.</h2>
            <p>Search by name or filter by price and category to find what you need.</p>
          </div>
          <Link className="primary-button" href="/shop">
            Start shopping<span className="btn-arrow" aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>

      <section className="section" aria-labelledby="demo-faq">
        <h2 id="demo-faq">Good to know</h2>
        <div className="cms-faq">
          {faq.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p className="muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}