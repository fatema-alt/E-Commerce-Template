/**
 * Google Tag Manager & DataLayer Helper for DS Mart.
 *
 * Rules:
 * - Must NEVER break shopping or user experience (safe wrappers).
 * - Pushes conform to GA4 ecommerce standard.
 * - Generates unique event_id shared between browser Pixel and server CAPI for deduplication.
 * - Respects debug mode for console verification.
 */

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

/**
 * Generate a unique event_id for Meta Pixel & CAPI deduplication.
 * Format: evt_<timestamp>_<random>
 */
export function generateEventId(): string {
  // Use cryptographically secure random UUID without hyphens
  const rand = crypto.randomUUID().replace(/-/g, '');
  return `evt_${Date.now()}_${rand}`;
}

/**
 * Safe dataLayer push.
 * Always safe to call in any context (browser or SSR, initialized or not).
 */
export function pushToDataLayer(
  eventData: Record<string, unknown>,
  options?: { debug?: boolean },
): void {
  if (typeof window === 'undefined') return;

  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(eventData);

    if (options?.debug) {
      // eslint-disable-next-line no-console
      console.log('[DS Mart GTM dataLayer]', eventData);
    }
  } catch (err) {
    // Non-blocking: tracking failure must never interrupt store operations.
    if (options?.debug) {
      // eslint-disable-next-line no-console
      console.warn('[DS Mart GTM dataLayer Error]', err);
    }
  }
}

/**
 * Standard GA4 / GTM PageView event.
 * Replaces or standardizes history changes in Next.js App Router.
 */
export function trackPageView(params: {
  page_path: string;
  page_title?: string;
  page_location?: string;
  event_id?: string;
  debug?: boolean;
}): string {
  const event_id = params.event_id || generateEventId();
  const page_location =
    params.page_location ||
    (typeof window !== 'undefined' ? window.location.href : '');
  const page_title =
    params.page_title ||
    (typeof document !== 'undefined' ? document.title : '');

  // 1. Clear previous ecommerce state if any (GA4 recommended practice)
  pushToDataLayer({ ecommerce: null }, { debug: params.debug });

  // 2. Push standard page_view event with Meta & GA4 parameters
  pushToDataLayer(
    {
      event: 'page_view',
      page_path: params.page_path,
      page_title,
      page_location,
      event_id,
      event_time: Math.round(Date.now() / 1000),
      first_party_collection: true,
    },
    { debug: params.debug },
  );

  return event_id;
}
