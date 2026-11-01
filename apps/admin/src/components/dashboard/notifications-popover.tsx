"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  ShoppingCart,
  AlertTriangle,
  CreditCard,
  Star,
} from "lucide-react";

export interface NotificationItem {
  id: string;
  type: "order" | "low_stock" | "payment_failed" | "review";
  title: string;
  message: string;
  time: string;
  read?: boolean;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

const STORAGE_KEY = "cs_read_notifications";

export function NotificationsPopover({
  initialNotifications,
}: {
  initialNotifications?: NotificationItem[];
}) {
  const [open, setOpen] = useState(false);
  const [fetchedNotifications, setFetchedNotifications] = useState<NotificationItem[]>([]);
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
    : Array.isArray((rawNotifications as unknown as { items?: NotificationItem[] })?.items)
      ? (rawNotifications as unknown as { items: NotificationItem[] }).items
      : [];

  // Fetch notifications on mount only if not provided via props
  useEffect(() => {
    if (initialNotifications && initialNotifications.length > 0) return;

    let live = true;
    fetch(`${API}/dashboard?range=today`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!live || !data?.notifications) return;
        const list = Array.isArray(data.notifications)
          ? data.notifications
          : Array.isArray(data.notifications?.items)
            ? data.notifications.items
            : [];
        setFetchedNotifications(list);
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, [initialNotifications]);

  // Click outside and Escape key handler
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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

  const unreadCount = notifications.filter((n) => !readIds.includes(n.id)).length;

  function markAllAsRead() {
    const allIds = notifications.map((n) => n.id);
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

  function getTargetUrl(item: NotificationItem): string {
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
        return <ShoppingCart size={16} className="text-amber-500" />;
      case "low_stock":
        return <AlertTriangle size={16} className="text-amber-500" />;
      case "payment_failed":
        return <CreditCard size={16} className="text-rose-500" />;
      case "review":
        return <Star size={16} className="text-indigo-400" />;
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
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-[#121A30]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="region"
          aria-label="Notification center"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-2xl z-50 dark:border-white/10 dark:bg-[#121A30] animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/10">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-900 dark:text-white">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                <CheckCheck size={14} />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5 [scrollbar-width:thin]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                <Bell size={24} className="mx-auto mb-2 opacity-40" />
                <p>All caught up!</p>
                <p className="text-xs text-slate-400 mt-0.5">No active alerts or tasks.</p>
              </div>
            ) : (
              notifications.map((item) => {
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
                    className={`flex items-start gap-3 p-3.5 transition-colors hover:bg-slate-50 dark:hover:bg-white/5 ${
                      !isRead ? "bg-indigo-50/40 dark:bg-indigo-950/20" : ""
                    }`}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/10">
                      {getIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p
                          className={`text-xs font-semibold truncate ${
                            !isRead
                              ? "text-slate-900 dark:text-white"
                              : "text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {item.title}
                        </p>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {item.time}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                        {item.message}
                      </p>
                    </div>
                    {!isRead && (
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                    )}
                  </Link>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 px-4 py-2.5 bg-slate-50/50 text-center text-[11px] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
            Updates in real-time via SSE
          </div>
        </div>
      )}
    </div>
  );
}
