"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Edit2,
  Eye,
  FilePlus,
  Filter,
  FolderTree,
  Loader2,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  Trash2,
  Wallet,
  X,
  AlertCircle,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { formatExactBDT } from "@/lib/format";
import {
  ExpenseVoucherSlip,
  type ExpenseRecord,
} from "@/components/finance/expense-voucher-slip";
import {
  ExpenseFormModal,
  type ExpenseCategoryItem,
} from "@/components/finance/expense-form-modal";

const API = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
).replace(/\/$/, "");
const ROOT = API.endsWith("/api/v1") ? API : `${API}/api/v1`;

type Summary = {
  totalThisMonth: number;
  totalToday: number;
  totalAllTime: number;
  totalVouchersCount: number;
  byCategory: Array<{
    categoryId: string;
    name: string;
    code: string;
    color: string;
    total: number;
    count: number;
  }>;
};

export default function ExpenseLedgerPage() {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [categories, setCategories] = useState<ExpenseCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalFilteredAmount, setTotalFilteredAmount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [datePreset, setDatePreset] = useState<
    "all" | "today" | "yesterday" | "this_month" | "last_month" | "custom"
  >("this_month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [viewingExpense, setViewingExpense] = useState<ExpenseRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Calculate dates based on preset
  useEffect(() => {
    const now = new Date();
    if (datePreset === "today") {
      const todayStr = now.toISOString().slice(0, 10);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (datePreset === "yesterday") {
      const yest = new Date(now);
      yest.setDate(now.getDate() - 1);
      const yestStr = yest.toISOString().slice(0, 10);
      setStartDate(yestStr);
      setEndDate(yestStr);
    } else if (datePreset === "this_month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .slice(0, 10);
      const end = now.toISOString().slice(0, 10);
      setStartDate(start);
      setEndDate(end);
    } else if (datePreset === "last_month") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        .toISOString()
        .slice(0, 10);
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
        .toISOString()
        .slice(0, 10);
      setStartDate(start);
      setEndDate(end);
    } else if (datePreset === "all") {
      setStartDate("");
      setEndDate("");
    }
  }, [datePreset]);

  // Load Categories
  const loadCategories = useCallback(async () => {
    try {
      const res = await authenticatedFetch(
        `${ROOT}/finance/categories?includeInactive=true`
      );
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error("Failed to load expense categories:", err);
    }
  }, []);

  // Load Expenses & Summary
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (categoryFilter !== "ALL") query.set("categoryId", categoryFilter);
      if (paymentFilter !== "ALL") query.set("paymentMethod", paymentFilter);
      if (statusFilter !== "ALL") query.set("status", statusFilter);
      if (startDate) query.set("startDate", startDate);
      if (endDate) query.set("endDate", endDate);
      if (search.trim()) query.set("q", search.trim());
      query.set("limit", "100");

      const [expensesRes, summaryRes] = await Promise.all([
        authenticatedFetch(`${ROOT}/finance/expenses?${query.toString()}`),
        authenticatedFetch(`${ROOT}/finance/summary`),
      ]);

      if (expensesRes.ok) {
        const d = await expensesRes.json();
        setExpenses(d.items || []);
        setTotalFilteredAmount(d.totalAmount || 0);
        setTotalCount(d.total || 0);
      }

      if (summaryRes.ok) {
        const s = await summaryRes.json();
        setSummary(s);
      }
    } catch (err) {
      console.error("Failed to load expenses data:", err);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, paymentFilter, statusFilter, startDate, endDate, search]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Delete
  const handleDelete = async (id: string) => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`${ROOT}/finance/expenses/${id}`, {
        method: "DELETE",
        headers: {
          "X-Commerce-Admin": "1",
        },
        credentials: "include",
      });
      if (res.ok) {
        setDeletingId(null);
        loadData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || "Failed to delete expense record");
      }
    } catch (err) {
      alert("Failed to delete expense");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handlePrintLedger = () => {
    window.print();
  };

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Manual Expense Ledger
            </h1>
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
              দোকান ও অফিস খরচ
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manual debit vouchers for rent, utilities, tea & snacks, salary, and daily store operational expenses.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/finance/categories"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition"
          >
            <FolderTree className="h-4 w-4 text-slate-500" />
            Categories
          </Link>

          <button
            type="button"
            onClick={handlePrintLedger}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            Print Ledger
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingExpense(null);
              setIsFormOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
          >
            <Plus className="h-4 w-4" />
            New Expense Voucher
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              This Month&apos;s Expense
            </span>
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Calendar className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {formatExactBDT(summary?.totalThisMonth ?? 0)}
            </span>
            <p className="text-xs text-slate-500 mt-1">
              চলতি মাসের মোট খরচ
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Today&apos;s Expense
            </span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {formatExactBDT(summary?.totalToday ?? 0)}
            </span>
            <p className="text-xs text-slate-500 mt-1">
              আজকের দিনভিত্তিক খরচ
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Filtered Total
            </span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {formatExactBDT(totalFilteredAmount)}
            </span>
            <p className="text-xs text-slate-500 mt-1">
              {totalCount} voucher{totalCount === 1 ? "" : "s"} selected
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              All-Time Ledger Total
            </span>
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
              <Receipt className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {formatExactBDT(summary?.totalAllTime ?? 0)}
            </span>
            <p className="text-xs text-slate-500 mt-1">
              Total {summary?.totalVouchersCount ?? 0} vouchers recorded
            </p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3.5 print:hidden">
        {/* Preset Pills */}
        <div className="flex items-center gap-2 flex-wrap border-b border-slate-100 pb-3 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">
            Date Range:
          </span>
          {[
            { id: "today", label: "Today" },
            { id: "yesterday", label: "Yesterday" },
            { id: "this_month", label: "This Month" },
            { id: "last_month", label: "Last Month" },
            { id: "all", label: "All Time" },
            { id: "custom", label: "Custom Dates" },
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setDatePreset(preset.id as any)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                datePreset === preset.id
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Search */}
          <div className="lg:col-span-4 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search voucher #, title, payee, memo..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Category Dropdown */}
          <div className="lg:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="ALL">All Expense Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.code ? `(${c.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method Dropdown */}
          <div className="lg:col-span-2">
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="ALL">All Payment Modes</option>
              <option value="CASH">Cash</option>
              <option value="BKASH">bKash</option>
              <option value="NAGAD">Nagad</option>
              <option value="ROCKET">Rocket</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CARD">Card</option>
              <option value="CHEQUE">Cheque</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="lg:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="PAID">Paid</option>
              <option value="PENDING">Pending</option>
              <option value="VOID">Void</option>
            </select>
          </div>

          {/* Reset button */}
          <div className="lg:col-span-1 flex items-center justify-end">
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setCategoryFilter("ALL");
                setPaymentFilter("ALL");
                setStatusFilter("ALL");
                setDatePreset("this_month");
              }}
              title="Reset Filters"
              className="w-full h-full flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Custom date range inputs */}
        {datePreset === "custom" && (
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex-wrap">
            <span className="text-xs font-semibold text-slate-500">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <span className="text-xs font-semibold text-slate-500">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        )}
      </div>

      {/* Main Ledger Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
            <p className="text-sm font-medium">Loading expense records...</p>
          </div>
        ) : expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <Receipt className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              No expense records found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-4">
              {search || categoryFilter !== "ALL" || datePreset !== "all"
                ? "Try adjusting your search filters or date range."
                : "Get started by recording your first shop or office expense voucher."}
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingExpense(null);
                setIsFormOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
            >
              <Plus className="h-4 w-4" />
              New Expense Voucher
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <th className="px-4 py-3.5">Voucher #</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-4 py-3.5">Category / Head</th>
                  <th className="px-4 py-3.5">Purpose / Title</th>
                  <th className="px-4 py-3.5">Paid To / Spent By</th>
                  <th className="px-4 py-3.5">Payment Mode</th>
                  <th className="px-4 py-3.5 text-right">Amount (৳)</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-right print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {expenses.map((expense) => {
                  const formattedDate = new Date(
                    expense.expenseDate
                  ).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  });

                  return (
                    <tr
                      key={expense.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                    >
                      {/* Voucher No */}
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => setViewingExpense(expense)}
                          className="font-mono font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline"
                        >
                          {expense.voucherNo}
                        </button>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 dark:text-slate-400 text-xs font-medium">
                        {formattedDate}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{
                              backgroundColor:
                                expense.category?.color || "#64748b",
                            }}
                          />
                          {expense.category?.name || "General"}
                        </span>
                      </td>

                      {/* Title & Notes */}
                      <td className="px-4 py-3.5 max-w-xs">
                        <div className="font-semibold text-slate-900 dark:text-white line-clamp-1">
                          {expense.title}
                        </div>
                        {expense.notes && (
                          <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                            {expense.notes}
                          </div>
                        )}
                      </td>

                      {/* Paid To & Spent By */}
                      <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-400">
                        {expense.paidTo && (
                          <div className="font-medium text-slate-800 dark:text-slate-200">
                            To: {expense.paidTo}
                          </div>
                        )}
                        {expense.spentBy && (
                          <div className="text-[11px] text-slate-400">
                            By: {expense.spentBy}
                          </div>
                        )}
                        {!expense.paidTo && !expense.spentBy && "—"}
                      </td>

                      {/* Payment Mode */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {expense.paymentMethod.replace(/_/g, " ")}
                        </span>
                        {expense.receiptNumber && (
                          <span className="block text-[10px] font-mono text-slate-400">
                            #{expense.receiptNumber}
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3.5 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatExactBDT(expense.amount)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                            expense.status === "PAID"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                              : expense.status === "VOID"
                              ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                              : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                          }`}
                        >
                          {expense.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap print:hidden">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Print / View Voucher Slip */}
                          <button
                            type="button"
                            onClick={() => setViewingExpense(expense)}
                            title="Print Voucher Slip"
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 transition"
                          >
                            <Printer className="h-4 w-4" />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingExpense(expense);
                              setIsFormOpen(true);
                            }}
                            title="Edit Expense"
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => setDeletingId(expense.id)}
                            title="Delete / Void Expense"
                            className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Table Footer Total */}
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white">
                  <td colSpan={6} className="px-4 py-3 text-right text-xs uppercase tracking-wider">
                    Total Amount for Selected Range:
                  </td>
                  <td className="px-4 py-3 text-right text-base text-indigo-700 dark:text-indigo-400">
                    {formatExactBDT(totalFilteredAmount)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Delete / Void Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 mb-3">
              <AlertCircle className="h-6 w-6" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Delete Expense Voucher?
              </h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Are you sure you want to permanently delete this expense voucher? This action cannot be undone.
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

      {/* Expense Form Modal (Create / Edit) */}
      <ExpenseFormModal
        isOpen={isFormOpen}
        initialData={editingExpense}
        categories={categories}
        onClose={() => {
          setIsFormOpen(false);
          setEditingExpense(null);
        }}
        onSuccess={() => {
          loadData();
          loadCategories();
        }}
        apiRoot={ROOT}
      />

      {/* Printable Voucher Slip Modal */}
      {viewingExpense && (
        <ExpenseVoucherSlip
          expense={viewingExpense}
          onClose={() => setViewingExpense(null)}
        />
      )}
    </div>
  );
}
