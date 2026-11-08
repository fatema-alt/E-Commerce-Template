"use client";

import { Printer, X } from "lucide-react";
import { formatExactBDT } from "@/lib/format";
import { amountInWords } from "@/lib/amount-to-words";

export type ExpenseRecord = {
  id: string;
  voucherNo: string;
  title: string;
  amount: string | number;
  categoryId: string;
  category?: {
    id: string;
    name: string;
    code?: string | null;
    color?: string | null;
  };
  expenseDate: string;
  paymentMethod: string;
  paidTo?: string | null;
  spentBy?: string | null;
  receiptNumber?: string | null;
  receiptUrl?: string | null;
  notes?: string | null;
  status: "PAID" | "PENDING" | "VOID";
  createdAt: string;
};

interface Props {
  expense: ExpenseRecord;
  onClose: () => void;
}

export function ExpenseVoucherSlip({ expense, onClose }: Props) {
  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(expense.expenseDate).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
      {/* Outer Card */}
      <div className="relative w-full max-w-2xl max-h-[calc(100vh-2rem)] sm:max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800 my-auto print:max-h-none print:shadow-none print:border-none print:max-w-none print:w-full">
        {/* Top Action Bar (hidden on print) */}
        <div className="shrink-0 flex items-center justify-between border-b border-slate-200 px-6 py-3.5 bg-slate-50 dark:bg-slate-800/80 dark:border-slate-800 print:hidden">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Expense Voucher Preview
            </h3>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
              {expense.voucherNo}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
            >
              <Printer className="h-4 w-4" />
              Print Slip
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800 transition"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Voucher Content */}
        <div className="p-6 sm:p-8 font-sans text-slate-800 dark:text-slate-200 overflow-y-auto flex-1 min-h-0 overscroll-contain print:text-black print:p-6 print:m-0 print:overflow-visible">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-5 dark:border-slate-600 print:border-black">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white print:text-black">
                  DS MART
                </h1>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mt-0.5 dark:text-slate-400 print:text-gray-600">
                  Retail & Wholesale Operations
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 print:text-gray-700 mt-1">
                  Dhaka, Bangladesh • Hotline: 01968-300400
                </p>
              </div>

              <div className="text-right">
                <span className="inline-block border-2 border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300 font-extrabold text-sm uppercase px-3 py-1 rounded tracking-wider print:border-black print:text-black">
                  DEBIT VOUCHER / খরচের ভাউচার
                </span>
                <div className="mt-2 text-xs font-mono text-slate-600 dark:text-slate-400 print:text-black">
                  <div>Voucher No: <strong>{expense.voucherNo}</strong></div>
                  <div>Date: <strong>{formattedDate}</strong></div>
                </div>
              </div>
            </div>
          </div>

          {/* Details Table */}
          <div className="my-6 space-y-3 text-sm">
            <div className="grid grid-cols-3 py-2 border-b border-slate-100 dark:border-slate-800 print:border-gray-200">
              <span className="font-semibold text-slate-600 dark:text-slate-400 print:text-gray-700">
                Expense Head / খাত:
              </span>
              <span className="col-span-2 font-bold text-slate-900 dark:text-white print:text-black flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded-full print:hidden"
                  style={{ backgroundColor: expense.category?.color || "#64748b" }}
                />
                {expense.category?.name || "General Expense"}
                {expense.category?.code && (
                  <span className="text-xs font-normal text-slate-500">
                    ({expense.category.code})
                  </span>
                )}
              </span>
            </div>

            <div className="grid grid-cols-3 py-2 border-b border-slate-100 dark:border-slate-800 print:border-gray-200">
              <span className="font-semibold text-slate-600 dark:text-slate-400 print:text-gray-700">
                Paid To (প্রাপক / ব্যক্তি / প্রতিষ্ঠান):
              </span>
              <span className="col-span-2 font-semibold text-slate-900 dark:text-white print:text-black">
                {expense.paidTo || "—"}
              </span>
            </div>

            <div className="grid grid-cols-3 py-2 border-b border-slate-100 dark:border-slate-800 print:border-gray-200">
              <span className="font-semibold text-slate-600 dark:text-slate-400 print:text-gray-700">
                Payment Mode / মাধ্যম:
              </span>
              <div className="col-span-2 flex items-center gap-3">
                <span className="font-semibold text-slate-900 dark:text-white print:text-black uppercase">
                  {expense.paymentMethod.replace(/_/g, " ")}
                </span>
                {expense.receiptNumber && (
                  <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-700 border border-slate-200 print:border-gray-300">
                    Memo/Txn: {expense.receiptNumber}
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded font-semibold uppercase ${
                  expense.status === "PAID"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : expense.status === "VOID"
                    ? "bg-rose-100 text-rose-800 border border-rose-200"
                    : "bg-amber-100 text-amber-800 border border-amber-200"
                }`}>
                  {expense.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 py-2 border-b border-slate-100 dark:border-slate-800 print:border-gray-200">
              <span className="font-semibold text-slate-600 dark:text-slate-400 print:text-gray-700">
                Spent By / Authorized:
              </span>
              <span className="col-span-2 text-slate-900 dark:text-white print:text-black">
                {expense.spentBy || "Store Administration"}
              </span>
            </div>

            <div className="grid grid-cols-3 py-2 border-b border-slate-100 dark:border-slate-800 print:border-gray-200">
              <span className="font-semibold text-slate-600 dark:text-slate-400 print:text-gray-700">
                Purpose / বিবরণ:
              </span>
              <span className="col-span-2 font-medium text-slate-900 dark:text-white print:text-black">
                {expense.title}
                {expense.notes && (
                  <span className="block text-xs text-slate-500 mt-1 print:text-gray-600">
                    Note: {expense.notes}
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Amount Box */}
          <div className="my-6 rounded-xl border-2 border-slate-900 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50 print:border-black print:bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 print:text-gray-600">
                Total Amount Paid / মোট খরচ:
              </span>
              <span className="text-2xl font-black text-slate-900 dark:text-white print:text-black">
                {formatExactBDT(expense.amount)}
              </span>
            </div>
            <div className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-700 dark:text-slate-300 print:text-black print:border-gray-300">
              <span className="font-semibold">In Words (কথায়): </span>
              <span className="italic font-medium">{amountInWords(expense.amount)}</span>
            </div>
          </div>

          {/* Signature Blocks */}
          <div className="mt-14 grid grid-cols-4 gap-4 text-center text-xs">
            <div className="border-t border-slate-400 pt-2 print:border-black">
              <p className="font-medium text-slate-700 dark:text-slate-300 print:text-black">
                Prepared By
              </p>
              <p className="text-[10px] text-slate-400 print:text-gray-500">প্রস্তুতকারী</p>
            </div>
            <div className="border-t border-slate-400 pt-2 print:border-black">
              <p className="font-medium text-slate-700 dark:text-slate-300 print:text-black">
                Checked By
              </p>
              <p className="text-[10px] text-slate-400 print:text-gray-500">যাচাইকারী</p>
            </div>
            <div className="border-t border-slate-400 pt-2 print:border-black">
              <p className="font-medium text-slate-700 dark:text-slate-300 print:text-black">
                Approved By
              </p>
              <p className="text-[10px] text-slate-400 print:text-gray-500">অনুমোদনকারী</p>
            </div>
            <div className="border-t border-slate-400 pt-2 print:border-black">
              <p className="font-medium text-slate-700 dark:text-slate-300 print:text-black">
                Receiver&apos;s Signature
              </p>
              <p className="text-[10px] text-slate-400 print:text-gray-500">প্রাপকের স্বাক্ষর</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
