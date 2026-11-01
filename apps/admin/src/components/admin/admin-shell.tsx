"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search, UserCircle } from "lucide-react";
import { Sidebar } from "./sidebar";
import { ThemeSwitcher } from "../theme-switcher";
import { NotificationsPopover } from "../dashboard/notifications-popover";
import { CommandPalette } from "../dashboard/command-palette";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export function AdminShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [status, setStatus] = useState<"checking" | "ok" | "error">("checking");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/login") return;
    let live = true;
    fetch(`${API}/auth/me`, { credentials: "include", cache: "no-store" })
      .then((r) => {
        if (!live) return;
        if (r.status === 401) {
          router.replace("/login");
          return;
        }
        setStatus(r.ok ? "ok" : "error");
      })
      .catch(() => {
        if (live) setStatus("error");
      });
    return () => {
      live = false;
    };
  }, [pathname, router]);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (pathname === "/login")
    return (
      <>
        <div className="admin-login-theme">
          <ThemeSwitcher />
        </div>
        {children}
      </>
    );

  if (status === "checking")
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500 dark:bg-[#0B1020] dark:text-slate-400">
        Checking admin session…
      </main>
    );

  if (status === "error")
    return (
      <main
        className="flex min-h-screen items-center justify-center p-8 bg-slate-50 text-slate-900 dark:bg-[#0B1020] dark:text-slate-100"
        role="alert"
      >
        <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-sm dark:border-rose-900/40 dark:bg-[#121A30]">
          <h2 className="text-base font-bold text-rose-600 dark:text-rose-400">
            Session Verification Failed
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Unable to verify your admin session. Check API connectivity and reload.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Reload Page
          </button>
        </div>
      </main>
    );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased transition-colors dark:bg-[#0B1020] dark:text-slate-100">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      <div className="min-h-screen md:pl-20 lg:pl-64 transition-all duration-300">
        {/* Sticky Header */}
        <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur-md dark:border-white/10 dark:bg-[#121A30]/85 md:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation drawer"
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white md:hidden"
            >
              <Menu size={22} />
            </button>

            {/* Quick Search Trigger */}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:border-white/20 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Search size={14} />
              <span className="hidden sm:inline">Search (Ctrl+K)</span>
              <span className="sm:hidden">Search</span>
              <kbd className="hidden sm:inline-block rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeSwitcher />
            <NotificationsPopover />

            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-white/10">
              <UserCircle size={26} className="text-slate-400 dark:text-slate-400" />
            </div>

            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              onClick={async () => {
                await authenticatedFetch(`${API}/auth/logout`, {
                  method: "POST",
                  credentials: "include",
                });
                router.replace("/login");
                router.refresh();
              }}
            >
              Logout
            </button>
          </div>
        </header>

        {/* Content Container */}
        <main className="mx-auto max-w-7xl p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
