"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "../lib/analytics";

export function StoreAnalytics() {
  const pathname = usePathname();
  useEffect(() => {
    const timer = setTimeout(() => {
      trackEvent("PAGE_VIEW");
      if (/^\/product\/[^/]+\/?$/.test(pathname)) trackEvent("PRODUCT_VIEW");
      if (pathname === "/checkout") trackEvent("CHECKOUT");
    }, 0);
    return () => clearTimeout(timer);
  }, [pathname]);
  return null;
}
