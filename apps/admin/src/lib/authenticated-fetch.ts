/** Sends the HttpOnly admin session cookie on all admin API requests. */
export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes((init.method ?? 'GET').toUpperCase())) headers.set('X-Commerce-Admin', '1');
  return fetch(input, { ...init, headers, credentials: 'include' });
}
