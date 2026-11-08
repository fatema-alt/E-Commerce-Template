"use client";

import { useEffect, useState, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  LogOut,
  Menu,
  Search,
  Shield,
  User,
  Users,
} from "lucide-react";
import { Sidebar } from "./sidebar";
import { ThemeSwitcher } from "../theme-switcher";
import { NotificationsPopover } from "../dashboard/notifications-popover";
import { CommandPalette } from "../dashboard/command-palette";
import { AuthProvider, useAdminAuth } from "@/lib/auth-context";

function getRoleBadge(role?: string) {
  switch (role) {
    case "SUPER_ADMIN":
      return {
        label: "Super Admin",
        classes:
          "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
      };
    case "ADMIN":
      return {
        label: "Admin",
        classes:
          "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
      };
    case "MANAGER":
      return {
        label: "Manager",
        classes:
          "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
      };
    case "STAFF":
      return {
        label: "Staff",
        classes:
          "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
      };
    default:
      return {
        label: role || "User",
        classes:
          "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
      };
  }
}

function AdminShellContent({ children }: { children: ReactNode }) {
  const { user, loading, logout, isAdmin } = useAdminAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  if (pathname === "/login") {
    return (
      <>
        <div className="admin-login-theme">
          <ThemeSwitcher />
        </div>
        {children}
      </>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500 dark:bg-[#0B1020] dark:text-slate-400">
        Checking admin session…
      </main>
    );
  }

  const roleInfo = getRoleBadge(user?.role);
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : user?.email?.[0]?.toUpperCase() || "A";

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

            {/* User Profile & Role Dropdown */}
            <div className="relative pl-2 border-l border-slate-200 dark:border-white/10" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setUserDropdownOpen((v) => !v)}
                className="flex items-center gap-2 rounded-xl p-1.5 transition hover:bg-slate-100 dark:hover:bg-white/5 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white shadow-xs">
                  {initials}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-800 dark:text-white leading-tight line-clamp-1">
                    {user?.name || user?.email?.split("@")[0] || "Admin"}
                  </span>
                  <span className={`inline-block text-[10px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider ${roleInfo.classes}`}>
                    {roleInfo.label}
                  </span>
                </div>
                <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
              </button>

              {/* Profile Dropdown Menu */}
              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {user?.name || "Account"}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {user?.email}
                    </p>
                    <span className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider ${roleInfo.classes}`}>
                      {roleInfo.label}
                    </span>
                  </div>

                  <div className="py-1">
                    <Link
                      href="/profile"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
                    >
                      <User size={15} className="text-slate-400" />
                      My Profile & Password
                    </Link>

                    {isAdmin && (
                      <Link
                        href="/team"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
                      >
                        <Users size={15} className="text-slate-400" />
                        Team & User Roles
                      </Link>
                    )}
                  </div>

                  <div className="border-t border-slate-100 pt-1 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        logout();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 transition"
                    >
                      <LogOut size={15} />
                      Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
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

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AdminShellContent>{children}</AdminShellContent>
    </AuthProvider>
  );
}
