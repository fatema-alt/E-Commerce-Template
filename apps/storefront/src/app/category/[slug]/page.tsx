import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ProductCard} from '../../../components/home-sections';
import {getCategory,getProductPage} from '../../../lib/storefront';
export default async function CategoryPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{page?:string}>}){
 const {slug}=await params;const q=await searchParams;
 const category=await getCategory(slug);if(!category)notFound();
 const page=Math.max(1,Math.min(100000,Number(q.page)||1));
 const products=await getProductPage({categoryId:category.id,page,pageSize:24});
 return <main id="main" className="container main-content"><p><Link href="/">Home</Link> / <Link href="/categories">Categories</Link></p><h1>{category.name}</h1><p>{products.total} products</p>{products.items.length?<div className="products-grid">{products.items.map(p=><ProductCard key={p.id} product={p}/>)}</div>:<div className="empty-content">No available products in this category.</div>}<nav aria-label="Pagination" style={{display:'flex',gap:20,marginTop:24}}>{page>1&&<Link href={`?page=${page-1}`}>Previous</Link>}{page*24<products.total&&<Link href={`?page=${page+1}`}>Next</Link>}</nav></main>
}
