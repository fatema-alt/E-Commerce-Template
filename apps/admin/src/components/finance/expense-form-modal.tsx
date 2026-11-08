"use client";

import { useState } from "react";
import { Loader2, X, PlusCircle, Calendar, DollarSign, FileText, User, CreditCard } from "lucide-react";
import type { ExpenseRecord } from "./expense-voucher-slip";

export type ExpenseCategoryItem = {
  id: string;
  name: string;
  code?: string | null;
  color?: string | null;
  isActive: boolean;
};

interface Props {
  initialData?: ExpenseRecord | null;
  categories: ExpenseCategoryItem[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  apiRoot: string;
}

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash (নগদ টাকা)" },
  { value: "BKASH", label: "bKash (বিকাশ)" },
  { value: "NAGAD", label: "Nagad (নগদ)" },
  { value: "ROCKET", label: "Rocket (রকেট)" },
  { value: "UPAY", label: "Upay (উপায়)" },
  { value: "BANK_TRANSFER", label: "Bank Transfer (ব্যাংক ট্রান্সফার)" },
  { value: "CARD", label: "Debit/Credit Card (কার্ড)" },
  { value: "CHEQUE", label: "Cheque (চেক)" },
  { value: "OTHER", label: "Other (অন্যান্য)" },
];

export function ExpenseFormModal({
  initialData,
  categories,
  isOpen,
  onClose,
  onSuccess,
  apiRoot,
}: Props) {
  const isEdit = !!initialData;

  const [title, setTitle] = useState(initialData?.title || "");
  const [amount, setAmount] = useState(initialData?.amount ? String(initialData.amount) : "");
  const [categoryId, setCategoryId] = useState(
    initialData?.categoryId || (categories.length > 0 ? categories[0].id : "")
  );
  const [expenseDate, setExpenseDate] = useState(
    initialData?.expenseDate
      ? new Date(initialData.expenseDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );
  const [paymentMethod, setPaymentMethod] = useState(
    initialData?.paymentMethod || "CASH"
  );
  const [paidTo, setPaidTo] = useState(initialData?.paidTo || "");
  const [spentBy, setSpentBy] = useState(initialData?.spentBy || "");
  const [receiptNumber, setReceiptNumber] = useState(initialData?.receiptNumber || "");
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [status, setStatus] = useState<"PAID" | "PENDING" | "VOID">(
    initialData?.status || "PAID"
  );
  const [voucherNo, setVoucherNo] = useState(initialData?.voucherNo || "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid expense amount greater than 0.");
      return;
    }

    if (!title.trim()) {
      setError("Please provide an expense title/purpose.");
      return;
    }

    if (!categoryId) {
      setError("Please select an expense category.");
      return;
    }

    setLoading(true);

    try {
      const payload: Record<string, any> = {
        title: title.trim(),
        amount: parsedAmount,
        categoryId,
        expenseDate: new Date(expenseDate).toISOString(),
        paymentMethod,
        paidTo: paidTo.trim() || undefined,
        spentBy: spentBy.trim() || undefined,
        receiptNumber: receiptNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        status,
      };

      if (voucherNo.trim()) {
        payload.voucherNo = voucherNo.trim();
      }

      const url = isEdit
        ? `${apiRoot}/finance/expenses/${initialData.id}`
        : `${apiRoot}/finance/expenses`;
      const method = isEdit ? "PATCH" : "POST";

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
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to save expense record.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50 dark:bg-slate-800/60 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {isEdit ? "Edit Expense Voucher" : "New Expense Voucher (খরচ এন্ট্রি)"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Record manual shop, warehouse, or office expenses
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* Row 1: Date & Voucher No */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Date of Expense <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Voucher Number
              </label>
              <input
                type="text"
                value={voucherNo}
                onChange={(e) => setVoucherNo(e.target.value)}
                placeholder="Auto-generated (e.g. EXP-...)"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
              />
            </div>
          </div>

          {/* Row 2: Category & Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Expense Category (খাত) <span className="text-rose-500">*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} {cat.code ? `(${cat.code})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Amount (টাকার পরিমাণ ৳) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm font-bold text-slate-400">
                  ৳
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-2 text-sm font-bold text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  required
                />
              </div>
            </div>
          </div>

          {/* Row 3: Title / Purpose */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Purpose / Title (খরচের উদ্দেশ্য বা বিবরণ) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. দোকান ভাড়া বাবদ / বিদ্যুৎ বিল / অফিসের জন্য চা-নাস্তা"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              required
            />
          </div>

          {/* Row 4: Payment Method & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Payment Method (মাধ্যম)
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm.value} value={pm.value}>
                    {pm.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Payment Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="PAID">PAID (পরিশোধিত)</option>
                <option value="PENDING">PENDING (বকেয়া/অপেক্ষমান)</option>
                <option value="VOID">VOID (বাতিল)</option>
              </select>
            </div>
          </div>

          {/* Row 5: Paid To & Spent By */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Paid To (প্রাপক / ব্যক্তি / কোম্পানি)
              </label>
              <input
                type="text"
                value={paidTo}
                onChange={(e) => setPaidTo(e.target.value)}
                placeholder="e.g. Md. Rafiqul Islam / DESCO"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Spent By / Authorized By (অনুমোদনকারী)
              </label>
              <input
                type="text"
                value={spentBy}
                onChange={(e) => setSpentBy(e.target.value)}
                placeholder="e.g. Manager Shakil / Karim"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Row 6: Physical Memo / Receipt Number */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Receipt / Bill Memo / Txn No (ক্যাশ মেমো বা রসিদ নং)
            </label>
            <input
              type="text"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              placeholder="e.g. MEMO-9821, TrxID: 9XF78K..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Row 7: Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Remarks / Notes (অতিরিক্ত মন্তব্য)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details or explanations..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60 transition"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Update Voucher" : "Save Voucher (ভাউচার সংরক্ষণ)"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
