
"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, MapPin, StickyNote, Activity } from "lucide-react";
import {
  customerApi,
  type CustomerDetail,
  type CustomerStatus,
} from "../../../lib/customer-api";

export default function CustomerDetailClient({
  id,
}: {
  id: string;
}) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<CustomerStatus>("ACTIVE");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError("");
    setCustomer(null);

    customerApi<CustomerDetail>(
      `/customers/${encodeURIComponent(id)}`,
      { signal: controller.signal }
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setCustomer(data);
          setStatus(data.status);
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : "Unable to load customer"
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [id, reload]);

  async function saveStatus() {
    if (!customer || saving || status === customer.status) return;

    setSaving(true);
    setError("");

    try {
      await customerApi(`/customers/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      setReload((value) => value + 1);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Update failed"
      );
    } finally {
      setSaving(false);
    }
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const body = note.trim();
    if (!body || saving) return;

    setSaving(true);
    setError("");

    try {
      await customerApi(`/customers/${encodeURIComponent(id)}/notes`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });

      setNote("");
      setReload((value) => value + 1);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to add note"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/customers"
        className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600"
      >
        <ArrowLeft size={17} />
        Back to customers
      </Link>

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">Loading profile…</p>
      ) : customer ? (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-indigo-600">
              CUSTOMER PROFILE
            </p>

            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              {customer.firstName} {customer.lastName || ""}
            </h1>

            <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
              <p>Email: {customer.email || "Not provided"}</p>
              <p>Phone: {customer.phone || "Not provided"}</p>
              <p>
                Created: {new Date(customer.createdAt).toLocaleString()}
              </p>
              <p>Current status: {customer.status}</p>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <select
                aria-label="Customer status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as CustomerStatus)
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="ACTIVE">Active</option>
                <option value="BLOCKED">Blocked</option>
                <option value="ARCHIVED">Archived</option>
              </select>

              <button
                type="button"
                disabled={saving || status === customer.status}
                onClick={saveStatus}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save status"}
              </button>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <MapPin size={19} className="text-indigo-600" />
                Addresses
              </h2>

              <div className="mt-4 space-y-3">
                {customer.addresses.length ? (
                  customer.addresses.map((address) => (
                    <div
                      key={address.id}
                      className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600"
                    >
                      <p className="font-semibold text-slate-900">
                        {address.label ||
                          address.fullName ||
                          "Saved address"}
                      </p>

                      <p>
                        {[
                          address.line1,
                          address.line2,
                          address.city,
                          address.state,
                          address.postalCode,
                          address.countryCode,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>

                      {address.phone && <p>{address.phone}</p>}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    No saved addresses.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <StickyNote size={19} className="text-indigo-600" />
                Internal notes
              </h2>

              <form onSubmit={addNote} className="mt-4 space-y-3">
                <textarea
                  aria-label="New internal note"
                  required
                  maxLength={2000}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-indigo-400"
                  placeholder="Add a private customer note…"
                />

                <button
                  type="submit"
                  disabled={saving || !note.trim()}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Add note"}
                </button>
              </form>

              <div className="mt-5 space-y-3">
                {customer.notes.length ? (
                  customer.notes.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl bg-slate-50 p-3 text-sm"
                    >
                      <p className="whitespace-pre-wrap break-words text-slate-700">
                        {item.body}
                      </p>

                      <p className="mt-2 text-xs text-slate-400">
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    No notes yet.
                  </p>
                )}
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Activity size={19} className="text-indigo-600" />
              Activity timeline
            </h2>

            <div className="mt-4 space-y-3">
              {customer.events.length ? (
                customer.events.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-3 text-sm"
                  >
                    <span className="font-medium text-slate-700">
                      {item.action.replaceAll("_", " ")}
                    </span>

                    <time className="text-slate-400">
                      {new Date(item.createdAt).toLocaleString()}
                    </time>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  No activity yet.
                </p>
              )}
            </div>
          </section>
        </>
      ) : (
        <p className="text-slate-500">Customer not found.</p>
      )}
    </div>
  );
}
