"use client";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Bell, UserCircle } from "lucide-react";
import { Sidebar } from "./sidebar";
import { ThemeSwitcher } from "../theme-switcher";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
export function AdminShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    return <main className="p-8">Checking admin session…</main>;
  if (status === "error")
    return (
      <main className="p-8" role="alert">
        Unable to verify your session. Check API connectivity and reload.
      </main>
    );
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b bg-white px-5 py-4 md:px-8">
          <div className="flex items-center gap-4">
            <button
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 lg:hidden"
            >
              <Menu size={22} />
            </button>
            <div>
              <p className="text-sm font-semibold">Admin Dashboard</p>
              <p className="text-xs text-slate-500">
                Manage your commerce operations
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ThemeSwitcher />
            <Bell size={19} className="hidden sm:block" />
            <UserCircle size={29} className="hidden sm:block" />
            <button
              className="rounded border px-3 py-2 text-sm"
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
        <div className="mx-auto max-w-7xl p-5 md:p-8">{children}</div>
      </div>
    </div>
  );
}
