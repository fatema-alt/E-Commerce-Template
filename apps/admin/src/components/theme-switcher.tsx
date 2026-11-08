"use client";
import { useEffect, useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";

const key = "commerce-admin-theme";
const event = "commerce-theme-change";
type Preference = "light" | "dark" | "system";
let fallback: Preference | null = null;

function read(): Preference {
  if (fallback) return fallback;
  try {
    const value = localStorage.getItem(key);
    return value === "light" || value === "dark" ? value : "dark";
  } catch {
    return "dark";
  }
}

function apply() {
  const preference = read();
  document.documentElement.dataset.theme =
    preference === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : preference;
}

function subscribe(callback: () => void) {
  const update = (received: Event) => {
    if (received.type === "storage") fallback = null;
    apply();
    callback();
  };
  window.addEventListener("storage", update);
  window.addEventListener(event, update);
  return () => {
    window.removeEventListener("storage", update);
    window.removeEventListener(event, update);
  };
}

export function ThemeSwitcher() {
  const preference = useSyncExternalStore(subscribe, read, () => "dark");

  useEffect(() => {
    apply();
    const media = matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const isDark =
    preference === "dark" ||
    (preference === "system" &&
      typeof window !== "undefined" &&
      matchMedia("(prefers-color-scheme: dark)").matches);

  function toggle() {
    const next: Preference = isDark ? "light" : "dark";
    fallback = next;
    try {
      localStorage.setItem(key, next);
      fallback = null;
    } catch {}
    apply();
    window.dispatchEvent(new Event("commerce-theme-change"));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label="Toggle color theme"
      className="flex h-9 w-9 items-center justify-center rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7900]"
    >
      {isDark ? (
        <Sun size={18} className="text-amber-400" />
      ) : (
        <Moon size={18} className="text-slate-700" />
      )}
    </button>
  );
}
