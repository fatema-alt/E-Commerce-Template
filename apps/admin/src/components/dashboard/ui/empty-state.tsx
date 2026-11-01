import React from "react";
import Link from "next/link";
import { type LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaHref,
  onCta,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCta?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 mb-3 shadow-xs">
        <Icon size={24} />
      </div>
      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
        {title}
      </h4>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-xs">
        {description}
      </p>

      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {ctaLabel}
        </Link>
      )}

      {ctaLabel && !ctaHref && onCta && (
        <button
          type="button"
          onClick={onCta}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
