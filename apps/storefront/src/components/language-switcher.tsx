"use client";

import { useLanguage } from "../lib/i18n";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();

  return (
    <div
      className="language-switcher"
      role="group"
      aria-label="Language selection"
    >
      <button
        type="button"
        className={`lang-btn ${locale === "bn" ? "active" : ""}`}
        onClick={() => setLocale("bn")}
        aria-pressed={locale === "bn"}
        title="বাংলায় দেখুন"
      >
        বাং
      </button>
      <button
        type="button"
        className={`lang-btn ${locale === "en" ? "active" : ""}`}
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        title="View in English"
      >
        EN
      </button>
    </div>
  );
}
