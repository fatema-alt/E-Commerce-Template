"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type Kind = "success" | "error";
type Toast = { id: number; message: string; kind: Kind };
const ToastContext = createContext<(message: string, kind: Kind) => void>(
  () => {},
);

function ToastItem({
  toast,
  dismiss,
}: {
  toast: Toast;
  dismiss: (id: number) => void;
}) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(
      () => dismiss(toast.id),
      toast.kind === "error" ? 12000 : 6000,
    );
    return () => clearTimeout(timer);
  }, [toast, dismiss, paused]);
  return (
    <div
      role={toast.kind === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-xl ${toast.kind === "error" ? "border-red-300 bg-red-50 text-red-900" : "border-emerald-300 bg-emerald-50 text-emerald-900"}`}
    >
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm">
        {toast.message}
      </span>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => dismiss(toast.id)}
        className="rounded px-2 font-bold focus-visible:outline-2"
      >
        ×
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const notify = useCallback((message: string, kind: Kind) => {
    if (!message) return;
    const toast = { id: ++nextId.current, message, kind };
    setToasts((current) => [...current.slice(-3), toast]);
  }, []);
  const dismiss = useCallback(
    (id: number) =>
      setToasts((current) => current.filter((toast) => toast.id !== id)),
    [],
  );
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div
        aria-label="Notifications"
        className="pointer-events-none fixed right-4 top-4 z-[10000] flex max-h-[90vh] w-[calc(100%-2rem)] max-w-sm flex-col gap-3 overflow-y-auto"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} dismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Preserve inline field feedback while also announcing each action result. */
export function useToastState(kind: Kind) {
  const [value, setValue] = useState("");
  const notify = useContext(ToastContext);
  const update = useCallback(
    (message: string) => {
      setValue(message);
      if (message) notify(message, kind);
    },
    [notify, kind],
  );
  return [value, update] as const;
}
