'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Search, Users, ChevronLeft, ChevronRight, RefreshCw, Plus } from 'lucide-react';
import { customerApi, type CustomerPage, type CustomerStatus } from '../../lib/customer-api';

const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';
export default function CustomersPage() {
  const [search,setSearch] = useState('');
  const [term,setTerm] = useState('');
  const [status,setStatus] = useState('');
  const [page,setPage] = useState(1);
  const [data,setData] = useState<CustomerPage|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [showCreate,setShowCreate] = useState(false);
  const [name,setName] = useState('');
  const [email,setEmail] = useState('');
  const [phone,setPhone] = useState('');
  const [saving,setSaving] = useState(false);
  const [reload,setReload] = useState(0);
  const load = useCallback(async (signal:AbortSignal) => {
    setLoading(true);setError('');
    try {
      const q = new URLSearchParams({page:String(page),limit:'20'});
      if(term) q.set('search',term);
      if(status) q.set('status',status);
      const result = await customerApi<CustomerPage>(`/customers?${q}` , {signal});
      if(!signal.aborted) setData(result);
    } catch(e) {if(!signal.aborted) setError(e instanceof Error?e.message:'Unable to load customers');}
    finally {if(!signal.aborted) setLoading(false);}
  },[page,term,status]);
  useEffect(()=>{const c=new AbortController();void load(c.signal);return ()=>c.abort();},[load,reload]);
  useEffect(()=>{const timer=setTimeout(()=>{setPage(1);setTerm(search.trim());},350);return ()=>clearTimeout(timer);},[search]);
  async function create(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();setSaving(true);setError('');
    try {
      await customerApi('/customers',{method:'POST',body:JSON.stringify({firstName:name.trim(),...(email.trim()?{email:email.trim()}:{}),...(phone.trim()?{phone:phone.trim()}: {})})});
      setShowCreate(false);setName('');setEmail('');setPhone('');setPage(1);setReload(v=>v+1);
    } catch(e){setError(e instanceof Error?e.message:'Unable to create customer');}
    finally{setSaving(false);}
  }
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold text-indigo-600">CUSTOMER MANAGEMENT</p><h1 className="mt-2 text-3xl font-bold text-slate-900">Customers</h1><p className="mt-2 text-sm text-slate-500">Manage customer profiles. Guest purchases will appear when Orders is integrated.</p></div><button onClick={()=>setShowCreate(v=>!v)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"><Plus size={17}/>Add customer</button></div>
    <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-sm text-slate-500"><Users size={17}/>Matching customer profiles</div><div className="mt-2 text-3xl font-bold text-slate-900">{data?.total ?? '—'}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">Guest purchasers</div><div className="mt-2 text-2xl font-semibold text-slate-500">Not connected</div><p className="mt-1 text-xs text-slate-400">Available after Orders module integration</p></div></div>
    {showCreate && <form onSubmit={create} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-3"><label className="text-sm">Name *<input required value={name} onChange={e=>setName(e.target.value)} maxLength={100} className={`mt-1 ${input}`}/></label><label className="text-sm">Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} className={`mt-1 ${input}`}/></label><label className="text-sm">Phone<input value={phone} onChange={e=>setPhone(e.target.value)} className={`mt-1 ${input}`}/></label><div className="sm:col-span-3"><button disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving?'Saving…':'Create profile'}</button><span className="ml-3 text-xs text-slate-500">Creates an admin-managed profile, not a login account.</span></div></form>}
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap gap-3 border-b border-slate-200 p-5"><div className="relative min-w-52 flex-1"><Search size={17} className="absolute left-3 top-3 text-slate-400"/><input aria-label="Search customers" placeholder="Search name, email, phone" className={`${input} pl-10`} value={search} onChange={e=>setSearch(e.target.value)}/></div><select aria-label="Filter status" className="rounded-xl border border-slate-200 bg-white px-3 text-sm" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="">All statuses</option>{(['ACTIVE','BLOCKED','ARCHIVED'] as CustomerStatus[]).map(s=><option key={s}>{s}</option>)}</select><button aria-label="Refresh" title="Refresh" onClick={()=>setReload(v=>v+1)} className="rounded-xl border border-slate-200 p-2.5"><RefreshCw size={18}/></button></div>
    {error && <div role="alert" className="m-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{['Customer','Email','Phone','Status','Created',''].map(h=><th key={h} className="px-5 py-3 font-semibold">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{loading?<tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">Loading customers…</td></tr>:data?.items.length?data.items.map(c=><tr key={c.id} className="hover:bg-slate-50"><td className="px-5 py-4 font-medium text-slate-900">{c.firstName} {c.lastName||''}</td><td className="px-5 py-4 text-slate-600">{c.email||'—'}</td><td className="px-5 py-4 text-slate-600">{c.phone||'—'}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${c.status==='ACTIVE'?'bg-green-50 text-green-700':c.status==='BLOCKED'?'bg-red-50 text-red-700':'bg-slate-100 text-slate-600'}`}>{c.status}</span></td><td className="px-5 py-4 text-slate-500">{new Date(c.createdAt).toLocaleDateString()}</td><td className="px-5 py-4"><Link className="font-semibold text-indigo-600 hover:underline" href={`/customers/${encodeURIComponent(c.id)}`}>View</Link></td></tr>):<tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">No customer profiles found.</td></tr>}</tbody></table></div>
    <div className="flex items-center justify-between border-t border-slate-200 p-4 text-sm text-slate-500"><span>Page {data?.page??page} of {Math.max(1,data?.totalPages??1)}</span><div className="flex gap-2"><button aria-label="Previous page" disabled={loading||page<=1} onClick={()=>setPage(v=>v-1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><ChevronLeft size={17}/></button><button aria-label="Next page" disabled={loading||page>=(data?.totalPages??1)} onClick={()=>setPage(v=>v+1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><ChevronRight size={17}/></button></div></div></div>
  </div>;
}
