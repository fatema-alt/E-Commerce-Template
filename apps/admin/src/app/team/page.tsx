"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Edit2,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from "lucide-react";
import { useAdminAuth, type AdminRole } from "@/lib/auth-context";

const API = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"
).replace(/\/$/, "");
const ROOT = API.endsWith("/api/v1") ? API : `${API}/api/v1`;

type AdminUserRecord = {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  role: AdminRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    sessions: number;
  };
};

function getRoleBadge(role: AdminRole) {
  switch (role) {
    case "SUPER_ADMIN":
      return {
        label: "Super Admin",
        classes:
          "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
      };
    case "ADMIN":
      return {
        label: "Admin",
        classes:
          "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
      };
    case "MANAGER":
      return {
        label: "Manager",
        classes:
          "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
      };
    case "STAFF":
      return {
        label: "Staff",
        classes:
          "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
      };
  }
}

export default function TeamManagementPage() {
  const { user: currentUser, isAdmin, isSuperAdmin } = useAdminAuth();

  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserRecord | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminRole>("MANAGER");
  const [isActive, setIsActive] = useState(true);

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (search.trim()) query.set("q", search.trim());
      if (roleFilter !== "ALL") query.set("role", roleFilter);

      const res = await fetch(`${ROOT}/auth/users?${query.toString()}`, {
        credentials: "include",
        headers: {
          "X-Commerce-Admin": "1",
        },
      });

      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter]);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin, loadUsers]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4">
        <ShieldAlert className="h-14 w-14 text-rose-500 mb-3" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Access Restricted
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mt-1">
          Only Administrators and Super Admins have permission to manage team members and role assignments.
        </p>
      </div>
    );
  }

  const openCreateModal = () => {
    setEditingUser(null);
    setEmail("");
    setName("");
    setPhone("");
    setPassword("");
    setRole("MANAGER");
    setIsActive(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (target: AdminUserRecord) => {
    setEditingUser(target);
    setEmail(target.email);
    setName(target.name || "");
    setPhone(target.phone || "");
    setPassword("");
    setRole(target.role);
    setIsActive(target.isActive);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!editingUser) {
      if (!email.trim() || !email.includes("@")) {
        setFormError("Please provide a valid email address.");
        return;
      }
      if (password.length < 8) {
        setFormError("Password must be at least 8 characters long.");
        return;
      }
    }

    setFormLoading(true);

    try {
      const payload: Record<string, any> = {
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        role,
        isActive,
      };

      if (!editingUser) {
        payload.email = email.trim().toLowerCase();
        payload.password = password;
      } else if (password.trim()) {
        payload.password = password.trim();
      }

      const url = editingUser
        ? `${ROOT}/auth/users/${editingUser.id}`
        : `${ROOT}/auth/users`;
      const method = editingUser ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Commerce-Admin": "1",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to save user account.");
      }

      setIsModalOpen(false);
      loadUsers();
    } catch (err: any) {
      setFormError(err.message || "Something went wrong.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`${ROOT}/auth/users/${id}`, {
        method: "DELETE",
        headers: {
          "X-Commerce-Admin": "1",
        },
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to delete user.");
      }

      setDeletingId(null);
      loadUsers();
    } catch (err: any) {
      alert(err.message || "Failed to delete user.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const totalMembers = users.length;
  const managersCount = users.filter((u) => u.role === "MANAGER").length;
  const adminsCount = users.filter((u) => u.role === "ADMIN" || u.role === "SUPER_ADMIN").length;
  const activeCount = users.filter((u) => u.isActive).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Team & Role Management
            </h1>
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
              টিম ও ইউজার রোল
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Create role-based team accounts (Admin, Manager, Staff) and manage access permissions.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition self-start sm:self-auto"
        >
          <UserPlus size={16} />
          Add Team Member (নতুন ইউজার)
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Team Members
            </span>
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Users size={18} />
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-2">
            {totalMembers}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Store Managers
            </span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <ShieldCheck size={18} />
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-2">
            {managersCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Administrators
            </span>
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
              <Shield size={18} />
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-2">
            {adminsCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Accounts
            </span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <UserCheck size={18} />
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-2">
            {activeCount}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team member by name, email, or phone..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div className="w-full sm:w-48">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="ALL">All Roles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="ADMIN">Admin</option>
            <option value="MANAGER">Manager</option>
            <option value="STAFF">Staff</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            setSearch("");
            setRoleFilter("ALL");
          }}
          title="Reset"
          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
            <p className="text-sm font-medium">Loading team members...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <Users className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              No team members found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-4">
              Get started by creating your first Manager or Admin team member.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
            >
              <UserPlus size={16} />
              Add Team Member
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <th className="px-5 py-3.5">User</th>
                  <th className="px-5 py-3.5">Phone</th>
                  <th className="px-5 py-3.5">Assigned Role</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Created Date</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map((item) => {
                  const roleBadge = getRoleBadge(item.role);
                  const isCurrent = item.id === currentUser?.id;
                  const initials = item.name
                    ? item.name
                        .split(" ")
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()
                    : item.email[0].toUpperCase();

                  const createdDate = new Date(item.createdAt).toLocaleDateString(
                    "en-GB",
                    { day: "2-digit", month: "short", year: "numeric" }
                  );

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white shadow-xs">
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                              {item.name || "—"}
                              {isCurrent && (
                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-400">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 font-mono">
                              {item.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">
                        {item.phone || "—"}
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${roleBadge.classes}`}
                        >
                          {roleBadge.label}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
                            item.isActive
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              item.isActive ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          />
                          {item.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-xs text-slate-500">
                        {createdDate}
                      </td>

                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            title="Edit Role & Details"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white transition"
                          >
                            <Edit2 size={15} />
                          </button>

                          {isSuperAdmin && !isCurrent && item.role !== "SUPER_ADMIN" && (
                            <button
                              type="button"
                              onClick={() => setDeletingId(item.id)}
                              title="Delete Account"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 transition"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg max-h-[calc(100vh-2rem)] sm:max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800 my-auto">
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between border-b border-slate-200 px-6 py-3.5 bg-slate-50 dark:bg-slate-800/80 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingUser ? "Edit Team Member" : "Create Team Member (নতুন ইউজার)"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {editingUser
                    ? "Update account details, role assignment, or reset password"
                    : "Add an Admin, Manager, or Staff member with role permissions"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0 overscroll-contain">
                {formError && (
                  <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
                    {formError}
                  </div>
                )}

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address (লগইন ইমেইল) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    disabled={!!editingUser}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. manager@dsmart.com"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:disabled:bg-slate-800/50"
                    required
                  />
                </div>

                {/* Name & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Full Name (ইউজারের নাম)
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Shakil Rahim"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Phone Number (মোবাইল নং)
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +8801968300400"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Role Assignment */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Assign Role (ভূমিকা নির্ধারণ) <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Manager Card */}
                    <div
                      onClick={() => setRole("MANAGER")}
                      className={`cursor-pointer rounded-xl border p-3 transition ${
                        role === "MANAGER"
                          ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30"
                          : "border-slate-200 hover:border-slate-300 dark:border-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          MANAGER (ম্যানেজার)
                        </span>
                        <input
                          type="radio"
                          name="role"
                          checked={role === "MANAGER"}
                          onChange={() => setRole("MANAGER")}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Products, Orders, Inventory, Purchasing, Reviews & Expenses. No access to Settings/Team.
                      </p>
                    </div>

                    {/* Admin Card */}
                    <div
                      onClick={() => setRole("ADMIN")}
                      className={`cursor-pointer rounded-xl border p-3 transition ${
                        role === "ADMIN"
                          ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30"
                          : "border-slate-200 hover:border-slate-300 dark:border-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">
                          ADMIN (অ্যাডমিন)
                        </span>
                        <input
                          type="radio"
                          name="role"
                          checked={role === "ADMIN"}
                          onChange={() => setRole("ADMIN")}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Full store administration: Catalog, Orders, CMS, Finance, and Staff management.
                      </p>
                    </div>

                    {/* Staff Card */}
                    <div
                      onClick={() => setRole("STAFF")}
                      className={`cursor-pointer rounded-xl border p-3 transition ${
                        role === "STAFF"
                          ? "border-slate-500 bg-slate-50 dark:bg-slate-800/60"
                          : "border-slate-200 hover:border-slate-300 dark:border-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          STAFF (স্টাফ)
                        </span>
                        <input
                          type="radio"
                          name="role"
                          checked={role === "STAFF"}
                          onChange={() => setRole("STAFF")}
                          className="text-slate-600 focus:ring-slate-500"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Day-to-day order processing and stock checking.
                      </p>
                    </div>

                    {/* Super Admin Card (Only if current user is Super Admin) */}
                    {isSuperAdmin && (
                      <div
                        onClick={() => setRole("SUPER_ADMIN")}
                        className={`cursor-pointer rounded-xl border p-3 transition ${
                          role === "SUPER_ADMIN"
                            ? "border-purple-500 bg-purple-50/50 dark:bg-purple-950/30"
                            : "border-slate-200 hover:border-slate-300 dark:border-slate-800"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-purple-700 dark:text-purple-400">
                            SUPER ADMIN
                          </span>
                          <input
                            type="radio"
                            name="role"
                            checked={role === "SUPER_ADMIN"}
                            onChange={() => setRole("SUPER_ADMIN")}
                            className="text-purple-600 focus:ring-purple-500"
                          />
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          Full master access including system payment keys, couriers, and credentials.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Password / Reset Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {editingUser
                      ? "Reset Password (নতুন পাসওয়ার্ড সেট করুন - ঐচ্ছিক)"
                      : "Account Password (লগইন পাসওয়ার্ড) *"}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={editingUser ? "Leave empty to keep existing password" : "At least 8 characters"}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    required={!editingUser}
                  />
                </div>

                {/* Active Toggle */}
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="isActiveToggle"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="isActiveToggle" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Active Account (লগইন অনুমতি কার্যকর রাখুন)
                  </label>
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-3.5 border-t border-slate-200 bg-slate-50/80 dark:bg-slate-900/95 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={formLoading}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60 transition"
                >
                  {formLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingUser ? "Update User" : "Create User (ইউজার সংরক্ষণ)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 mb-3">
              <AlertCircle size={22} />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Delete Team Member?
              </h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Are you sure you want to delete this user account? Their active sessions will be terminated immediately.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                disabled={deleteLoading}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deletingId)}
                disabled={deleteLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-60 transition"
              >
                {deleteLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
