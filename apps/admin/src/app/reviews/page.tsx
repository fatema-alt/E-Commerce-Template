"use client";

import { useCallback, useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import {
  Star,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MessageSquare,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  CornerDownRight,
  Send,
  HelpCircle,
  User,
  Package,
  Check,
} from "lucide-react";

interface Review {
  id: string;
  productId: string;
  authorName: string;
  authorEmail: string;
  rating: number;
  title?: string | null;
  content: string;
  photos: string[];
  isVerifiedPurchase: boolean;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SPAM";
  helpfulCount: number;
  adminReply?: string | null;
  adminRepliedAt?: string | null;
  adminReplyAuthor?: string | null;
  createdAt: string;
  product?: {
    id: string;
    name: string;
    slug: string;
    sku: string;
    images?: { url: string; alt?: string }[];
  };
}

interface Question {
  id: string;
  productId: string;
  authorName: string;
  authorEmail: string;
  question: string;
  answer?: string | null;
  isAnswered: boolean;
  answeredAt?: string | null;
  answeredBy?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  product?: {
    id: string;
    name: string;
    slug: string;
    sku: string;
  };
}

interface ReviewStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  questionsPending: number;
  questionsTotal: number;
  averageRating: number;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export default function ReviewsPage() {
  const [activeTab, setActiveTab] = useState<"REVIEWS" | "QA">("REVIEWS");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReviewStats | null>(null);

  // Reviews State
  const [reviews, setReviews] = useState<Review[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  // Q&A State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answeringQuestionId, setAnsweringQuestionId] = useState<string | null>(
    null,
  );
  const [answerText, setAnswerText] = useState("");
  const [submittingAnswer, setSubmittingAnswer] = useState(false);

  // Feedback Toast
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

  const fetchStats = useCallback(async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/reviews/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // stats failure shouldn't block page
    }
  }, []);

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (ratingFilter) params.append("rating", ratingFilter.toString());
      if (search.trim()) params.append("q", search.trim());
      params.append("limit", "50");

      const res = await authenticatedFetch(
        `${API_BASE}/admin/reviews?${params.toString()}`,
      );
      if (!res.ok) throw new Error("Failed to load reviews");
      const data = await res.json();
      setReviews(data.items || []);
    } catch (err: any) {
      showToast("error", err.message || "Failed to load reviews.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, ratingFilter, search]);

  const fetchQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.append("q", search.trim());
      params.append("limit", "50");

      const res = await authenticatedFetch(
        `${API_BASE}/admin/qa?${params.toString()}`,
      );
      if (!res.ok) throw new Error("Failed to load questions");
      const data = await res.json();
      setQuestions(data.items || []);
    } catch (err: any) {
      showToast("error", err.message || "Failed to load questions.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchStats();
    if (activeTab === "REVIEWS") {
      fetchReviews();
    } else {
      fetchQuestions();
    }
  }, [activeTab, fetchStats, fetchReviews, fetchQuestions]);

  const handleUpdateReviewStatus = async (
    id: string,
    status: "APPROVED" | "REJECTED" | "PENDING",
  ) => {
    try {
      const res = await authenticatedFetch(
        `${API_BASE}/admin/reviews/${id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (!res.ok) throw new Error("Status update failed");
      showToast("success", `Review status changed to ${status}.`);
      fetchReviews();
      fetchStats();
    } catch (err: any) {
      showToast("error", err.message || "Could not update status.");
    }
  };

  const handleReplyReview = async (id: string) => {
    if (!replyText.trim()) return;
    try {
      setSubmittingReply(true);
      const res = await authenticatedFetch(
        `${API_BASE}/admin/reviews/${id}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reply: replyText }),
        },
      );
      if (!res.ok) throw new Error("Failed to post store reply");
      showToast("success", "Official store reply posted.");
      setReplyingTo(null);
      setReplyText("");
      fetchReviews();
    } catch (err: any) {
      showToast("error", err.message || "Failed to post reply.");
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleDeleteReview = async (id: string) => {
    if (!confirm("Are you sure you want to delete this review?")) return;
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/reviews/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      showToast("success", "Review deleted successfully.");
      fetchReviews();
      fetchStats();
    } catch (err: any) {
      showToast("error", err.message || "Could not delete review.");
    }
  };

  const handleAnswerQuestion = async (id: string) => {
    if (!answerText.trim()) return;
    try {
      setSubmittingAnswer(true);
      const res = await authenticatedFetch(`${API_BASE}/admin/qa/${id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: answerText }),
      });
      if (!res.ok) throw new Error("Failed to submit answer");
      showToast("success", "Answer published to storefront.");
      setAnsweringQuestionId(null);
      setAnswerText("");
      fetchQuestions();
      fetchStats();
    } catch (err: any) {
      showToast("error", err.message || "Could not publish answer.");
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/qa/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      showToast("success", "Question removed.");
      fetchQuestions();
      fetchStats();
    } catch (err: any) {
      showToast("error", err.message || "Could not delete question.");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Reviews & Customer Q&A
          </h1>
          <p className="text-sm text-slate-500">
            Moderate product ratings, verify customer purchases, reply to reviews, and answer buyer questions.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-1">
          <button
            onClick={() => setActiveTab("REVIEWS")}
            className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "REVIEWS"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Star size={14} />
            <span>Reviews ({stats?.total || 0})</span>
            {stats && stats.pending > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] text-white">
                {stats.pending}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("QA")}
            className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "QA"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <HelpCircle size={14} />
            <span>Q&A ({stats?.questionsTotal || 0})</span>
            {stats && stats.questionsPending > 0 && (
              <span className="rounded-full bg-blue-500 px-1.5 py-0.2 text-[10px] text-white">
                {stats.questionsPending}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {toast && (
        <div
          role="alert"
          className={`flex items-center justify-between rounded-xl border p-4 text-sm shadow-sm transition-all ${
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toast.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-xs font-semibold underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Stats Banner */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-medium text-slate-500">
              Pending Moderation
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-600">
                {stats.pending}
              </span>
              <span className="text-xs text-slate-400">awaiting approval</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-medium text-slate-500">
              Average Store Rating
            </span>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-2xl font-bold text-slate-900">
                {stats.averageRating}
              </span>
              <div className="flex text-amber-400">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    size={14}
                    className={
                      s <= Math.round(stats.averageRating)
                        ? "fill-current"
                        : "text-slate-300"
                    }
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-medium text-slate-500">
              Approved Reviews
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-600">
                {stats.approved}
              </span>
              <span className="text-xs text-slate-400">
                live on storefront
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-medium text-slate-500">
              Unanswered Questions
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-blue-600">
                {stats.questionsPending}
              </span>
              <span className="text-xs text-slate-400">need reply</span>
            </div>
          </div>
        </div>
      )}

      {/* REVIEWS TAB VIEW */}
      {activeTab === "REVIEWS" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {["ALL", "PENDING", "APPROVED", "REJECTED"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    statusFilter === st
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {st === "ALL" ? "All Reviews" : st}
                </button>
              ))}

              <div className="h-5 w-[1px] bg-slate-200 mx-1 hidden sm:block" />

              <select
                aria-label="Filter by star rating"
                value={ratingFilter || ""}
                onChange={(e) =>
                  setRatingFilter(e.target.value ? Number(e.target.value) : null)
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">All Star Ratings</option>
                <option value="5">5 Stars only</option>
                <option value="4">4 Stars only</option>
                <option value="3">3 Stars only</option>
                <option value="2">2 Stars only</option>
                <option value="1">1 Star only</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 md:w-64">
                <Search
                  size={15}
                  className="absolute left-3 top-2.5 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Search reviewer or comment..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <button
                onClick={() => fetchReviews()}
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                title="Refresh"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Reviews List */}
          {loading ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <RefreshCw className="h-4 w-4 animate-spin text-indigo-600" />
                <span>Loading reviews...</span>
              </div>
            </div>
          ) : reviews.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-center">
              <Star className="h-10 w-10 text-slate-300" />
              <h3 className="mt-3 text-sm font-semibold text-slate-900">
                No reviews found
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {search || statusFilter !== "ALL" || ratingFilter
                  ? "Try clearing filters to see more results."
                  : "Customer reviews submitted on storefront will appear here for moderation."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  {/* Top Bar */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      {/* Product Header */}
                      {rev.product && (
                        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600">
                          <Package size={14} />
                          <span>{rev.product.name}</span>
                          <span className="text-[10px] text-slate-400">
                            (SKU: {rev.product.sku})
                          </span>
                        </div>
                      )}

                      {/* Author & Rating info */}
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <div className="flex text-amber-400">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              size={15}
                              className={
                                s <= rev.rating
                                  ? "fill-current"
                                  : "text-slate-200"
                              }
                            />
                          ))}
                        </div>

                        <span className="text-xs font-bold text-slate-900">
                          {rev.authorName}
                        </span>

                        <span className="text-xs text-slate-400">
                          &lt;{rev.authorEmail}&gt;
                        </span>

                        {rev.isVerifiedPurchase && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                            <ShieldCheck size={11} />
                            Verified Buyer
                          </span>
                        )}

                        <span className="text-[11px] text-slate-400">
                          {new Date(rev.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                          rev.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : rev.status === "PENDING"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {rev.status}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="mt-3">
                    {rev.title && (
                      <h4 className="text-sm font-semibold text-slate-900">
                        {rev.title}
                      </h4>
                    )}
                    <p className="mt-1 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {rev.content}
                    </p>
                  </div>

                  {/* Photos Gallery */}
                  {rev.photos && rev.photos.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {rev.photos.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                        >
                          <img
                            src={url}
                            alt="Review photo"
                            className="h-full w-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Existing Store Reply */}
                  {rev.adminReply && (
                    <div className="mt-4 rounded-lg bg-indigo-50/70 p-3.5 border border-indigo-100 text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-indigo-900">
                        <CornerDownRight size={13} className="text-indigo-600" />
                        <span>
                          Official Reply from {rev.adminReplyAuthor || "DS Mart"}
                        </span>
                        {rev.adminRepliedAt && (
                          <span className="text-[10px] font-normal text-indigo-500">
                            •{" "}
                            {new Date(rev.adminRepliedAt).toLocaleDateString(
                              "en-US",
                              { month: "short", day: "numeric" },
                            )}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-indigo-950 leading-relaxed">
                        {rev.adminReply}
                      </p>
                    </div>
                  )}

                  {/* Reply Form Modal / Inline */}
                  {replyingTo === rev.id && (
                    <div className="mt-4 rounded-lg bg-slate-50 p-3 border border-slate-200">
                      <label className="block text-xs font-semibold text-slate-700">
                        Write Official Merchant Response:
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Thank the customer or address their feedback publicly..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="mt-1.5 block w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingTo(null);
                            setReplyText("");
                          }}
                          className="rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={submittingReply || !replyText.trim()}
                          onClick={() => handleReplyReview(rev.id)}
                          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                        >
                          <Send size={12} />
                          <span>
                            {submittingReply ? "Posting..." : "Post Public Reply"}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <span className="text-[11px] text-slate-400">
                      👍 {rev.helpfulCount} customers marked helpful
                    </span>

                    <div className="flex items-center gap-2">
                      {rev.status !== "APPROVED" && (
                        <button
                          onClick={() =>
                            handleUpdateReviewStatus(rev.id, "APPROVED")
                          }
                          className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                        >
                          <CheckCircle2 size={13} />
                          <span>Approve</span>
                        </button>
                      )}

                      {rev.status !== "REJECTED" && (
                        <button
                          onClick={() =>
                            handleUpdateReviewStatus(rev.id, "REJECTED")
                          }
                          className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 border border-red-200 hover:bg-red-100"
                        >
                          <XCircle size={13} />
                          <span>Reject</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setReplyingTo(rev.id);
                          setReplyText(rev.adminReply || "");
                        }}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <MessageSquare size={13} />
                        <span>{rev.adminReply ? "Edit Reply" : "Reply"}</span>
                      </button>

                      <button
                        onClick={() => handleDeleteReview(rev.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete Review"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Q&A TAB VIEW */}
      {activeTab === "QA" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search
                size={15}
                className="absolute left-3 top-2.5 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search questions or author..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={() => fetchQuestions()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={13} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Questions List */}
          {loading ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <RefreshCw className="h-4 w-4 animate-spin text-indigo-600" />
                <span>Loading questions...</span>
              </div>
            </div>
          ) : questions.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-center">
              <HelpCircle className="h-10 w-10 text-slate-300" />
              <h3 className="mt-3 text-sm font-semibold text-slate-900">
                No customer questions
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Customer questions submitted from product pages will be displayed here for answering.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q) => (
                <div
                  key={q.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      {q.product && (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600">
                          <Package size={13} />
                          <span>{q.product.name}</span>
                        </div>
                      )}
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        Q: {q.question}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                        <span>Asked by {q.authorName}</span>
                        <span>•</span>
                        <span>
                          {new Date(q.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        q.isAnswered
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {q.isAnswered ? "Answered" : "Unanswered"}
                    </span>
                  </div>

                  {/* Existing Answer */}
                  {q.answer && (
                    <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs border border-emerald-100">
                      <span className="font-semibold text-emerald-900">
                        Store Answer:
                      </span>
                      <p className="mt-1 text-emerald-950">{q.answer}</p>
                    </div>
                  )}

                  {/* Answer Input Box */}
                  {answeringQuestionId === q.id && (
                    <div className="mt-3 rounded-lg bg-slate-50 p-3 border border-slate-200">
                      <label className="block text-xs font-semibold text-slate-700">
                        Your Answer (will be public on product page):
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Type accurate product information..."
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        className="mt-1.5 block w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAnsweringQuestionId(null);
                            setAnswerText("");
                          }}
                          className="rounded px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={submittingAnswer || !answerText.trim()}
                          onClick={() => handleAnswerQuestion(q.id)}
                          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                        >
                          <Send size={11} />
                          <span>
                            {submittingAnswer ? "Saving..." : "Publish Answer"}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                    <button
                      onClick={() => {
                        setAnsweringQuestionId(q.id);
                        setAnswerText(q.answer || "");
                      }}
                      className="flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                    >
                      <MessageSquare size={13} />
                      <span>{q.answer ? "Edit Answer" : "Answer"}</span>
                    </button>

                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Delete Question"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
