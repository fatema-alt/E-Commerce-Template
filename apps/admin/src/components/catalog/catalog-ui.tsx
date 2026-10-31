"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

export const API =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
export const control =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
export const button =
  "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50";
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(API + path, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      Array.isArray(data.message)
        ? data.message.join(", ")
        : data.message || "Request failed (" + response.status + ")",
    );
  return data;
}
export const json = (method: string, body: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export function useCatalogRole() {
  const [role, setRole] = useState("");
  useEffect(() => {
    let live = true;
    void api<{ user: { role: string } }>("/auth/me")
      .then((result) => {
        if (live) setRole(result.user.role);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return {
    role,
    canEdit: role === "ADMIN" || role === "SUPER_ADMIN",
    canDelete: role === "ADMIN" || role === "SUPER_ADMIN",
  };
}

export function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto max-h-[90vh] w-[min(95vw,48rem)] overflow-auto rounded-2xl border-0 p-6 text-slate-900 shadow-2xl backdrop:bg-slate-950/50"
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold">{title}</h2>
        <button
          type="button"
          disabled={busy}
          aria-label="Close dialog"
          className={button}
          onClick={onClose}
        >
          Close
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function useConfirm() {
  const [message, setMessage] = useState("");
  const pending = useRef<((value: boolean) => void) | null>(null);
  const confirm = useCallback(
    (text: string) =>
      new Promise<boolean>((resolve) => {
        pending.current?.(false);
        pending.current = resolve;
        setMessage(text);
      }),
    [],
  );
  const finish = (value: boolean) => {
    pending.current?.(value);
    pending.current = null;
    setMessage("");
  };
  useEffect(
    () => () => {
      pending.current?.(false);
    },
    [],
  );
  return {
    confirm,
    confirmation: message ? (
      <Modal title="Confirm action" onClose={() => finish(false)}>
        <p className="mb-6 text-slate-600">{message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white"
            onClick={() => finish(true)}
          >
            Confirm
          </button>
          <button
            type="button"
            className={button}
            onClick={() => finish(false)}
          >
            Cancel
          </button>
        </div>
      </Modal>
    ) : null,
  };
}

export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const navigation = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest("a[href]");
      if (
        anchor &&
        anchor.getAttribute("href")?.startsWith("/") &&
        !window.confirm("Discard unsaved changes?")
      )
        event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", navigation, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", navigation, true);
    };
  }, [dirty]);
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  onSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm text-slate-600">
      <span>
        {total ? (page - 1) * pageSize + 1 : 0}–
        {Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex items-center gap-2">
        <select
          aria-label="Rows per page"
          className={control}
          value={pageSize}
          onChange={(e) => onSize(Number(e.target.value))}
        >
          {[10, 25, 50, 100].map((size) => (
            <option key={size}>{size}</option>
          ))}
        </select>
        <button
          className={button}
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </button>
        <span className="whitespace-nowrap">
          {page} / {Math.max(1, Math.ceil(total / pageSize))}
        </span>
        <button
          className={button}
          disabled={page * pageSize >= total}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
