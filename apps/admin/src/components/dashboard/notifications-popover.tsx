"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  ShoppingCart,
  AlertTriangle,
  CreditCard,
  Star,
  RefreshCw,
  Check,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

export interface NotificationItem {
  id: string;
  type: "order" | "low_stock" | "payment_failed" | "review";
  title: string;
  message: string;
  time: string;
  createdAt?: string;
  read?: boolean;
  link?: string;
  targetUrl?: string;
  orderId?: string;
  orderNumber?: string;
}

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
).replace(/\/$/, "");
const ROOT = API_BASE.endsWith("/api/v1") ? API_BASE : `${API_BASE}/api/v1`;

const STORAGE_KEY = "cs_read_notifications";

export function NotificationsPopover({
  initialNotifications,
}: {
  initialNotifications?: NotificationItem[];
}) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(false);
  const [fetchedNotifications, setFetchedNotifications] = useState<
    NotificationItem[]
  >([]);
  const [readIds, setReadIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const rawNotifications =
    initialNotifications && initialNotifications.length > 0
      ? initialNotifications
      : fetchedNotifications;

  const notifications: NotificationItem[] = Array.isArray(rawNotifications)
    ? rawNotifications
    : Array.isArray(
          (rawNotifications as unknown as { items?: NotificationItem[] })?.items
        )
      ? (rawNotifications as unknown as { items: NotificationItem[] }).items
      : [];

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      // Try dedicated notifications endpoint first, fall back to overview
      const res = await authenticatedFetch(`${ROOT}/dashboard/notifications`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.items)
          ? data.items
          : Array.isArray(data)
            ? data
            : [];
        setFetchedNotifications(list);
        return;
      }

      // Fallback to dashboard overview
      const fallbackRes = await authenticatedFetch(
        `${ROOT}/dashboard?range=today`
      );
      if (fallbackRes.ok) {
        const data = await fallbackRes.json();
        const list = Array.isArray(data?.notifications)
          ? data.notifications
          : Array.isArray(data?.notifications?.items)
            ? data.notifications.items
            : [];
        setFetchedNotifications(list);
      }
    } catch {
      // ignore network errors
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount & poll every 30 seconds
  useEffect(() => {
    if (initialNotifications && initialNotifications.length > 0) return;
    void loadNotifications();

    const interval = setInterval(() => {
      void loadNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [initialNotifications, loadNotifications]);

  // Click outside and Escape key handler
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const unreadCount = notifications.filter(
    (n) => !readIds.includes(n.id)
  ).length;

  const displayedNotifications =
    activeTab === "unread"
      ? notifications.filter((n) => !readIds.includes(n.id))
      : notifications;

  function markAllAsRead() {
    const allIds = Array.from(
      new Set([...readIds, ...notifications.map((n) => n.id)])
    );
    setReadIds(allIds);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allIds));
    } catch {
      // ignore
    }
  }

  function markOneRead(id: string) {
    if (readIds.includes(id)) return;
    const next = [...readIds, id];
    setReadIds(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  function toggleOneRead(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    let next: string[];
    if (readIds.includes(id)) {
      next = readIds.filter((item) => item !== id);
    } else {
      next = [...readIds, id];
    }
    setReadIds(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  function getTargetUrl(item: NotificationItem): string {
    if (item.targetUrl) return item.targetUrl;
    if (item.link) return item.link;

    switch (item.type) {
      case "order":
        return "/orders?status=PENDING";
      case "low_stock":
        return "/inventory";
      case "payment_failed":
        return "/orders";
      case "review":
        return "/reviews";
      default:
        return "/";
    }
  }

  function getIcon(type: NotificationItem["type"]) {
    switch (type) {
      case "order":
        return <ShoppingCart size={16} className="text-indigo-600 dark:text-indigo-400" />;
      case "low_stock":
        return <AlertTriangle size={16} className="text-amber-500" />;
      case "payment_failed":
        return <CreditCard size={16} className="text-rose-500" />;
      case "review":
        return <Star size={16} className="text-amber-400 fill-amber-400" />;
      default:
        return <Bell size={16} className="text-slate-400" />;
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={open}
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open) void loadNotifications();
        }}
        className="relative rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7900] dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
      >
        <Bell size={19} />
        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#FF7900] ring-2 ring-white dark:ring-[#080B0F]" />
      </button>

      {open && (
        <div
          role="region"
          aria-label="Notification center"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-2xl z-50 dark:border-white/10 dark:bg-[#121A30] animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
        >
          {/* Header */}
          <div className="border-b border-slate-200 px-4 py-3 dark:border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadNotifications()}
                  disabled={loading}
                  title="Refresh notifications"
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-slate-200 transition"
                >
                  <RefreshCw
                    size={14}
                    className={loading ? "animate-spin text-indigo-600" : ""}
                  />
                </button>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-white/5 transition"
                  >
                    <CheckCheck size={14} />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="mt-2.5 flex items-center gap-1.5 border-t border-slate-100 dark:border-white/5 pt-2.5">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  activeTab === "all"
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold"
                    : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5"
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("unread")}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  activeTab === "unread"
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold"
                    : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/5"
                }`}
              >
                <span>Unread</span>
                {unreadCount > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-88 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5 [scrollbar-width:thin]">
            {displayedNotifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                <CheckCircle2
                  size={26}
                  className="mx-auto mb-2 text-emerald-500 opacity-60"
                />
                <p className="font-semibold text-slate-700 dark:text-slate-200">
                  {activeTab === "unread"
                    ? "No unread notifications!"
                    : "No notifications right now."}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  You are all caught up on orders, stock & reviews.
                </p>
              </div>
            ) : (
              displayedNotifications.map((item) => {
                const isRead = readIds.includes(item.id);
                const targetUrl = getTargetUrl(item);

                return (
                  <Link
                    key={item.id}
                    href={targetUrl}
                    onClick={() => {
                      markOneRead(item.id);
                      setOpen(false);
                    }}
                    className={`group relative flex items-start gap-3 p-3.5 transition-all ${
                      !isRead
                        ? "border-l-4 border-l-indigo-600 bg-indigo-50/75 dark:border-l-indigo-400 dark:bg-indigo-950/40 hover:bg-indigo-100/70 dark:hover:bg-indigo-900/50"
                        : "border-l-4 border-l-transparent hover:bg-slate-50 dark:hover:bg-white/5"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${
                        !isRead
                          ? "bg-white shadow-xs dark:bg-white/10"
                          : "bg-slate-100 dark:bg-white/5"
                      }`}
                    >
                      {getIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0 pr-6">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {!isRead && (
                          <span className="rounded-md bg-indigo-600/10 px-1.5 py-0.2 text-[9px] font-extrabold tracking-wide text-indigo-700 dark:bg-indigo-400/20 dark:text-indigo-300 uppercase">
                            NEW
                          </span>
                        )}
                        <p
                          className={`text-xs truncate ${
                            !isRead
                              ? "font-bold text-slate-900 dark:text-white"
                              : "font-medium text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {item.title}
                        </p>
                      </div>
                      <p
                        className={`text-xs mt-0.5 line-clamp-2 leading-relaxed ${
                          !isRead
                            ? "text-slate-700 dark:text-slate-200"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {item.message}
                      </p>
                      <span className="inline-block text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-medium">
                        {item.time}
                      </span>
                    </div>

                    {/* Unread indicator / Quick Toggle Button */}
                    <div className="absolute right-3 top-3.5 flex items-center">
                      {!isRead ? (
                        <button
                          type="button"
                          onClick={(e) => toggleOneRead(item.id, e)}
                          title="Mark as read"
                          className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-indigo-200/50 dark:hover:bg-white/10 transition"
                        >
                          <span className="h-2.5 w-2.5 rounded-full bg-indigo-600 dark:bg-indigo-400 ring-4 ring-indigo-500/20 animate-pulse" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => toggleOneRead(item.id, e)}
                          title="Mark as unread"
                          className="opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/10 transition"
                        >
                          <Circle size={10} />
                        </button>
                      )}
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 px-4 py-2.5 bg-slate-50/60 flex items-center justify-between text-[11px] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
            <span>Updates automatically</span>
            <button
              type="button"
              onClick={() => {
                setActiveTab("unread");
                setOpen(true);
              }}
              className="text-indigo-600 hover:underline dark:text-indigo-400 font-semibold"
            >
              {unreadCount} unread left
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
