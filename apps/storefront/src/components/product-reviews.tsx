"use client";

import { useCallback, useEffect, useState } from "react";

function StarIcon({
  className = "h-4 w-4",
  filled = false,
}: {
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function ShieldCheckIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
    </svg>
  );
}

function ThumbsUpIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 10v12" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"
      />
    </svg>
  );
}

function CornerDownRightIcon({
  className = "h-3.5 w-3.5",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <polyline points="15 10 20 15 15 20" />
      <path d="M4 4v7a4 4 0 0 0 4 4h12" />
    </svg>
  );
}

function XIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function PlusIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5v14" />
    </svg>
  );
}

function HelpCircleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="10" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"
      />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  );
}

interface ReviewSummary {
  total: number;
  averageRating: number;
  ratingBreakdown: Record<number, number>;
}

interface Review {
  id: string;
  authorName: string;
  rating: number;
  title?: string | null;
  content: string;
  photos: string[];
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  adminReply?: string | null;
  adminRepliedAt?: string | null;
  createdAt: string;
}

interface Question {
  id: string;
  authorName: string;
  question: string;
  answer?: string | null;
  answeredAt?: string | null;
  answeredBy?: string | null;
  createdAt: string;
}

export function ProductReviewsSection({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const [activeTab, setActiveTab] = useState<"REVIEWS" | "QA">("REVIEWS");
  const [summary, setSummary] = useState<ReviewSummary>({
    total: 0,
    averageRating: 0,
    ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });
  const [reviews, setReviews] = useState<Review[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [loadingQA, setLoadingQA] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);

  // Review Form Modal
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [formRating, setFormRating] = useState(5);
  const [formHoverRating, setFormHoverRating] = useState(0);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhotos, setFormPhotos] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Question Form Modal
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [questionName, setQuestionName] = useState("");
  const [questionEmail, setQuestionEmail] = useState("");
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [questionMessage, setQuestionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Helpful click tracking
  const [helpfulClicked, setHelpfulClicked] = useState<Record<string, boolean>>(
    {},
  );

  const fetchReviews = useCallback(async () => {
    try {
      setLoadingReviews(true);
      const url = new URL(
        `/api/shop/products/${productId}/reviews`,
        window.location.origin,
      );
      if (selectedRating)
        url.searchParams.set("rating", selectedRating.toString());
      url.searchParams.set("limit", "20");

      const res = await fetch(url.toString(), {
        headers: { "x-storefront-request": "1" },
      });
      if (res.ok) {
        const data = await res.json();
        setReviews(data.items || []);
        if (data.summary) {
          setSummary(data.summary);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingReviews(false);
    }
  }, [productId, selectedRating]);

  const fetchQuestions = useCallback(async () => {
    try {
      setLoadingQA(true);
      const res = await fetch(`/api/shop/products/${productId}/qa`, {
        headers: { "x-storefront-request": "1" },
      });
      if (res.ok) {
        const data = await res.json();
        setQuestions(data || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingQA(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    if (activeTab === "QA") {
      fetchQuestions();
    }
  }, [activeTab, fetchQuestions]);

  const handleMarkHelpful = async (reviewId: string) => {
    if (helpfulClicked[reviewId]) return;
    setHelpfulClicked((p) => ({ ...p, [reviewId]: true }));
    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId ? { ...r, helpfulCount: r.helpfulCount + 1 } : r,
      ),
    );
    try {
      await fetch(`/api/shop/reviews/${reviewId}/helpful`, {
        method: "POST",
        headers: {
          "x-storefront-request": "1",
          "Content-Type": "application/json",
        },
      });
    } catch {
      // non-critical
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim() || !formContent.trim()) {
      setReviewMessage({
        type: "error",
        text: "Please provide your name, email, and review comment.",
      });
      return;
    }

    try {
      setSubmittingReview(true);
      setReviewMessage(null);

      const photosArray = formPhotos
        .split(",")
        .map((p) => p.trim())
        .filter((p) => Boolean(p) && p.startsWith("http"));

      const res = await fetch(`/api/shop/products/${productId}/reviews`, {
        method: "POST",
        headers: {
          "x-storefront-request": "1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rating: formRating,
          title: formTitle.trim() || undefined,
          content: formContent.trim(),
          authorName: formName.trim(),
          authorEmail: formEmail.trim(),
          photos: photosArray,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to submit review.");
      }

      setReviewMessage({
        type: "success",
        text: "Thank you! Your review has been submitted.",
      });

      // Reset form
      setFormTitle("");
      setFormContent("");
      setFormPhotos("");
      setTimeout(() => {
        setIsReviewModalOpen(false);
        setReviewMessage(null);
        fetchReviews();
      }, 2000);
    } catch (err: any) {
      setReviewMessage({
        type: "error",
        text: err.message || "Something went wrong.",
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionName.trim() || !questionEmail.trim() || !questionText.trim()) {
      setQuestionMessage({
        type: "error",
        text: "Please complete all fields.",
      });
      return;
    }

    try {
      setSubmittingQuestion(true);
      setQuestionMessage(null);

      const res = await fetch(`/api/shop/products/${productId}/qa`, {
        method: "POST",
        headers: {
          "x-storefront-request": "1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: questionText.trim(),
          authorName: questionName.trim(),
          authorEmail: questionEmail.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to submit question.");
      }

      setQuestionMessage({
        type: "success",
        text: "Question submitted! Our team will answer it shortly.",
      });

      setQuestionText("");
      setTimeout(() => {
        setIsQuestionModalOpen(false);
        setQuestionMessage(null);
        fetchQuestions();
      }, 2000);
    } catch (err: any) {
      setQuestionMessage({
        type: "error",
        text: err.message || "Could not submit question.",
      });
    } finally {
      setSubmittingQuestion(false);
    }
  };

  return (
    <section
      id="reviews-section"
      className="mt-12 border-t border-slate-200 pt-10"
      aria-label="Customer Reviews and Q&A"
    >
      {/* Tab Switcher & Action Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab("REVIEWS")}
            className={`pb-3 text-base font-bold transition-colors border-b-2 -mb-[18px] ${
              activeTab === "REVIEWS"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Customer Reviews ({summary.total})
          </button>
          <button
            onClick={() => setActiveTab("QA")}
            className={`pb-3 text-base font-bold transition-colors border-b-2 -mb-[18px] ${
              activeTab === "QA"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Questions & Answers ({questions.length})
          </button>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === "REVIEWS" ? (
            <button
              onClick={() => setIsReviewModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              <span>Write a Review</span>
            </button>
          ) : (
            <button
              onClick={() => setIsQuestionModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              <span>Ask a Question</span>
            </button>
          )}
        </div>
      </div>

      {/* REVIEWS TAB */}
      {activeTab === "REVIEWS" && (
        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-12">
          {/* Left Column: Rating Breakdown Card */}
          <div className="lg:col-span-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900">
                Overall Customer Rating
              </h3>

              <div className="mt-4 flex items-baseline gap-3">
                <span className="text-4xl font-extrabold text-slate-900">
                  {summary.averageRating.toFixed(1)}
                </span>
                <div>
                  <div className="flex text-amber-400">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <StarIcon
                        key={s}
                        className="h-4 w-4"
                        filled={s <= Math.round(summary.averageRating)}
                      />
                    ))}
                  </div>
                  <span className="mt-1 block text-xs text-slate-500">
                    Based on {summary.total} verified reviews
                  </span>
                </div>
              </div>

              {/* Star Rating Breakdown Bars */}
              <div className="mt-6 space-y-2">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const count = summary.ratingBreakdown[rating] || 0;
                  const percent =
                    summary.total > 0 ? (count / summary.total) * 100 : 0;
                  const isSelected = selectedRating === rating;

                  return (
                    <button
                      key={rating}
                      onClick={() =>
                        setSelectedRating(isSelected ? null : rating)
                      }
                      className={`flex w-full items-center gap-3 rounded-lg px-2 py-1 text-xs transition hover:bg-slate-50 ${
                        isSelected ? "bg-indigo-50 font-bold" : "text-slate-600"
                      }`}
                    >
                      <span className="flex w-12 items-center gap-1">
                        {rating}{" "}
                        <StarIcon
                          className="h-3 w-3 text-amber-400"
                          filled={true}
                        />
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full bg-amber-400 transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-slate-400">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedRating && (
                <button
                  onClick={() => setSelectedRating(null)}
                  className="mt-4 flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 py-1.5 text-xs text-indigo-600 hover:bg-slate-50"
                >
                  <XIcon className="h-3.5 w-3.5" />
                  <span>Show all ratings</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Reviews List */}
          <div className="lg:col-span-8">
            {loadingReviews ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-32 animate-pulse rounded-xl border border-slate-100 bg-slate-50 p-6"
                  />
                ))}
              </div>
            ) : reviews.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                <StarIcon className="mx-auto h-10 w-10 text-slate-300" />
                <h4 className="mt-3 text-sm font-semibold text-slate-900">
                  {selectedRating
                    ? `No ${selectedRating}-star reviews yet`
                    : "No reviews yet for this product"}
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  Be the first to share your thoughts with fellow shoppers!
                </p>
                <button
                  onClick={() => setIsReviewModalOpen(true)}
                  className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  Write the First Review
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="flex text-amber-400">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <StarIcon
                              key={s}
                              className="h-3.5 w-3.5"
                              filled={s <= rev.rating}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-bold text-slate-900">
                          {rev.authorName}
                        </span>
                        {rev.isVerifiedPurchase && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                            <ShieldCheckIcon className="h-3 w-3" />
                            Verified Buyer
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(rev.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>

                    {rev.title && (
                      <h4 className="mt-3 text-sm font-bold text-slate-900">
                        {rev.title}
                      </h4>
                    )}

                    <p className="mt-1 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {rev.content}
                    </p>

                    {/* Customer Photos */}
                    {rev.photos && rev.photos.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {rev.photos.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="h-14 w-14 overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                          >
                            <img
                              src={url}
                              alt="Review attachment"
                              className="h-full w-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Official Store Reply */}
                    {rev.adminReply && (
                      <div className="mt-4 rounded-lg bg-indigo-50/60 p-3.5 border border-indigo-100 text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-indigo-900">
                          <CornerDownRightIcon className="h-3 w-3 text-indigo-600" />
                          <span>Response from DS Mart</span>
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

                    {/* Helpful Button */}
                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                      <button
                        onClick={() => handleMarkHelpful(rev.id)}
                        disabled={helpfulClicked[rev.id]}
                        className={`inline-flex items-center gap-1.5 text-xs transition ${
                          helpfulClicked[rev.id]
                            ? "text-indigo-600 font-bold"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        <ThumbsUpIcon className="h-3 w-3" />
                        <span>Helpful ({rev.helpfulCount})</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Q&A TAB */}
      {activeTab === "QA" && (
        <div className="mt-8 space-y-4">
          {loadingQA ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-xl border border-slate-100 bg-slate-50 p-6"
                />
              ))}
            </div>
          ) : questions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
              <HelpCircleIcon className="mx-auto h-10 w-10 text-slate-300" />
              <h4 className="mt-3 text-sm font-semibold text-slate-900">
                Have questions about {productName}?
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                Ask our expert product support team anything about sizing, specifications, or warranty.
              </p>
              <button
                onClick={() => setIsQuestionModalOpen(true)}
                className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Ask a Question
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q) => (
                <div
                  key={q.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        <span className="font-bold text-indigo-600">Q: </span>
                        {q.question}
                      </p>
                      <span className="mt-1 block text-[11px] text-slate-400">
                        Asked by {q.authorName} •{" "}
                        {new Date(q.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  {q.answer && (
                    <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs border border-slate-200 text-slate-800">
                      <span className="font-bold text-slate-900">
                        Answer from DS Mart:{" "}
                      </span>
                      <p className="mt-1 leading-relaxed">{q.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* WRITE A REVIEW MODAL */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <button
              onClick={() => setIsReviewModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <XIcon className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900">
              Write a Review
            </h3>
            <p className="text-xs text-slate-500">
              Share your genuine experience with {productName}.
            </p>

            {reviewMessage && (
              <div
                className={`mt-4 rounded-lg p-3 text-xs ${
                  reviewMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {reviewMessage.text}
              </div>
            )}

            <form onSubmit={handleSubmitReview} className="mt-4 space-y-4">
              {/* Star Rating Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Overall Rating *
                </label>
                <div className="mt-1 flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setFormRating(star)}
                      onMouseEnter={() => setFormHoverRating(star)}
                      onMouseLeave={() => setFormHoverRating(0)}
                      className="p-1 focus:outline-none"
                    >
                      <StarIcon
                        className={`h-6 w-6 ${
                          star <= (formHoverRating || formRating)
                            ? "text-amber-400"
                            : "text-slate-200"
                        } transition-colors`}
                        filled={star <= (formHoverRating || formRating)}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-xs font-semibold text-slate-600">
                    {formHoverRating || formRating} out of 5 stars
                  </span>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Review Headline
                </label>
                <input
                  type="text"
                  placeholder="e.g. Excellent quality, true to size!"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Detailed Experience *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="What did you like or dislike? How was the fit, material, and packaging?"
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Name & Email */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tanvir Hasan"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="For order verification"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Photos URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Photo URLs (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Paste image link (comma-separated for multiple)"
                  value={formPhotos}
                  onChange={(e) => setFormPhotos(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-[11px]"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submittingReview ? "Submitting..." : "Submit Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASK A QUESTION MODAL */}
      {isQuestionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <button
              onClick={() => setIsQuestionModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <XIcon className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900">
              Ask a Question
            </h3>
            <p className="text-xs text-slate-500">
              Get answers about {productName} directly from our store team.
            </p>

            {questionMessage && (
              <div
                className={`mt-4 rounded-lg p-3 text-xs ${
                  questionMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {questionMessage.text}
              </div>
            )}

            <form onSubmit={handleSubmitQuestion} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Your Question *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Is this size regular fit or slim fit? Does it shrink after washing?"
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Fahim"
                    value={questionName}
                    onChange={(e) => setQuestionName(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="We'll notify you when answered"
                    value={questionEmail}
                    onChange={(e) => setQuestionEmail(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsQuestionModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingQuestion}
                  className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submittingQuestion ? "Submitting..." : "Submit Question"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
