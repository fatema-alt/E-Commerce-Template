"use client";

import { useEffect, useState } from "react";

/** No overlapping requests; pause background/offline tabs and cancel stale reads. */
export function useLiveRefresh(
  load: (signal: AbortSignal) => Promise<void>,
  enabled = true,
  interval = 15000,
) {
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let busy = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    const tick = async () => {
      clearTimeout(timer);
      if (!active || busy) return;
      if (document.hidden || !navigator.onLine) {
        timer = setTimeout(tick, interval);
        return;
      }
      busy = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 20000);
      setRefreshing(true);
      try {
        await load(controller.signal);
        if (active) {
          setLastChecked(Date.now());
          setError("");
        }
      } catch (e) {
        if (active)
          setError(
            (e as Error).name === "AbortError"
              ? "Tracking refresh timed out. Retrying automatically."
              : (e as Error).message,
          );
      } finally {
        clearTimeout(timeout);
        busy = false;
        if (active) {
          setRefreshing(false);
          timer = setTimeout(tick, interval);
        }
      }
    };
    const resume = () => {
      void tick();
    };
    timer = setTimeout(tick, 0);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    window.addEventListener("focus", resume);
    return () => {
      active = false;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("focus", resume);
    };
  }, [load, enabled, interval, revision]);
  return {
    lastChecked,
    refreshing,
    error,
    refresh: () => setRevision((value) => value + 1),
  };
}
