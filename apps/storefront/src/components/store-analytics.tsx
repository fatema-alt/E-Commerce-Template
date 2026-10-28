"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackEvent } from "../lib/analytics";
import { trackPageView } from "../lib/gtm";
import type { ResolvedTrackingConfig } from "../lib/tracking";

/**
 * Store Analytics Component.
 *
 * Responsibilities:
 * 1. Internal Dashboard Analytics: Sends /api/analytics beacon for store dashboard.
 *    Always runs independently of third-party tracking or GTM switches.
 * 2. GTM / GA4 PageView Tracker: Dispatches dataLayer page_view events on client-side
 *    SPA route transitions when tracking is enabled. Initial page load is handled by
 *    the Google Tag on Container Loaded (send_page_view: true) to prevent duplicates.
 */
export function StoreAnalytics({
  tracking,
}: {
  tracking?: ResolvedTrackingConfig;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedPath = useRef<string | null>(null);

  // 1. Internal Dashboard Analytics (ALWAYS runs regardless of GTM tracking state)
  useEffect(() => {
    try {
      trackEvent("PAGE_VIEW");
      if (/^\/product\/[^/]+\/?$/.test(pathname)) {
        trackEvent("PRODUCT_VIEW");
      }
      if (pathname === "/checkout") {
        trackEvent("CHECKOUT");
      }
    } catch {
      // Non-blocking
    }
  }, [pathname]);

  // 2. GTM / GA4 PageView Tracking (Runs strictly when tracking is enabled)
  useEffect(() => {
    if (!tracking?.enabled) return;

    const queryString = searchParams?.toString();
    const fullPath = queryString ? `${pathname}?${queryString}` : pathname;

    // Initial mount: Handled by Google Tag (send_page_view: true) in GTM container
    // Also protects against React Strict Mode development double-mounts
    if (lastTrackedPath.current === null) {
      lastTrackedPath.current = fullPath;
      if (tracking.debugMode) {
        // eslint-disable-next-line no-console
        console.log(
          "[DS Mart GTM] Initial page view handled by Google Tag (send_page_view: true):",
          fullPath,
        );
      }
      return;
    }

    // Client-side route transition: emit custom page_view to dataLayer
    if (lastTrackedPath.current !== fullPath) {
      lastTrackedPath.current = fullPath;
      trackPageView({
        page_path: fullPath,
        page_title: typeof document !== "undefined" ? document.title : "",
        page_location: typeof window !== "undefined" ? window.location.href : "",
        debug: tracking.debugMode,
      });
    }
  }, [pathname, searchParams, tracking?.enabled, tracking?.debugMode]);

  return null;
}
