/**
 * Validation patterns and config resolution for DS Mart analytics and tracking.
 *
 * Security rules:
 * - Strict allowlists on all IDs and URLs.
 * - Server URL must be HTTPS with valid hostname (no paths, query strings, or fragments).
 * - Zero secrets allowed here (no tokens, no API keys).
 * - Fallback: Published Admin Settings > Environment Variables > Disabled.
 */

export const GTM_ID_REGEX = /^GTM-[A-Z0-9]{4,10}$/;
export const SERVER_URL_REGEX = /^https:\/\/[a-zA-Z0-9.-]+(?::[0-9]+)?$/;
export const GA4_ID_REGEX = /^G-[A-Z0-9]{6,12}$/;
export const PIXEL_ID_REGEX = /^[0-9]{8,20}$/;

export interface TrackingSettings {
  enabled?: boolean;
  gtmId?: string;
  serverUrl?: string;
  ga4MeasurementId?: string;
  metaPixelId?: string;
  consentDefault?: 'granted' | 'denied';
  debugMode?: boolean;
}

export interface ResolvedTrackingConfig {
  enabled: boolean;
  gtmId: string | null;
  serverUrl: string | null;
  ga4MeasurementId: string | null;
  metaPixelId: string | null;
  consentDefault: 'granted' | 'denied';
  debugMode: boolean;
  source: 'admin' | 'env' | 'disabled';
}

export function isValidGtmId(id: unknown): id is string {
  return typeof id === 'string' && GTM_ID_REGEX.test(id.trim());
}

export function isValidServerUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!SERVER_URL_REGEX.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' && parsed.pathname === '/' && !parsed.search && !parsed.hash;
  } catch {
    return false;
  }
}

export function isValidGa4Id(id: unknown): id is string {
  return typeof id === 'string' && GA4_ID_REGEX.test(id.trim());
}

export function isValidPixelId(id: unknown): id is string {
  return typeof id === 'string' && PIXEL_ID_REGEX.test(id.trim());
}

/**
 * Resolves tracking configuration following strict hierarchy:
 * 1. Published Admin Site Settings (if enabled and GTM ID is valid)
 * 2. Environment Variables (if NEXT_PUBLIC_GTM_ID is valid)
 * 3. Disabled cleanly (zero scripts or network requests)
 */
export function resolveTrackingConfig(settings?: TrackingSettings | null): ResolvedTrackingConfig {
  const envGtmId = process.env.NEXT_PUBLIC_GTM_ID?.trim();
  const envServerUrl = process.env.NEXT_PUBLIC_GTM_SERVER_URL?.trim();
  const envConsent = process.env.NEXT_PUBLIC_CONSENT_DEFAULT?.trim() === 'granted' ? 'granted' : 'denied';

  // 1. Check Admin Settings if explicitly configured
  if (settings && typeof settings === 'object') {
    // If master switch is explicitly false, tracking is disabled immediately
    if (settings.enabled === false) {
      return {
        enabled: false,
        gtmId: null,
        serverUrl: null,
        ga4MeasurementId: null,
        metaPixelId: null,
        consentDefault: settings.consentDefault === 'granted' ? 'granted' : 'denied',
        debugMode: Boolean(settings.debugMode),
        source: 'disabled',
      };
    }

    const gtmId = isValidGtmId(settings.gtmId) ? settings.gtmId.trim() : null;
    const serverUrl = isValidServerUrl(settings.serverUrl) ? settings.serverUrl.trim() : null;
    const ga4MeasurementId = isValidGa4Id(settings.ga4MeasurementId) ? settings.ga4MeasurementId.trim() : null;
    const metaPixelId = isValidPixelId(settings.metaPixelId) ? settings.metaPixelId.trim() : null;
    const consentDefault = settings.consentDefault === 'granted' ? 'granted' : 'denied';
    const debugMode = Boolean(settings.debugMode);

    if (gtmId) {
      return {
        enabled: true,
        gtmId,
        serverUrl,
        ga4MeasurementId,
        metaPixelId,
        consentDefault,
        debugMode,
        source: 'admin',
      };
    }
  }

  // 2. Fallback to Environment Variables
  if (isValidGtmId(envGtmId)) {
    const serverUrl = isValidServerUrl(envServerUrl) ? envServerUrl : null;
    return {
      enabled: true,
      gtmId: envGtmId,
      serverUrl,
      ga4MeasurementId: null,
      metaPixelId: null,
      consentDefault: envConsent,
      debugMode: process.env.NODE_ENV !== 'production',
      source: 'env',
    };
  }

  // 3. Fallback: Tracking disabled silently
  return {
    enabled: false,
    gtmId: null,
    serverUrl: null,
    ga4MeasurementId: null,
    metaPixelId: null,
    consentDefault: 'denied',
    debugMode: false,
    source: 'disabled',
  };
}
