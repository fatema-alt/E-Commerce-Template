"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "./authenticated-fetch";
import { useToastState } from "@/components/admin/toast-provider";

export type DashboardData = {
  updatedAt: string;
  currency: string;
  timezone: string;
  month: string;
  totals: {
    sales: string;
    orders: number;
    customers: number;
    inventory: number;
  };
  revenue: { day: string; revenue: string; orders: number }[];
  target: { amount: string | null; achieved: string };
  categories: { name: string; amount: string }[];
  customers: {
    active: number;
    new: number;
    returning: number;
    repeatRate: number;
  };
  funnel: {
    productViews: number;
    addedToCart: number;
    checkout: number;
    purchases: number;
  };
  sources: { source: string; count: number }[];
};
const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [role, setRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [, setError] = useToastState("error");
  const [, setSuccess] = useToastState("success");
  const failed = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    try {
      const response = await authenticatedFetch(`${api}/dashboard`, {
        cache: "no-store",
        signal: request.signal,
      });
      if (!response.ok)
        throw new Error("Could not refresh dashboard data. Please try again.");
      const result: DashboardData = await response.json();
      if (request.signal.aborted) return;
      setData(result);
      setUnavailable(false);
      failed.current = false;
    } catch (error) {
      if (request.signal.aborted) return;
      setUnavailable(true);
      if (!failed.current)
        setError(
          error instanceof Error ? error.message : "Dashboard unavailable",
        );
      failed.current = true;
    }
  }, [setError]);
  useEffect(() => {
    const initial = setTimeout(() => void load(), 0);
    const auth = new AbortController();
    void authenticatedFetch(`${api}/auth/me`, { signal: auth.signal })
      .then(async (response) => {
        if (response.ok) {
          const result = await response.json();
          if (!auth.signal.aborted) setRole(result.user.role);
        }
      })
      .catch(() => {});
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      auth.abort();
      controller.current?.abort();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  async function saveTarget(amount: string) {
    if (saving) return false;
    setSaving(true);
    try {
      const response = await authenticatedFetch(`${api}/dashboard/target`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          Array.isArray(body.message)
            ? body.message.join(", ")
            : body.message || "Could not save target",
        );
      }
      const target = await response.json();
      setData((current) =>
        current
          ? { ...current, target: { ...current.target, amount: target.amount } }
          : current,
      );
      setSuccess("Monthly sales target saved");
      return true;
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not save target",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }
  return {
    data,
    unavailable,
    refresh: load,
    canEditTarget: role === "ADMIN" || role === "SUPER_ADMIN",
    saveTarget,
    saving,
  };
}
