"use client";
/* eslint-disable @next/next/no-img-element -- Review attachments can use merchant-approved external URLs. */
import { useEffect, useId, useRef, useState } from "react";
import { shopRequest, type Shopper } from "../lib/shop-client";
import { useProductFeedback } from "./product-feedback";

type Summary = {
  total: number;
  averageRating: number;
  verifiedTotal?: number;
  ratingBreakdown: Record<number, number>;
};
type Review = {
  id: string;
  authorName: string;
  rating: number;
  title?: string;
  content: string;
  photos: string[];
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  adminReply?: string;
  createdAt: string;
};
type Question = {
  id: string;
  authorName: string;
  question: string;
  answer?: string;
  createdAt: string;
};
type ReviewPage = { items: Review[]; totalPages: number; summary: Summary };
const stars = [1, 2, 3, 4, 5];
const date = (value: string) =>
  new Date(value).toLocaleDateString("en-BD", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

function Star({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      className="review-star"
      width="22"
      height="22"
      style={{ width: 22, height: 22, flexShrink: 0 }}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1.1 6.2L12 17.3l-5.7 2.9 1.1-6.2-4.5-4.4 6.3-.9Z" />
    </svg>
  );
}
function Rating({ value }: { value: number }) {
  return (
    <span
      className="review-stars"
      role="img"
      aria-label={`${value} out of 5 stars`}
    >
      {stars.map((star) => (
        <Star key={star} filled={star <= Math.round(value)} />
      ))}
    </span>
  );
}

export function ProductReviewsSection({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const id = useId();
  const setSharedSummary = useProductFeedback()?.setSummary;
  const [tab, setTab] = useState<"reviews" | "questions">("reviews");
  const [data, setData] = useState<ReviewPage | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [page, setPage] = useState(1);
  const [rating, setRating] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [formRating, setFormRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [identity, setIdentity] = useState({ name: "", email: "" });
  const [helpful, setHelpful] = useState<Record<string, boolean>>({});
  const helpfulPending = useRef(new Set<string>());

  useEffect(() => {
    let live = true;
    shopRequest<{ user: Shopper | null }>("me")
      .then(({ user }) => {
        if (live && user)
          setIdentity({
            name: [user.firstName, user.lastName].filter(Boolean).join(" "),
            email: user.email,
          });
      })
      .catch(() => {
        /* Guests can submit under the existing moderation policy. */
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const path =
      tab === "reviews"
        ? `products/${productId}/reviews?page=${page}&limit=5${rating ? `&rating=${rating}` : ""}`
        : `products/${productId}/qa`;
    Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) return null;
        setLoading(true);
        setError("");
        return fetch(`/api/shop/${path}`, {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
          headers: { "X-Storefront-Request": "1" },
        });
      })
      .then(async (response) => {
        if (!response) return;
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            Array.isArray(result.message)
              ? result.message.join(", ")
              : result.message || "Could not load customer feedback.",
          );
        if (controller.signal.aborted) return;
        if (tab === "reviews") { setData(result); setSharedSummary?.(result.summary); }
        else setQuestions(result);
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [productId, page, rating, revision, tab, setSharedSummary]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    if (tab === "reviews" && !formRating) {
      setSubmitError("Choose a rating from 1 to 5 stars.");
      return;
    }
    const fields = new FormData(form);
    const content = String(
      fields.get(tab === "reviews" ? "content" : "question") || "",
    ).trim();
    if (identity.name.trim().length < 2 || content.length < 5) {
      setSubmitError(
        "Use at least 2 characters for your name and 5 characters for your comment.",
      );
      return;
    }
    submitting.current = true;
    setBusy(true);
    setSubmitError("");
    setMessage("");
    try {
      const photos = String(fields.get("photos") || "")
        .split(",")
        .map((url) => url.trim())
        .filter(Boolean);
      if (photos.some((url) => !/^https?:\/\//i.test(url)))
        throw new Error("Photo links must start with http:// or https://.");
      const result = await shopRequest<{ status?: string }>(
        `products/${productId}/${tab === "reviews" ? "reviews" : "qa"}`,
        {
          productId,
          authorName: identity.name.trim(),
          authorEmail: identity.email.trim(),
          ...(tab === "reviews"
            ? {
                rating: formRating,
                title: String(fields.get("title") || "").trim() || undefined,
                content: String(fields.get("content") || "").trim(),
                photos,
              }
            : { question: String(fields.get("question") || "").trim() }),
        },
      );
      setMessage(
        tab === "reviews"
          ? result.status === "APPROVED"
            ? "Thank you! Your review has been published."
            : "Thank you! Your review has been submitted for moderation."
          : "Your question has been submitted. Our team will review it before it appears here.",
      );
      form.reset();
      setFormRating(0);
      setRevision((value) => value + 1);
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : "Could not submit. Please try again.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  async function markHelpful(reviewId: string) {
    if (helpful[reviewId] || helpfulPending.current.has(reviewId)) return;
    helpfulPending.current.add(reviewId);
    try {
      const result = await shopRequest<{ helpfulCount: number }>(
        `reviews/${reviewId}/helpful`,
        {},
      );
      setData((previous) =>
        previous
          ? {
              ...previous,
              items: previous.items.map((review) =>
                review.id === reviewId
                  ? { ...review, helpfulCount: result.helpfulCount }
                  : review,
              ),
            }
          : previous,
      );
      setHelpful((previous) => ({ ...previous, [reviewId]: true }));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not record helpful vote.",
      );
    } finally {
      helpfulPending.current.delete(reviewId);
    }
  }

  return (
    <section
      id="reviews-section"
      className="product-feedback"
      aria-label="Customer reviews and questions"
    >
      <div
        className="feedback-tabs"
        role="group"
        aria-label="Customer feedback"
      >
        <button
          type="button"
          aria-pressed={tab === "reviews"}
          onClick={() => {
            setTab("reviews");
            setMessage("");
            setSubmitError("");
          }}
        >
          Customer Reviews{data ? ` (${data.summary.total})` : ""}
        </button>
        <button
          type="button"
          aria-pressed={tab === "questions"}
          onClick={() => {
            setTab("questions");
            setMessage("");
            setSubmitError("");
          }}
        >
          Questions & Answers
        </button>
      </div>
      {error && (
        <div className="feedback-notice shop-error" role="alert">
          {error}{" "}
          <button
            type="button"
            onClick={() => setRevision((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      )}
      {tab === "reviews" && data && data.summary.total > 0 && (
        <div className="review-summary">
          <div className="review-average">
            <strong>
              {data.summary.averageRating.toFixed(1)} <small>/ 5</small>
            </strong>
            <Rating value={data.summary.averageRating} />
            <p>
              {data.summary.total} customer review
              {data.summary.total === 1 ? "" : "s"}
            </p>
            {typeof data.summary.verifiedTotal === "number" && (
              <span>
                {data.summary.verifiedTotal} verified purchase review
                {data.summary.verifiedTotal === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <div className="review-distribution" aria-label="Rating distribution">
            {[5, 4, 3, 2, 1].map((value) => {
              const count = data.summary.ratingBreakdown[value] || 0;
              const percent = Math.round((count / data.summary.total) * 100);
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={rating === value}
                  aria-label={`Filter ${value} star reviews: ${count}, ${percent}%`}
                  onClick={() => {
                    setRating(rating === value ? 0 : value);
                    setPage(1);
                  }}
                >
                  <span>{value} star</span>
                  <progress
                    max="100"
                    value={percent}
                    aria-label={`${value} star reviews`}
                  />
                  <span>{percent}%</span>
                  <span>({count})</span>
                </button>
              );
            })}
            {rating > 0 && (
              <button
                type="button"
                onClick={() => {
                  setRating(0);
                  setPage(1);
                }}
              >
                Show all ratings
              </button>
            )}
          </div>
        </div>
      )}
      <div className="feedback-body">
        <div className="feedback-list" aria-busy={loading}>
          {loading ? (
            <p role="status">Loading customer feedback…</p>
          ) : (
            !error &&
            (tab === "reviews" ? (
              !data?.items.length ? (
                <p className="feedback-empty">
                  {rating
                    ? "No reviews match this rating."
                    : "No reviews yet. Be the first to share your experience."}
                </p>
              ) : (
                data.items.map((review) => (
                  <article className="review-card" key={review.id}>
                    <div className="review-card-heading">
                      <div>
                        <strong>{review.authorName}</strong>
                        <Rating value={review.rating} />
                      </div>
                      <time dateTime={review.createdAt}>
                        {date(review.createdAt)}
                      </time>
                    </div>
                    {review.isVerifiedPurchase && (
                      <span className="review-verified">
                        ✓ Verified purchase
                      </span>
                    )}
                    {review.title && <h3>{review.title}</h3>}
                    <p>{review.content}</p>
                    {!!review.photos?.length && (
                      <div className="review-photos">
                        {review.photos
                          .filter(
                            (url) =>
                              /^https?:\/\//i.test(url) ||
                              /^\/(?!\/)/.test(url),
                          )
                          .map((url, index) => (
                            <a
                              key={index}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <img
                                src={url}
                                alt={`Photo ${index + 1} from ${review.authorName}'s review of ${productName}`}
                                loading="lazy"
                                width="96"
                                height="96"
                              />
                            </a>
                          ))}
                      </div>
                    )}
                    {review.adminReply && (
                      <div className="review-reply">
                        <strong>Response from DS Mart</strong>
                        <p>{review.adminReply}</p>
                      </div>
                    )}
                    <button
                      type="button"
                      className="feedback-helpful"
                      disabled={helpful[review.id]}
                      onClick={() => void markHelpful(review.id)}
                    >
                      {helpful[review.id] ? "Marked helpful" : "Helpful"} (
                      {review.helpfulCount})
                    </button>
                  </article>
                ))
              )
            ) : !questions.length ? (
              <p className="feedback-empty">
                No answered questions yet. Ask us about this product.
              </p>
            ) : (
              questions.map((question) => (
                <article key={question.id} className="review-card">
                  <div className="review-card-heading">
                    <strong>{question.authorName}</strong>
                    <time dateTime={question.createdAt}>
                      {date(question.createdAt)}
                    </time>
                  </div>
                  <h3>{question.question}</h3>
                  {question.answer && (
                    <div className="review-reply">
                      <strong>Answer from DS Mart</strong>
                      <p>{question.answer}</p>
                    </div>
                  )}
                </article>
              ))
            ))
          )}
          {tab === "reviews" && data && data.totalPages > 1 && (
            <nav className="review-pagination" aria-label="Review pages">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span>
                Page {page} of {data.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= data.totalPages || loading}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </div>
        <form
          key={tab}
          onSubmit={submit}
          className="feedback-form"
          aria-busy={busy}
        >
          <h3>{tab === "reviews" ? "Write a Review" : "Ask a Question"}</h3>
          <p>
            Share your experience with {productName}. Your email stays private.
          </p>
          <fieldset disabled={busy}>
            {tab === "reviews" && (
              <fieldset className="review-rating-picker">
                <legend>Your rating *</legend>
                <div>
                  {stars.map((value) => (
                    <label
                      key={value}
                      onMouseEnter={() => setHoverRating(value)}
                      onMouseLeave={() => setHoverRating(0)}
                    >
                      <input
                        type="radio"
                        name="rating"
                        value={value}
                        checked={formRating === value}
                        onChange={() => setFormRating(value)}
                        required
                        aria-label={`${value} star${value > 1 ? "s" : ""}`}
                      />
                      <Star filled={value <= (hoverRating || formRating)} />
                    </label>
                  ))}
                  <span>
                    {formRating ? `${formRating} / 5` : "Select a rating"}
                  </span>
                </div>
              </fieldset>
            )}
            <label htmlFor={`${id}-name`}>
              Display name *
              <input
                id={`${id}-name`}
                name="authorName"
                autoComplete="name"
                minLength={2}
                maxLength={100}
                required
                value={identity.name}
                onChange={(event) =>
                  setIdentity({ ...identity, name: event.target.value })
                }
              />
            </label>
            <label htmlFor={`${id}-email`}>
              Email address *
              <input
                id={`${id}-email`}
                name="authorEmail"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                value={identity.email}
                onChange={(event) =>
                  setIdentity({ ...identity, email: event.target.value })
                }
              />
            </label>
            {tab === "reviews" && (
              <label htmlFor={`${id}-title`}>
                Review title (optional)
                <input id={`${id}-title`} name="title" maxLength={150} />
              </label>
            )}
            <label htmlFor={`${id}-content`}>
              {tab === "reviews" ? "Your review" : "Your question"} *
              <textarea
                id={`${id}-content`}
                name={tab === "reviews" ? "content" : "question"}
                rows={4}
                minLength={5}
                maxLength={tab === "reviews" ? 2000 : 1000}
                required
              />
            </label>
            {tab === "reviews" && (
              <details>
                <summary>Add photo links (optional)</summary>
                <label htmlFor={`${id}-photos`}>
                  Photo URLs, separated by commas
                  <input
                    id={`${id}-photos`}
                    name="photos"
                    placeholder="https://…"
                  />
                </label>
              </details>
            )}
            <p className="feedback-policy">
              Submissions follow our moderation policy. Verified purchase labels
              are assigned by the store after checking purchase records.
            </p>
            <button className="primary-button" type="submit">
              {busy
                ? "Submitting…"
                : tab === "reviews"
                  ? "Submit Review"
                  : "Submit Question"}
            </button>
          </fieldset>
          {submitError && (
            <p role="alert" className="shop-error">
              {submitError}
            </p>
          )}
          {message && (
            <p role="status" className="shop-success">
              {message}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
