"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { BellRing, X, ExternalLink } from "lucide-react";

export function NotificationHighlightBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const highlight = searchParams.get("highlight");
  const notiTitle = searchParams.get("notiTitle");
  const notiMsg = searchParams.get("notiMsg");

  const [dismissed, setDismissed] = useState(false);

  // Reset dismissal when highlight or notiTitle changes
  useEffect(() => {
    setDismissed(false);
  }, [highlight, notiTitle]);

  const showBanner = !dismissed && (Boolean(notiTitle) || Boolean(highlight));

  // Automatically scroll to and highlight matching element
  useEffect(() => {
    if (!highlight || dismissed) return;

    const timer = setTimeout(() => {
      // Find element matching highlight (order number, sku, id, etc.)
      const selector = `[data-highlight*="${highlight}" i], [data-order-number*="${highlight}" i], tr[data-highlight*="${highlight}" i]`;
      const target = document.querySelector(selector);

      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.classList.add(
          "ring-2",
          "ring-indigo-500",
          "bg-indigo-50/80",
          "dark:bg-indigo-950/50",
          "transition-all",
          "duration-500"
        );
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [highlight, dismissed]);

  if (!showBanner) return null;

  const handleDismiss = () => {
    setDismissed(true);
    startTransition(() => {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete("highlight");
      nextParams.delete("notiTitle");
      nextParams.delete("notiMsg");
      nextParams.delete("notiId");
      const newQuery = nextParams.toString();
      router.replace(`${pathname}${newQuery ? `?${newQuery}` : ""}`, {
        scroll: false,
      });
    });
  };

  return (
    <div className="relative mb-5 flex items-start justify-between gap-3 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50/95 via-sky-50/70 to-white p-4 shadow-sm dark:border-indigo-800/60 dark:from-indigo-950/70 dark:via-[#121A30] dark:to-[#121A30] animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-start gap-3 min-w-0">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm ring-4 ring-indigo-500/10">
          <BellRing size={18} className="animate-pulse" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 text-[10px] font-bold tracking-wider text-indigo-700 dark:text-indigo-300 uppercase">
              Viewing from notification
            </span>
            {highlight && (
              <span className="rounded-md bg-white dark:bg-white/10 px-2 py-0.5 text-xs font-mono font-bold text-indigo-800 dark:text-indigo-200 border border-indigo-200/60 dark:border-white/10">
                {highlight}
              </span>
            )}
          </div>
          {notiTitle && (
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
              {notiTitle}
            </h3>
          )}
          {notiMsg && (
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
              {notiMsg}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white transition shrink-0"
        aria-label="Dismiss notification alert"
        title="Dismiss alert"
      >
        <X size={16} />
      </button>
    </div>
  );
}
