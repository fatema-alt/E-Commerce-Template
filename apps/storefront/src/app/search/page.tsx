import Link from 'next/link';
import {ProductCard} from '../../components/home-sections';
import {getProductPage} from '../../lib/storefront';
export default async function SearchPage({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}){
 const p=await searchParams;const q=(p.q??'').trim().slice(0,200);const page=Math.max(1,Math.min(100000,Number(p.page)||1));
 const results=q?await getProductPage({search:q,page,pageSize:24}):{items:[],total:0};
 return <main id="main" className="container main-content"><h1>Search results</h1><p>{q?`${results.total} results for “${q}”`:'Enter a search term to find products.'}</p>{results.items.length?<div className="products-grid">{results.items.map(x=><ProductCard key={x.id} product={x}/>)}</div>:<div className="empty-content">No products found.</div>}<nav aria-label="Pagination" style={{display:'flex',gap:20,marginTop:24}}>{page>1&&<Link href={`?q=${encodeURIComponent(q)}&page=${page-1}`}>Previous</Link>}{page*24<results.total&&<Link href={`?q=${encodeURIComponent(q)}&page=${page+1}`}>Next</Link>}</nav></main>
}
