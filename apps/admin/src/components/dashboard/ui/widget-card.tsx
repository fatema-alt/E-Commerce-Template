import React, { type ReactNode } from "react";

export function WidgetCard({
  title,
  subtitle,
  action,
  children,
  className = "",
  contentClassName = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section
      className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white/80 p-5 shadow-xs backdrop-blur-md transition-all dark:border-white/10 dark:bg-[#121A30]/85 ${className}`}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {/* Content */}
      <div className={`min-w-0 flex-1 ${contentClassName}`}>{children}</div>
    </section>
  );
}
