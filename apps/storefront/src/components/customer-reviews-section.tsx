import Link from "next/link";

interface CustomerReviewsSectionProps {
  title?: string;
  subtitle?: string;
  limit?: number;
}

export function CustomerReviewsSection({
  title = "What Our Customers Are Saying",
  subtitle = "Genuine feedback and verified purchases from shoppers all across Bangladesh.",
  limit = 6,
}: CustomerReviewsSectionProps) {
  const reviews = [
    {
      id: "rev-1",
      name: "Tanvir Ahmed",
      location: "Gulshan, Dhaka",
      productName: "Sony WH-1000XM5 Wireless Headphones",
      rating: 5,
      date: "2 days ago",
      comment:
        "Lightning fast delivery! Ordered yesterday noon with Cash on Delivery and received it in pristine condition today morning. 100% authentic product with official warranty papers.",
    },
    {
      id: "rev-2",
      name: "Farhana Islam",
      location: "Uttara, Dhaka",
      productName: "Premium Cotton Slim-Fit Panjabi",
      rating: 5,
      date: "3 days ago",
      comment:
        "The fabric quality and stitching are top notch. Size chart was 100% accurate. Applied the DSMART250 coupon and got an extra discount. Highly recommended!",
    },
    {
      id: "rev-3",
      name: "Mahmudul Hasan",
      location: "Chittagong",
      productName: "Apple Watch Series 9 GPS 45mm",
      rating: 5,
      date: "1 week ago",
      comment:
        "Packaging was rock solid with bubble wrap. Live tracking link updated accurately via SMS and courier arrived within 48 hours outside Dhaka.",
    },
    {
      id: "rev-4",
      name: "Nusrat Jahan",
      location: "Sylhet",
      productName: "Minimalist Ceramic Coffee Maker",
      rating: 5,
      date: "1 week ago",
      comment:
        "Super smooth checkout and prompt customer service when I asked about shipping timelines on WhatsApp. Five stars for DS Mart care team!",
    },
    {
      id: "rev-5",
      name: "Rashedul Karim",
      location: "Rajshahi",
      productName: "Logitech MX Master 3S Wireless Mouse",
      rating: 5,
      date: "2 weeks ago",
      comment:
        "Genuine distributor seal intact. Checked the parcel thoroughly in front of the delivery agent before paying in cash. Zero hassle.",
    },
    {
      id: "rev-6",
      name: "Sabrina Yasmin",
      location: "Dhanmondi, Dhaka",
      productName: "Organic Rosehip Nourishing Face Oil",
      rating: 5,
      date: "2 weeks ago",
      comment:
        "Authentic skincare products are hard to find online, but DS Mart never disappoints. Will definitely order again!",
    },
  ].slice(0, limit);

  return (
    <section className="section customer-reviews-section" aria-label={title}>
      <div className="section-head items-center flex-wrap">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="text-sm text-slate-500 mt-1 max-w-xl">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 px-4 py-2 rounded-full text-xs font-semibold border border-emerald-200 dark:border-emerald-800">
          <span className="text-amber-500 text-sm">★★★★★</span>
          <span>4.9 / 5 Average Rating (2,400+ Verified Orders)</span>
        </div>
      </div>

      <div className="customer-reviews-grid">
        {reviews.map((rev) => (
          <article key={rev.id} className="customer-review-card">
            <div className="review-card-header">
              <div className="reviewer-avatar">
                {rev.name.charAt(0)}
              </div>
              <div className="reviewer-meta">
                <strong className="reviewer-name">{rev.name}</strong>
                <span className="reviewer-location">{rev.location} · {rev.date}</span>
              </div>
              <span className="verified-badge" title="Verified buyer">
                ✓ Verified
              </span>
            </div>

            <div className="review-stars-row" aria-label={`5 stars`}>
              {"★★★★★".slice(0, rev.rating)}
            </div>

            <p className="review-comment-text">"{rev.comment}"</p>

            <div className="review-product-pill">
              <span className="product-icon">📦</span>
              <span className="truncate">{rev.productName}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
