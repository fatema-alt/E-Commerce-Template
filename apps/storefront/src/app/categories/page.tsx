import Link from 'next/link';
import {getCategories} from '../../lib/storefront';
export default async function CategoriesPage(){
 const categories=await getCategories();
 return <main id="main" className="container main-content"><h1>All categories</h1>{categories.length?<div className="categories-grid">{categories.map(c=><Link className="category-card" href={`/category/${encodeURIComponent(c.slug)}`} key={c.id}>{c.imageUrl?<img className="product-image" alt="" src={c.imageUrl} loading="lazy"/>:<div className="image-placeholder">✳</div>}<span>{c.name}</span></Link>)}</div>:<div className="empty-content">No categories are available yet.</div>}</main>
}
