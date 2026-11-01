import React from "react";

export function WidgetSkeleton({
  height = "h-72",
  className = "",
}: {
  height?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-xs backdrop-blur-md animate-pulse dark:border-white/10 dark:bg-[#121A30]/70 ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="h-4 w-32 rounded bg-slate-200 dark:bg-white/10" />
        <div className="h-6 w-16 rounded bg-slate-200 dark:bg-white/10" />
      </div>
      <div className={`mt-4 w-full rounded-xl bg-slate-100 dark:bg-white/5 ${height}`} />
    </div>
  );
}
