"use client";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
export type ReviewSummary = {
  total: number;
  averageRating: number;
  verifiedTotal?: number;
  ratingBreakdown: Record<number, number>;
};
const Context = createContext<{
  summary: ReviewSummary | null;
  setSummary: Dispatch<SetStateAction<ReviewSummary | null>>;
} | null>(null);
export function ProductFeedbackProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const value = useMemo(() => ({ summary, setSummary }), [summary]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useProductFeedback = () => useContext(Context);
export function ProductReviewRating() {
  const context = useProductFeedback();
  const summary = context?.summary;
  return (
    <a className="pdp-feedback-link" href="#reviews-section">
      {summary ? (
        summary.total > 0 ? (
          <>
            <span
              className="pdp-rating-stars"
              role="img"
              aria-label={`${summary.averageRating.toFixed(1)} out of 5 stars`}
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <svg
                  key={star}
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill={
                    star <= Math.round(summary.averageRating)
                      ? "currentColor"
                      : "none"
                  }
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1.1 6.2L12 17.3l-5.7 2.9 1.1-6.2-4.5-4.4 6.3-.9Z" />
                </svg>
              ))}
            </span>
            <strong>{summary.averageRating.toFixed(1)}</strong>
            <span>
              {summary.total} {summary.total === 1 ? "review" : "reviews"}
            </span>
          </>
        ) : (
          "No reviews yet"
        )
      ) : (
        "Customer reviews"
      )}
    </a>
  );
}
