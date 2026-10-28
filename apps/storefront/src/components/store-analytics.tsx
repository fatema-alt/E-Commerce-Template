"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "../lib/analytics";
import { trackPageView } from "../lib/gtm";
import type { ResolvedTrackingConfig } from "../lib/tracking";

export function StoreAnalytics({
  tracking,
}: {
  tracking?: ResolvedTrackingConfig;
}) {
  const pathname = usePathname();
  const isFirstNavigation = useRef(true);
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      // 1. Existing internal dashboard tracking
      trackEvent("PAGE_VIEW");
      if (/^\/product\/[^/]+\/?$/.test(pathname)) trackEvent("PRODUCT_VIEW");
      if (pathname === "/checkout") trackEvent("CHECKOUT");

      // 2. GTM / GA4 standard PageView tracking (if tracking enabled)
      if (tracking?.enabled) {
        const fullLocation =
          typeof window !== "undefined" ? window.location.href : "";
        const search =
          typeof window !== "undefined" ? window.location.search : "";
        const fullPath = pathname + search;

        if (isFirstNavigation.current) {
          // Initial page load: GTM Google Tag fires automatically via send_page_view: true.
          // We mark the initial path to prevent double firing on first load.
          isFirstNavigation.current = false;
          lastTrackedPath.current = fullPath;
          if (tracking.debugMode) {
            // eslint-disable-next-line no-console
            console.log(
              "[DS Mart GTM] Initial page view handled by Google Tag (send_page_view: true):",
              fullPath,
            );
          }
        } else if (lastTrackedPath.current !== fullPath) {
          // Client-side SPA route transition: Push virtual page_view event to dataLayer
          lastTrackedPath.current = fullPath;
          trackPageView({
            page_path: fullPath,
            page_title: typeof document !== "undefined" ? document.title : "",
            page_location: fullLocation,
            debug: tracking.debugMode,
          });
        }
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [pathname, tracking?.enabled, tracking?.debugMode]);

  return null;
}
