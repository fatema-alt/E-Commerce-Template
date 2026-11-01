"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type {
  TimeRange,
  CompareMode,
  DashboardOverviewResponse,
} from "./dashboard-types";
import {
  type Locale,
  type DashboardDictionary,
  getDashboardDictionary,
} from "@/lib/i18n/dashboard";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const LOCALE_KEY = "cs_dashboard_locale";

export interface DashboardContextValue {
  range: TimeRange;
  setRange: (r: TimeRange) => void;
  customFrom: string;
  customTo: string;
  setCustomRange: (from: string, to: string) => void;
  compare: CompareMode;
  setCompare: (c: CompareMode) => void;
  locale: Locale;
  setLocale: (l: Locale) => void;
  dict: DashboardDictionary;
  data: DashboardOverviewResponse | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastUpdated: string;
  sseConnected: boolean;
  refresh: () => Promise<void>;
  updateMonthlyTarget: (target: number) => Promise<boolean>;
  targetModalOpen: boolean;
  setTargetModalOpen: (open: boolean) => void;
  customizeModalOpen: boolean;
  setCustomizeModalOpen: (open: boolean) => void;
  hiddenWidgets: string[];
  widgetOrder: string[];
  saveLayout: (order: string[], hidden: string[]) => Promise<void>;
  resetLayout: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return ctx;
}

export const DEFAULT_WIDGET_ORDER = [
  "revenue-combo",
  "monthly-target",
  "conversion-funnel",
  "top-categories",
  "top-products",
  "recent-orders",
  "customer-activity",
  "traffic-sources",
  "low-stock-alerts",
  "payment-methods",
  "geo-districts",
  "activity-feed",
];

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [range, setRangeState] = useState<TimeRange>("7d");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [compare, setCompareState] = useState<CompareMode>("prev_period");
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") return "en";
    try {
      const stored = localStorage.getItem(LOCALE_KEY);
      return stored === "bn" ? "bn" : "en";
    } catch {
      return "en";
    }
  });

  const [data, setData] = useState<DashboardOverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [sseConnected, setSseConnected] = useState<boolean>(false);

  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [customizeModalOpen, setCustomizeModalOpen] = useState(false);
  const [widgetOrder, setWidgetOrder] = useState<string[]>(DEFAULT_WIDGET_ORDER);
  const [hiddenWidgets, setHiddenWidgets] = useState<string[]>([]);

  const dict = useMemo(() => getDashboardDictionary(locale), [locale]);

  function setLocale(newLocale: Locale) {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(LOCALE_KEY, newLocale);
    } catch {
      // ignore
    }
  }

  function setRange(newRange: TimeRange) {
    setRangeState(newRange);
  }

  function setCustomRange(from: string, to: string) {
    setCustomFrom(from);
    setCustomTo(to);
    setRangeState("custom");
  }

  function setCompare(newCompare: CompareMode) {
    setCompareState(newCompare);
  }

  // Load layout on initial mount
  useEffect(() => {
    let live = true;
    fetch(`${API}/dashboard/layout`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((saved) => {
        if (!live || !saved?.layout) return;
        if (Array.isArray(saved.layout.order) && saved.layout.order.length > 0) {
          setWidgetOrder(saved.layout.order);
        }
        if (Array.isArray(saved.layout.hidden)) {
          setHiddenWidgets(saved.layout.hidden);
        }
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, []);

  // Fetch dashboard data
  const fetchData = useCallback(
    async (isBackground = false) => {
      setTimeout(() => {
        if (!isBackground) {
          if (!data) setLoading(true);
          else setRefreshing(true);
        }
        setError(null);
      }, 0);

      try {
        const params = new URLSearchParams();
        params.set("range", range);
        if (range === "custom" && customFrom && customTo) {
          params.set("from", customFrom);
          params.set("to", customTo);
        }
        if (compare === "none") {
          params.set("compare", "none");
        }

        const res = await fetch(`${API}/dashboard?${params.toString()}`, {
          credentials: "include",
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`API error: ${res.status} ${res.statusText}`);
        }

        const json: DashboardOverviewResponse = await res.json();
        setData(json);
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, "0");
        const minutes = String(now.getMinutes()).padStart(2, "0");
        setLastUpdated(`${hours}:${minutes}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard data");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [range, customFrom, customTo, compare, data],
  );

  // Trigger fetch whenever range, custom dates, or compare changes
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchData(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchData]);

  // Polling fallback every 60s
  useEffect(() => {
    const timer = setInterval(() => {
      void fetchData(true);
    }, 60000);
    return () => clearInterval(timer);
  }, [fetchData]);

  // SSE Stream connection with reactive updates
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      try {
        es = new EventSource(`${API}/dashboard/stream`, {
          withCredentials: true,
        });

        es.onopen = () => {
          setSseConnected(true);
        };

        es.onmessage = () => {
          // Event received: trigger subtle background refetch
          void fetchData(true);
        };

        es.onerror = () => {
          setSseConnected(false);
          es?.close();
          // Attempt reconnection after 10s
          reconnectTimeout = setTimeout(connect, 10000);
        };
      } catch {
        setSseConnected(false);
      }
    }

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (es) {
        es.close();
      }
    };
  }, [fetchData]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData(false);
  }, [fetchData]);

  const updateMonthlyTarget = useCallback(async (newTarget: number): Promise<boolean> => {
    try {
      const res = await authenticatedFetch(`${API}/dashboard/target`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: newTarget }),
      });
      if (res.ok) {
        void fetchData(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [fetchData]);

  const saveLayout = useCallback(async (order: string[], hidden: string[]) => {
    setWidgetOrder(order);
    setHiddenWidgets(hidden);
    try {
      await authenticatedFetch(`${API}/dashboard/layout`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout: { order, hidden } }),
      });
    } catch {
      // ignore
    }
  }, []);

  const resetLayout = useCallback(async () => {
    setWidgetOrder(DEFAULT_WIDGET_ORDER);
    setHiddenWidgets([]);
    try {
      await authenticatedFetch(`${API}/dashboard/layout`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layout: { order: DEFAULT_WIDGET_ORDER, hidden: [] },
        }),
      });
    } catch {
      // ignore
    }
  }, []);

  const value: DashboardContextValue = {
    range,
    setRange,
    customFrom,
    customTo,
    setCustomRange,
    compare,
    setCompare,
    locale,
    setLocale,
    dict,
    data,
    loading,
    refreshing,
    error,
    lastUpdated,
    sseConnected,
    refresh,
    updateMonthlyTarget,
    targetModalOpen,
    setTargetModalOpen,
    customizeModalOpen,
    setCustomizeModalOpen,
    hiddenWidgets,
    widgetOrder,
    saveLayout,
    resetLayout,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}
