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
    return 'system';
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
    if (received.type === 'storage') fallback = null;
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
  const preference = useSyncExternalStore(subscribe, read, () => "system");
  useEffect(() => {
    apply();
    const media = matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  return (
    <label className="theme-switcher">
      <span aria-hidden="true">◐</span>
      <span className="theme-switcher-label">Theme</span>
      <select
        aria-label="Color theme"
        value={preference}
        onChange={(event) => {
          fallback = event.target.value as Preference;
          try {
            localStorage.setItem(key, fallback);
            fallback = null;
          } catch {}
          apply();
          window.dispatchEvent(new Event("commerce-theme-change"));
        }}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
