"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Phone,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
} from "lucide-react";
import { useAdminAuth } from "@/lib/auth-context";

const API = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"
).replace(/\/$/, "");
const ROOT = API.endsWith("/api/v1") ? API : `${API}/api/v1`;

export default function AdminProfilePage() {
  const { user, refreshUser } = useAdminAuth();

  // Profile Form
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Password Form
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passLoading, setPassLoading] = useState(false);
  const [passMsg, setPassMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setPhone(user.phone || "");
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setProfileLoading(true);

    try {
      const res = await fetch(`${ROOT}/auth/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Commerce-Admin": "1",
        },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update profile.");
      }

      await refreshUser();
      setProfileMsg({
        type: "success",
        text: "Your profile information was updated successfully.",
      });
    } catch (err: any) {
      setProfileMsg({
        type: "error",
        text: err.message || "Failed to update profile.",
      });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg(null);

    if (newPassword.length < 8) {
      setPassMsg({
        type: "error",
        text: "New password must be at least 8 characters long.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassMsg({
        type: "error",
        text: "New password and confirmation do not match.",
      });
      return;
    }

    setPassLoading(true);

    try {
      const res = await fetch(`${ROOT}/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Commerce-Admin": "1",
        },
        credentials: "include",
        body: JSON.stringify({
          oldPassword,
          newPassword,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to change password.");
      }

      setPassMsg({
        type: "success",
        text: "Password updated successfully! Please keep it secure.",
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPassMsg({
        type: "error",
        text: err.message || "Failed to change password.",
      });
    } finally {
      setPassLoading(false);
    }
  };

  const roleTitle = user?.role ? user.role.replace(/_/g, " ") : "User";

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          My Account & Profile
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your personal information, role privileges, and password security.
        </p>
      </div>

      {/* Profile Overview Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xl font-black text-white shadow-md">
              {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "A"}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {user?.name || "DS Mart Administrator"}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                <Mail size={13} />
                <span>{user?.email}</span>
              </div>
              {user?.phone && (
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  <Phone size={13} />
                  <span>{user.phone}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-400">Assigned Role:</span>
            <span className="mt-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
              <Shield size={13} />
              {roleTitle}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Details Form */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Personal Information
              </h3>
            </div>

            {profileMsg && (
              <div
                className={`mb-4 rounded-xl p-3 text-xs font-medium border ${
                  profileMsg.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                    : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                }`}
              >
                {profileMsg.text}
              </div>
            )}

            <form id="profile-form" onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name (আপনার নাম)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Shakil Rahim"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number (মোবাইল নম্বর)
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +8801968300400"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address (লগইন ইমেইল)
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500 cursor-not-allowed dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400 font-mono"
                  />
                  <Lock className="absolute right-3.5 top-3 h-4 w-4 text-slate-400" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Email cannot be changed directly for security.
                </p>
              </div>
            </form>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              form="profile-form"
              disabled={profileLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60 transition"
            >
              {profileLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Profile
            </button>
          </div>
        </div>

        {/* Change Password Form */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <KeyRound className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Change Password (পাসওয়ার্ড পরিবর্তন)
              </h3>
            </div>

            {passMsg && (
              <div
                className={`mb-4 rounded-xl p-3 text-xs font-medium border ${
                  passMsg.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                    : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                }`}
              >
                {passMsg.text}
              </div>
            )}

            <form id="password-form" onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Current Password (বর্তমান পাসওয়ার্ড)
                </label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Password (নতুন পাসওয়ার্ড - কমপক্ষে ৮ অক্ষর)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Confirm New Password (নতুন পাসওয়ার্ড নিশ্চিত করুন)
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  required
                />
              </div>
            </form>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              form="password-form"
              disabled={passLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 disabled:opacity-60 transition"
            >
              {passLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Update Password
            </button>
          </div>
        </div>
      </div>

      {/* Role Privileges Overview Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Role Privileges in DS Mart
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-xs">
          <div className={`p-4 rounded-xl border ${user?.role === 'SUPER_ADMIN' ? 'border-purple-300 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/20' : 'border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40'}`}>
            <span className="font-bold text-purple-700 dark:text-purple-300 uppercase block mb-1">
              Super Admin
            </span>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Complete, unrestricted system control. Can manage settings, API keys, and promote/create all user roles.
            </p>
          </div>

          <div className={`p-4 rounded-xl border ${user?.role === 'ADMIN' ? 'border-indigo-300 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/20' : 'border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40'}`}>
            <span className="font-bold text-indigo-700 dark:text-indigo-300 uppercase block mb-1">
              Admin
            </span>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Full store, operations, finance, CMS, and staff management access.
            </p>
          </div>

          <div className={`p-4 rounded-xl border ${user?.role === 'MANAGER' ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20' : 'border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40'}`}>
            <span className="font-bold text-emerald-700 dark:text-emerald-300 uppercase block mb-1">
              Manager
            </span>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Daily store operations: Products, Inventory, Orders, Purchasing, Reviews, Customers, and Expense vouchers.
            </p>
          </div>

          <div className={`p-4 rounded-xl border ${user?.role === 'STAFF' ? 'border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60' : 'border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40'}`}>
            <span className="font-bold text-slate-700 dark:text-slate-300 uppercase block mb-1">
              Staff
            </span>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Operational execution: Order processing, status updates, and viewing stock movements.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
