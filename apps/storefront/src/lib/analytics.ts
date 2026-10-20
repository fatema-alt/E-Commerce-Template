export function trafficSource(
  referrer: string,
  origin: string,
  search: string,
) {
  const params = new URLSearchParams(search);
  const medium = (params.get("utm_medium") ?? "").toLowerCase();
  const source = (params.get("utm_source") ?? "").toLowerCase();
  if (/email|newsletter/.test(medium + " " + source)) return "email";
  if (
    /social|facebook|instagram|tiktok|youtube|twitter|linkedin/.test(
      medium + " " + source,
    )
  )
    return "social";
  if (medium === "organic") return "organic";
  try {
    const url = new URL(referrer);
    if (url.origin === origin) return "direct";
    if (
      /(^|\.)(google\.[a-z.]+|bing.com|duckduckgo.com|search.yahoo.com)$/.test(
        url.hostname,
      )
    )
      return "organic";
    if (
      /(^|\.)(facebook.com|instagram.com|tiktok.com|youtube.com|t.co|twitter.com|x.com|linkedin.com|pinterest.com)$/.test(
        url.hostname,
      )
    )
      return "social";
    return "referral";
  } catch {
    return params.has("utm_source") ? "referral" : "direct";
  }
}

let queue = Promise.resolve();
export function trackEvent(
  kind: "PAGE_VIEW" | "PRODUCT_VIEW" | "ADD_TO_CART" | "CHECKOUT",
) {
  if (typeof window === "undefined" || navigator.doNotTrack === "1") return;
  try {
    // Serialize the first events so the HttpOnly session cookie is established once.
    const body = JSON.stringify({
      id: crypto.randomUUID(),
      kind,
      source: trafficSource(
        document.referrer,
        location.origin,
        location.search,
      ),
    });
    queue = queue
      .then(async () => {
        await fetch("/api/analytics", {
          method: "POST",
          credentials: "same-origin",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            "X-Storefront-Request": "1",
          },
          body,
        });
      })
      .catch(() => {});
  } catch {
    /* Tracking must never interrupt shopping. */
  }
}
