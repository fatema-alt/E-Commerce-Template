function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.origin;
  } catch { return null; }
}

/** Compare origins, not raw URL strings. Explicit public configuration wins. */
export function isStorefrontRequest(request: Pick<Request, 'headers' | 'url'>, configuredOrigin?: string, allowMissingOrigin = false): boolean {
  if (request.headers.get('x-storefront-request') !== '1' || request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  if (!origin) return allowMissingOrigin;
  let expected: string | null;
  if (configuredOrigin?.trim()) {
    expected = normalizeOrigin(configuredOrigin);
  } else {
    // A reverse proxy may preserve the public Host while Next's URL is internal.
    // Proxies which rewrite Host must configure STOREFRONT_ORIGIN explicitly.
    const url = new URL(request.url);
    const host = request.headers.get('host') || url.host;
    const forwardedProtocol = request.headers.get('x-forwarded-proto');
    const protocol = forwardedProtocol === 'https' || forwardedProtocol === 'http' ? forwardedProtocol + ':' : url.protocol;
    const candidate = normalizeOrigin(`${protocol}//${host}`);
    expected = candidate && new URL(candidate).host === host.toLowerCase() ? candidate : null;
  }
  const actual = normalizeOrigin(origin);
  return !!expected && !!actual && actual === expected;
}
