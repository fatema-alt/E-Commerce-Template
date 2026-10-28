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

        // Prevent duplicate trigger on the exact same full path
        if (lastTrackedPath.current !== fullPath) {
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
