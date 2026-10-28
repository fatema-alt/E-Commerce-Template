import type { ResolvedTrackingConfig } from '../lib/tracking';

/**
 * GTM Head Script Component.
 *
 * Implements:
 * 1. Consent Mode v2 default settings (strictly 'granted' or 'denied').
 * 2. GTM container initialization.
 * 3. Configuration data (server_container_url, debug_mode) pushed to dataLayer.
 *
 * If tracking is disabled or GTM ID is missing/invalid, this component returns null
 * (zero script tags or network activity).
 */
export function GtmHeadScript({ config }: { config: ResolvedTrackingConfig }) {
  if (!config.enabled || !config.gtmId) {
    return null;
  }

  // Pre-sanitized and allowlist-verified in resolveTrackingConfig
  const gtmId = config.gtmId;
  const consent = config.consentDefault === 'granted' ? 'granted' : 'denied';
  const serverUrl = config.serverUrl;
  const debugMode = config.debugMode ? 'true' : 'false';

  // Inline script: Consent Mode v2 Default + GTM Loader
  const inlineScript = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  'ad_storage': '${consent}',
  'analytics_storage': '${consent}',
  'ad_user_data': '${consent}',
  'ad_personalization': '${consent}'
});
dataLayer.push({
  'gtm.start': new Date().getTime(),
  event: 'gtm.js',
  server_container_url: ${serverUrl ? JSON.stringify(serverUrl) : "''"},
  debug_mode: ${debugMode}
});
(function(w,d,s,l,i){w[l]=w[l]||[];var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');
`.trim();

  return (
    <script
      id="gtm-init"
      dangerouslySetInnerHTML={{ __html: inlineScript }}
    />
  );
}

/**
 * GTM Body NoScript Component for users with JavaScript disabled.
 */
export function GtmNoScript({ config }: { config: ResolvedTrackingConfig }) {
  if (!config.enabled || !config.gtmId) {
    return null;
  }

  const gtmId = config.gtmId;

  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}
