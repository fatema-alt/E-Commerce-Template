"use client";
import { useEffect, useSyncExternalStore } from "react";
const key = "commerce-storefront-theme";
const event = "commerce-theme-change";
type Preference = "light" | "dark" | "system";
let fallback: Preference | null = null;
function read(): Preference {
  if (fallback) return fallback;
  try {
    const value = localStorage.getItem(key);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
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
const isDark = () => document.documentElement.dataset.theme === "dark";
export function ThemeSwitcher() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  useEffect(() => {
    apply();
    const media = matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  return (
    <button
      type="button"
      className="theme-switcher"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      onClick={() => {
        fallback = isDark() ? "light" : "dark";
        try {
          localStorage.setItem(key, fallback);
          fallback = null;
        } catch {}
        apply();
        window.dispatchEvent(new Event(event));
      }}
    >
      <span className="ts-knob" aria-hidden="true" />
      <span className="ts-icon sun" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      </span>
      <span className="ts-icon moon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      </span>
    </button>
  );
}