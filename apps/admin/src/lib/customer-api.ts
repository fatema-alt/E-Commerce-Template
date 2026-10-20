import { authenticatedFetch } from './authenticated-fetch';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
export type CustomerStatus = 'ACTIVE' | 'BLOCKED' | 'ARCHIVED';
export type Customer = { id:string; firstName:string; lastName:string|null; email:string|null; phone:string|null; status:CustomerStatus; createdAt:string; updatedAt:string };
export type Address = { id:string; label?:string|null; fullName?:string|null; phone?:string|null; line1?:string; line2?:string|null; city?:string; state?:string|null; postalCode?:string|null; countryCode?:string; createdAt:string };
export type Note = {id:string;body:string;createdAt:string};
export type Event = {id:string;action:string;createdAt:string};
export type CustomerDetail = Customer & {addresses:Address[];notes:Note[];events:Event[]};
export type CustomerPage = {items:Customer[];total:number;page:number;limit:number;totalPages:number};
export async function customerApi<T>(path:string, options?:RequestInit):Promise<T> {
  const response = await authenticatedFetch(`${BASE}${path}`, { ...options, headers: {'Content-Type':'application/json',...options?.headers} });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try { const payload = await response.json(); message = Array.isArray(payload.message) ? payload.message.join(', ') : payload.message || message; } catch {}
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}
