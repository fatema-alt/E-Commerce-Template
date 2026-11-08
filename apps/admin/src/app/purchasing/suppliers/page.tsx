"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Edit2,
  FilePlus,
  Loader2,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

const API = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
).replace(/\/$/, "");
const ROOT = API.endsWith("/api/v1") ? API : `${API}/api/v1`;

type Supplier = {
  id: string;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  taxId?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: { purchaseOrders: number };
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [taxId, setTaxId] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const q = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
      const res = await authenticatedFetch(`${ROOT}/purchasing/suppliers${q}`);
      if (res.ok) {
        const d = await res.json();
        setSuppliers(d.items || []);
      }
    } catch (err) {
      console.error("Failed to load suppliers", err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  const openAddModal = () => {
    setEditingSupplier(null);
    setName("");
    setContactName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setCity("");
    setTaxId("");
    setPaymentTerms("Net 30");
    setNotes("");
    setIsActive(true);
    setFormError("");
    setModalOpen(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setName(supplier.name);
    setContactName(supplier.contactName || "");
    setPhone(supplier.phone || "");
    setEmail(supplier.email || "");
    setAddress(supplier.address || "");
    setCity(supplier.city || "");
    setTaxId(supplier.taxId || "");
    setPaymentTerms(supplier.paymentTerms || "Net 30");
    setNotes(supplier.notes || "");
    setIsActive(supplier.isActive);
    setFormError("");
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        contactName: contactName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        taxId: taxId.trim() || undefined,
        paymentTerms: paymentTerms.trim() || undefined,
        notes: notes.trim() || undefined,
        isActive,
      };

      const url = editingSupplier
        ? `${ROOT}/purchasing/suppliers/${editingSupplier.id}`
        : `${ROOT}/purchasing/suppliers`;
      const method = editingSupplier ? "PATCH" : "POST";

      const res = await authenticatedFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to save supplier");
      }

      setModalOpen(false);
      await loadSuppliers();
    } catch (err: any) {
      setFormError(err.message || "Operation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (supplier: Supplier) => {
    if (
      !window.confirm(
        `Are you sure you want to deactivate/delete supplier "${supplier.name}"?`,
      )
    ) {
      return;
    }

    try {
      const res = await authenticatedFetch(
        `${ROOT}/purchasing/suppliers/${supplier.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Could not delete supplier");
      }
      await loadSuppliers();
    } catch (err: any) {
      alert(err.message || "Failed to delete supplier");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/purchasing"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft size={14} /> Back to Purchasing
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Suppliers Directory
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage vendors, trade terms, and contact profiles for stock procurement.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            <Plus size={15} /> Add Supplier
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-[#121A30]">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search suppliers by name, phone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-1.5 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
          />
        </div>
        <button
          type="button"
          onClick={() => void loadSuppliers()}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Suppliers Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-white/10 dark:bg-[#121A30]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Supplier Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Payment Terms</th>
                <th className="px-4 py-3 text-center">Orders</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {loading && suppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 size={24} className="mx-auto animate-spin mb-2 text-indigo-500" />
                    Loading suppliers...
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="mx-auto max-w-sm text-center">
                      <Building2 size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        No suppliers found
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Add your vendors and suppliers to begin issuing purchase orders.
                      </p>
                      <button
                        type="button"
                        onClick={openAddModal}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white"
                      >
                        <Plus size={14} /> Add Supplier
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                    <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-slate-100">
                      <div>{s.name}</div>
                      {s.taxId && (
                        <div className="text-[10px] text-slate-400 font-normal">
                          BIN/Tax: {s.taxId}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                      {s.contactName && <div className="font-medium">{s.contactName}</div>}
                      {s.phone && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Phone size={10} /> {s.phone}
                        </div>
                      )}
                      {s.email && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Mail size={10} /> {s.email}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">
                      {s.city || s.address ? (
                        <div>{[s.address, s.city].filter(Boolean).join(", ")}</div>
                      ) : (
                        <span className="italic text-slate-400">Not recorded</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                      {s.paymentTerms || "Standard"}
                    </td>
                    <td className="px-4 py-3.5 text-center font-bold">
                      {s._count?.purchaseOrders || 0}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          s.isActive
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {s.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(s)}
                          className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          title="Edit supplier"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(s)}
                          className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600"
                          title="Delete supplier"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Supplier Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#121A30]">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Building2 size={16} className="text-indigo-500" />
                {editingSupplier ? "Edit Supplier" : "Add New Supplier"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-rose-700">
                  {formError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Company / Supplier Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Apex Electronics Ltd"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="e.g. Mr. Rafiqul Islam"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="sales@supplier.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    BIN / Tax ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder="Trade License or BIN"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    City / District
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Dhaka"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Terms
                  </label>
                  <input
                    type="text"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    placeholder="e.g. Net 30, COD, 50% Advance"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Plot/Road, Area..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Internal Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes, representative contact, bank details..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="supplierActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="supplierActive" className="text-slate-700 dark:text-slate-300 font-medium">
                  Active Supplier (Available for new purchase orders)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white shadow-xs hover:bg-indigo-500"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  {editingSupplier ? "Save Changes" : "Create Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
