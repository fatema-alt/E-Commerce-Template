'use client';
import { useToastState } from "@/components/admin/toast-provider";
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useToastState("error"); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const res = await authenticatedFetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      if (!res.ok) throw new Error(res.status === 401 ? 'Invalid email or password' : 'Login failed');
      router.replace('/'); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Login failed'); } finally { setBusy(false); }
  }
  return <main className="min-h-screen grid place-items-center bg-slate-100 p-6"><form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-2xl bg-white p-8 shadow"><h1 className="text-2xl font-bold">Commerce Suite Admin</h1><p className="text-sm text-slate-500">Sign in to manage your store</p><label className="block text-sm">Email<input required type="email" autoComplete="username" className="mt-2 w-full rounded-lg border p-3" value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="block text-sm">Password<input required type="password" autoComplete="current-password" className="mt-2 w-full rounded-lg border p-3" value={password} onChange={e=>setPassword(e.target.value)}/></label>{error && <p role="alert" className="text-red-700">{error}</p>}<button disabled={busy} className="w-full rounded-lg bg-indigo-600 p-3 font-semibold text-white disabled:opacity-50">{busy?'Signing in...':'Sign in'}</button></form></main>;
}
