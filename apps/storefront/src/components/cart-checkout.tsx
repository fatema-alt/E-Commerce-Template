"use client";
/* eslint-disable @next/next/no-img-element -- Cart thumbnails use validated public catalog media. */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart, repairSimpleCart, type CartLine } from "../lib/cart";
import type { Product } from "../lib/storefront";
import {
  money,
  shopRequest,
  type Order,
  type Payments,
  type Quote,
  type Shopper,
} from "../lib/shop-client";
const pending = new Map<string, Promise<Quote>>();
async function repairObsoleteVariants(lines: CartLine[]) {
  let repaired = false;
  const products = [
    ...new Map(
      lines
        .filter((line) => line.variantId)
        .map((line) => [line.productId, line]),
    ).values(),
  ];
  for (const line of products) {
    const response = await fetch(
      `/api/cart/products/${encodeURIComponent(line.slug)}`,
      { cache: "no-store" },
    );
    if (!response.ok) continue;
    const { product } = (await response.json()) as { product: Product | null };
    if (product?.id === line.productId)
      repaired = repairSimpleCart(product) || repaired;
  }
  return repaired;
}
function requestQuote(serialized: string) {
  let promise = pending.get(serialized);
  if (!promise) {
    promise = shopRequest<Quote>("quote", {
      items: JSON.parse(serialized),
    }).finally(() => pending.delete(serialized));
    pending.set(serialized, promise);
  }
  return promise;
}
export function CartCheckout({ checkout = false }: { checkout?: boolean }) {
  const cart = useCart();
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quotedItems, setQuotedItems] = useState("");
  const [error, setError] = useState("");
  const [repairNotice, setRepairNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(0);
  const [payments, setPayments] = useState<Payments | null>(null);
  const [paymentMethod, setPayment] = useState("COD");
  const [user, setUser] = useState<Shopper | null>(null);
  const [placed, setPlaced] = useState("");
  const attempt = useRef({ fingerprint: "", key: "" });
  const serialized = JSON.stringify(
    cart.lines.map(({ productId, variantId, quantity }) => ({
      productId,
      ...(variantId ? { variantId } : {}),
      quantity,
    })),
  );
  useEffect(() => {
    let live = true;
    if (serialized !== "[]")
      requestQuote(serialized)
        .then((result) => {
          if (live) {
            setQuote(result);
            setQuotedItems(serialized);
            setError("");
          }
        })
        .catch(async (e) => {
          if (live && e.message === "Choose an available product variant") {
            try {
              if (await repairObsoleteVariants(cart.lines)) {
                setRepairNotice(
                  "Your cart was updated to match the current product options. Please review the refreshed total.",
                );
                return;
              }
            } catch {
              /* Preserve the actionable quote error if reconciliation fails. */
            }
          }
          if (live) {
            setQuote(null);
            setError(e.message);
          }
        });
    return () => {
      live = false;
    };
  }, [serialized, review, cart.lines]);
  useEffect(() => {
    let live = true;
    Promise.all([
      shopRequest<Payments>("payment-methods"),
      shopRequest<{ user: Shopper | null }>("me"),
    ])
      .then(([methods, me]) => {
        if (live) {
          setPayments(methods);
          setUser(me.user);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  const validQuote = quote && quotedItems === serialized;
  if (placed)
    return (
      <main id="main" className="container main-content">
        <h1>Thank you for your order</h1>
        <Link className="primary-button" href={`/orders/${placed}`}>
          View order confirmation
        </Link>
      </main>
    );
  return (
    <main id="main" className="container main-content">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link> / <Link href="/cart">Cart</Link>
        {checkout && " / Checkout"}
      </nav>
      <h1>{checkout ? "Checkout" : "Your cart"}</h1>
      {repairNotice && (
        <p className="shop-success" role="status">
          {repairNotice}
        </p>
      )}
      {error && (
        <div role="alert" className="shop-error">
          {error}
          <button
            className="secondary-button"
            onClick={() => setReview((v) => v + 1)}
          >
            Refresh prices and availability
          </button>
        </div>
      )}
      {!cart.lines.length ? (
        <div className="empty-content">
          <h2>Your cart is empty</h2>
          <p>Explore the catalog and find something you love.</p>
          <Link className="primary-button" href="/shop">
            Continue shopping
          </Link>
        </div>
      ) : (
        <div className="checkout-grid">
          <section className="shop-panel">
            <h2>{checkout ? "Review your items" : "Cart items"}</h2>
            {cart.lines.map((line) => (
              <article
                className="cart-line"
                key={`${line.productId}:${line.variantId || ""}`}
              >
                {typeof line.imageUrl === "string" &&
                  /^https?:\/\//.test(line.imageUrl) && (
                    <img
                      className="cart-thumbnail"
                      src={line.imageUrl}
                      alt=""
                    />
                  )}
                <div>
                  <Link
                    href={`/product/${encodeURIComponent(line.slug)}`}
                    className="product-name"
                  >
                    {line.name}
                  </Link>
                  {line.variantName && (
                    <p className="muted small">{line.variantName}</p>
                  )}
                  {error === "Choose an available product variant" && (
                    <Link
                      className="text-button"
                      href={`/product/${encodeURIComponent(line.slug)}`}
                    >
                      Review product options
                    </Link>
                  )}
                  <p>
                    {validQuote
                      ? money(
                          quote.items.find(
                            (i) =>
                              i.productId === line.productId &&
                              i.variantId === line.variantId,
                          )?.unitPrice || line.price,
                        )
                      : `${money(line.price)} estimated`}
                  </p>
                </div>
                <label>
                  Quantity
                  <input
                    aria-label={`Quantity for ${line.name}`}
                    type="number"
                    min={1}
                    max={10000}
                    value={line.quantity}
                    disabled={busy}
                    onChange={(e) => {
                      try {
                        cart.update(line, Number(e.target.value));
                      } catch {
                        setError("Cart storage is unavailable.");
                      }
                    }}
                  />
                </label>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    try {
                      cart.remove(line);
                    } catch {
                      setError("Unable to update cart storage.");
                    }
                  }}
                >
                  Remove
                </button>
              </article>
            ))}
            <Link href="/shop">← Continue shopping</Link>
          </section>
          <aside className="shop-panel order-summary">
            <h2>Order summary</h2>
            {validQuote ? (
              <>
                <dl>
                  <div>
                    <dt>Subtotal</dt>
                    <dd>{money(quote.subtotal)}</dd>
                  </div>
                  <div>
                    <dt>Delivery</dt>
                    <dd>{money(quote.shipping)}</dd>
                  </div>
                  <div>
                    <dt>Additional tax</dt>
                    <dd>{money(quote.tax)}</dd>
                  </div>
                  <div className="summary-total">
                    <dt>Total</dt>
                    <dd>{money(quote.total)}</dd>
                  </div>
                </dl>
                <p className="muted small">
                  Delivery within Bangladesh. Your final total is verified again
                  when placing the order.
                </p>
                {!checkout && (
                  <Link className="primary-button" href="/checkout">
                    Proceed to checkout →
                  </Link>
                )}
              </>
            ) : (
              <p role="status">
                {error
                  ? "Review the availability message above."
                  : "Checking current prices and stock…"}
              </p>
            )}
          </aside>
          {checkout && (
            <form
              className="shop-panel checkout-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!validQuote || busy) return;
                const data = new FormData(e.currentTarget);
                const value = (key: string) =>
                  String(data.get(key) || "").trim();
                const payload = {
                  items: JSON.parse(serialized),
                  customerName: value("name"),
                  ...(value("email") ? { customerEmail: value("email") } : {}),
                  customerPhone: value("phone"),
                  paymentMethod,
                  shippingAddress: {
                    recipientName: value("name"),
                    phone: value("phone"),
                    line1: value("address"),
                    city: value("city"),
                    ...(value("district")
                      ? { district: value("district") }
                      : {}),
                    ...(value("postalCode")
                      ? { postalCode: value("postalCode") }
                      : {}),
                  },
                  ...(value("note") ? { customerNote: value("note") } : {}),
                };
                const fingerprint = JSON.stringify(payload);
                if (attempt.current.fingerprint !== fingerprint)
                  attempt.current = { fingerprint, key: crypto.randomUUID() };
                setBusy(true);
                setError("");
                try {
                  const order = await shopRequest<Order>(
                    "orders",
                    { ...payload, quoteToken: quote.quoteToken },
                    attempt.current.key,
                  );
                  setPlaced(order.id);
                  cart.clear();

                  if (
                    paymentMethod === "BKASH" ||
                    paymentMethod === "SSLCOMMERZ"
                  ) {
                    try {
                      const initRes = await shopRequest<{
                        redirectUrl: string;
                        provider: string;
                        transactionReference: string;
                      }>("payments/initiate", {
                        orderId: order.id,
                        method: paymentMethod,
                      });
                      if (initRes.redirectUrl) {
                        window.location.href = initRes.redirectUrl;
                        return;
                      }
                    } catch (payErr) {
                      router.push(
                        `/orders/${order.id}?payment=initiate_failed&reason=${encodeURIComponent(
                          (payErr as Error).message || "Initiation failed",
                        )}`,
                      );
                      return;
                    }
                  }

                  router.push(`/orders/${order.id}`);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h2>Delivery information</h2>
              {!user && (
                <p>
                  Checkout as a guest, or <Link href="/account">sign in</Link>{" "}
                  to keep orders in your account.
                </p>
              )}
              <fieldset disabled={busy}>
                <div className="form-grid">
                  <label>
                    Full name
                    <input
                      name="name"
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={120}
                      defaultValue={user?.firstName}
                    />
                  </label>
                  <label>
                    Phone
                    <input
                      name="phone"
                      autoComplete="tel"
                      type="tel"
                      required
                      minLength={6}
                      maxLength={32}
                      defaultValue={user?.phone || ""}
                    />
                  </label>
                  <label>
                    Email (optional)
                    <input
                      name="email"
                      autoComplete="email"
                      type="email"
                      maxLength={254}
                      defaultValue={user?.email}
                    />
                  </label>
                  <label>
                    City
                    <input
                      name="city"
                      autoComplete="address-level2"
                      required
                      minLength={2}
                      maxLength={120}
                    />
                  </label>
                  <label className="full-field">
                    Street address
                    <input
                      name="address"
                      autoComplete="street-address"
                      required
                      minLength={3}
                      maxLength={240}
                    />
                  </label>
                  <label>
                    District (optional)
                    <input
                      name="district"
                      autoComplete="address-level1"
                      maxLength={120}
                    />
                  </label>
                  <label>
                    Postal code (optional)
                    <input
                      name="postalCode"
                      autoComplete="postal-code"
                      maxLength={20}
                    />
                  </label>
                  <label className="full-field">
                    Order note (optional)
                    <textarea name="note" rows={3} maxLength={2000} />
                  </label>
                </div>
                <h2>Payment</h2>
                <div className="payment-options">
                  {payments?.methods.map((method) => (
                    <label
                      key={method.id}
                      className={!method.enabled ? "payment-disabled" : ""}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method.id}
                        checked={paymentMethod === method.id}
                        disabled={!method.enabled}
                        onChange={() => setPayment(method.id)}
                      />
                      <span>
                        {method.label}
                        {!method.enabled && (
                          <small>Currently unavailable</small>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
                {paymentMethod === "BANK_TRANSFER" && payments?.bank && (
                  <div className="bank-details">
                    <p>
                      {payments.bank.name} — {payments.bank.branch}
                    </p>
                    <p>
                      {payments.bank.accountName} ·{" "}
                      {payments.bank.accountNumber}
                    </p>
                    <p>
                      Use your order number as the transfer reference. Payment
                      remains pending until the store verifies the transfer.
                    </p>
                  </div>
                )}
                <label className="consent-row">
                  <input type="checkbox" required />I confirm my delivery
                  details and agree to place this order.
                </label>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={!validQuote || busy || !payments}
                >
                  {busy
                    ? "Processing your order…"
                    : paymentMethod === "BKASH"
                      ? `Pay with bKash${validQuote ? " · " + money(quote.total) : ""}`
                      : paymentMethod === "SSLCOMMERZ"
                        ? `Pay with SSLCommerz${validQuote ? " · " + money(quote.total) : ""}`
                        : `Place order${validQuote ? " · " + money(quote.total) : ""}`}
                </button>
              </fieldset>
            </form>
          )}
        </div>
      )}
    </main>
  );
}
