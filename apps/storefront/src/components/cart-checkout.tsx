"use client";
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
import { SectionCard, PriceSummary, ProductThumbnail } from "./shopping-ui";
import {
  getTrackingItemId,
  trackAddToCart,
  trackBeginCheckout,
  calculatePurchaseValue,
  type TrackingEcommerceItem,
} from "../lib/gtm";

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

function requestQuote(
  serialized: string,
  couponCode?: string,
  city?: string,
  district?: string,
) {
  const cacheKey =
    serialized +
    (couponCode ? `::${couponCode.trim().toUpperCase()}` : "") +
    (city ? `::city:${city.trim().toLowerCase()}` : "") +
    (district ? `::dist:${district.trim().toLowerCase()}` : "");
  let promise = pending.get(cacheKey);
  if (!promise) {
    promise = shopRequest<Quote>("quote", {
      items: JSON.parse(serialized),
      ...(couponCode ? { couponCode: couponCode.trim().toUpperCase() } : {}),
      ...(city ? { city: city.trim() } : {}),
      ...(district ? { district: district.trim() } : {}),
    }).finally(() => pending.delete(cacheKey));
    pending.set(cacheKey, promise);
  }
  return promise;
}

export function CartCheckout({ checkout = false }: { checkout?: boolean }) {
  const cart = useCart();
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quotedKey, setQuotedKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [review, setReview] = useState(0);
  const [payments, setPayments] = useState<Payments | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [paymentMethod, setPayment] = useState("");
  const [user, setUser] = useState<Shopper | null>(null);
  const [placed, setPlaced] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [couponError, setCouponError] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const mutationLock = useRef(false);
  const submissionLock = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const draftFields = [
    "name",
    "phone",
    "email",
    "address",
    "city",
    "district",
    "postalCode",
    "note",
  ];
  const attempt = useRef({ fingerprint: "", key: "" });
  const serialized = JSON.stringify(
    cart.lines.map(({ productId, variantId, quantity }) => ({
      productId,
      ...(variantId ? { variantId } : {}),
      quantity,
    })),
  );
  // Address hints for shipping estimate (checkout page only).
  const [addrCity, setAddrCity] = useState("");
  const [addrDistrict, setAddrDistrict] = useState("");
  const currentKey =
    serialized +
    "::" +
    appliedCoupon +
    (checkout ? `::city:${addrCity}::dist:${addrDistrict}` : "");
  const validQuote = quote && quotedKey === currentKey;
  const locked = busy || updating || couponBusy;

  useEffect(() => {
    if (!checkout) return;
    try {
      const draft = JSON.parse(
        sessionStorage.getItem("ds-checkout-draft") || "{}",
      );
      for (const name of [
        "name",
        "phone",
        "email",
        "address",
        "city",
        "district",
        "postalCode",
        "note",
      ]) {
        const field = formRef.current?.elements.namedItem(name);
        if (
          (field instanceof HTMLInputElement ||
            field instanceof HTMLTextAreaElement) &&
          !field.value &&
          typeof draft[name] === "string"
        )
          field.value = draft[name];
      }
      if (typeof draft.city === "string" && draft.city.trim()) {
        setAddrCity(draft.city.trim());
      }
      if (typeof draft.district === "string" && draft.district.trim()) {
        setAddrDistrict(draft.district.trim());
      }
    } catch {
      /* Storage is optional; the form remains usable. */
    }
  }, [checkout, cart.lines.length]);

  const beginCheckoutFired = useRef(false);
  useEffect(() => {
    if (!checkout || cart.lines.length === 0 || beginCheckoutFired.current) return;
    beginCheckoutFired.current = true;

    try {
      const items: TrackingEcommerceItem[] = cart.lines.map((l) => ({
        item_id: getTrackingItemId({
          sku: l.sku,
          productId: l.productId,
          id: l.variantId,
        }),
        item_name: l.name,
        price: l.price,
        quantity: l.quantity,
        item_variant: l.variantName || undefined,
        currency: "BDT",
      }));
      const totalVal = cart.lines.reduce((s, l) => s + l.price * l.quantity, 0);

      trackBeginCheckout({
        items,
        value: totalVal,
        coupon: appliedCoupon,
      });
    } catch {
      // Non-blocking
    }
  }, [checkout, cart.lines, appliedCoupon]);

  useEffect(() => {
    let live = true;
    if (serialized !== "[]")
      void requestQuote(serialized, appliedCoupon)
        .then((result) => {
          if (live) {
            setQuote(result);
            setQuotedKey(currentKey);
            setError("");
          }
        })
        .catch(async (e: Error) => {
          if (live && e.message === "Choose an available product variant") {
            try {
              if (await repairObsoleteVariants(cart.lines)) {
                setNotice(
                  "Your cart was updated to match the current product options. Please review the refreshed total.",
                );
                return;
              }
            } catch {
              /* Keep the original actionable quote error. */
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
  }, [serialized, currentKey, review, appliedCoupon, cart.lines]);

  // On the checkout page, re-request a quote whenever the city/district changes
  // so the shipping fee updates live as the customer fills the address form.
  useEffect(() => {
    if (!checkout || serialized === "[]") return;
    const cityVal = addrCity.trim();
    const districtVal = addrDistrict.trim();
    if (!cityVal && !districtVal) return;
    let live = true;
    const timer = setTimeout(() => {
      void requestQuote(serialized, appliedCoupon, cityVal, districtVal)
        .then((result) => {
          if (live) {
            setQuote(result);
            setQuotedKey(
              serialized +
                "::" +
                appliedCoupon +
                `::city:${cityVal}::dist:${districtVal}`,
            );
            setError("");
          }
        })
        .catch(() => {
          /* Silently ignore transient address-hint errors. */
        });
    }, 600);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addrCity, addrDistrict, checkout]);

  useEffect(() => {
    let live = true;
    if (checkout) {
      void shopRequest<Payments>("payment-methods")
        .then((methods) => {
          if (live) {
            setPayments(methods);
            setPayment((current) =>
              methods.methods.some(
                (method) => method.id === current && method.enabled,
              )
                ? current
                : methods.methods.find((method) => method.enabled)?.id || "",
            );
            setPaymentError("");
          }
        })
        .catch((e: Error) => {
          if (live) setPaymentError(e.message);
        });
      void shopRequest<{ user: Shopper | null }>("me")
        .then((me) => {
          if (live) setUser(me.user);
        })
        .catch(() => {
          /* Guest checkout remains available. */
        });
    }
    return () => {
      live = false;
    };
  }, [checkout, review]);

  async function changeQuantity(line: CartLine, quantity: number) {
    if (
      mutationLock.current ||
      submissionLock.current ||
      quantity < 1 ||
      quantity > 10000
    )
      return;
    mutationLock.current = true;
    setUpdating(true);
    setNotice("");
    try {
      const next = cart.lines.map((row) =>
        row.productId === line.productId && row.variantId === line.variantId
          ? { ...row, quantity }
          : row,
      );
      const nextItems = JSON.stringify(
        next.map(({ productId, variantId, quantity }) => ({
          productId,
          ...(variantId ? { variantId } : {}),
          quantity,
        })),
      );
      // The quote endpoint checks current stock, limits, price and coupon eligibility.
      const result = await requestQuote(nextItems, appliedCoupon);
      const isIncrement = quantity > line.quantity;
      const diff = quantity - line.quantity;
      cart.update(line, quantity);
      setQuote(result);
      setQuotedKey(nextItems + "::" + appliedCoupon);
      setError("");

      if (isIncrement && diff > 0) {
        try {
          const itemId = getTrackingItemId({
            sku: line.sku,
            productId: line.productId,
            id: line.variantId,
          });
          trackAddToCart({
            items: [
              {
                item_id: itemId,
                item_name: line.name,
                price: line.price,
                quantity: diff,
                item_variant: line.variantName || undefined,
                currency: "BDT",
              },
            ],
          });
        } catch {
          // Safe non-blocking tracking
        }
      }
    } catch (e) {
      setNotice(
        (e as Error).message || "Unable to update quantity. Please try again.",
      );
    } finally {
      mutationLock.current = false;
      setUpdating(false);
    }
  }

  async function applyCoupon(e: React.FormEvent) {
    e.preventDefault();
    if (!couponCode.trim() || mutationLock.current || submissionLock.current)
      return;
    mutationLock.current = true;
    setCouponBusy(true);
    setCouponError("");
    try {
      const code = couponCode.trim().toUpperCase();
      const result = await requestQuote(serialized, code);
      if (!result.coupon) throw new Error("Coupon code could not be applied.");
      setAppliedCoupon(code);
      setQuote(result);
      setQuotedKey(serialized + "::" + code);
      setCouponCode("");
    } catch (e) {
      setCouponError((e as Error).message || "Invalid coupon code.");
    } finally {
      mutationLock.current = false;
      setCouponBusy(false);
    }
  }

  async function placeOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (
      !validQuote ||
      submissionLock.current ||
      mutationLock.current ||
      !payments?.methods.some(
        (method) => method.id === paymentMethod && method.enabled,
      )
    )
      return;
    const data = new FormData(e.currentTarget);
    const value = (key: string) => String(data.get(key) || "").trim();
    const phone = value("phone").replace(/[\s()-]/g, "");
    const payload = {
      items: JSON.parse(serialized),
      customerName: value("name"),
      ...(value("email") ? { customerEmail: value("email") } : {}),
      customerPhone: phone,
      paymentMethod,
      shippingAddress: {
        recipientName: value("name"),
        phone,
        line1: value("address"),
        city: value("city"),
        ...(value("district") ? { district: value("district") } : {}),
        ...(value("postalCode") ? { postalCode: value("postalCode") } : {}),
      },
      ...(value("note") ? { customerNote: value("note") } : {}),
      ...(appliedCoupon ? { couponCode: appliedCoupon } : {}),
    };
    const fingerprint = JSON.stringify(payload);
    if (attempt.current.fingerprint !== fingerprint)
      attempt.current = { fingerprint, key: crypto.randomUUID() };
    submissionLock.current = true;
    setBusy(true);
    setCheckoutError("");
    try {
      const order = await shopRequest<Order>(
        "orders",
        { ...payload, quoteToken: quote.quoteToken },
        attempt.current.key,
      );
      setPlaced(order.id);
      // A storage failure must never encourage creating another order.
      try {
        cart.clear();
      } catch {
        /* The persisted order already succeeded. */
      }
      try {
        sessionStorage.removeItem("ds-checkout-draft");
      } catch {
        /* Optional draft storage. */
      }

      // Set a one-time "fresh order" token so the confirmation page (/orders/[id])
      // fires the purchase event reliably after landing, avoiding drop-off on redirect.
      // Privacy rule: MUST NOT contain personal data (no email, phone, address).
      // Only stores non-PII order payload needed for purchase tracking.
      try {
        const orderValue = calculatePurchaseValue({
          grandTotal: Number(order.grandTotal) || 0,
          subtotal: Number(order.subtotal) || 0,
          discountTotal: Number(order.discountTotal) || 0,
        });

        const items: TrackingEcommerceItem[] = (order.items || []).map(
          (it) => ({
            item_id: it.skuSnapshot?.trim() || it.nameSnapshot,
            item_name: it.nameSnapshot,
            price: Number(it.unitPrice) || 0,
            quantity: it.quantity,
            currency: "BDT",
          }),
        );

        sessionStorage.setItem(
          `ds_fresh_order_${order.id}`,
          JSON.stringify({
            orderNumber: order.orderNumber,
            value: orderValue,
            shipping: Number(order.shippingTotal) || 0,
            tax: Number(order.taxTotal) || 0,
            coupon: order.couponCode || appliedCoupon || undefined,
            items,
            paymentMethod,
            createdAt: Date.now(),
          }),
        );
      } catch {
        /* Storage non-fatal */
      }
      if (paymentMethod === "BKASH" || paymentMethod === "SSLCOMMERZ") {
        try {
          const result = await shopRequest<{ redirectUrl: string }>(
            "payments/initiate",
            { orderId: order.id, method: paymentMethod },
          );
          if (result.redirectUrl) {
            window.location.href = result.redirectUrl;
            return;
          }
          throw new Error("Payment gateway did not return a redirect.");
        } catch {
          router.push(`/orders/${order.id}?payment=initiate_failed`);
          return;
        }
      }
      router.push(`/orders/${order.id}`);
    } catch (e) {
      setCheckoutError((e as Error).message);
      setReview((v) => v + 1);
    } finally {
      submissionLock.current = false;
      setBusy(false);
    }
  }

  if (placed)
    return (
      <main id="main" className="container main-content shopping-page">
        <SectionCard title="Thank you for your order">
          <p>
            Your order has been created. Review its payment and delivery status
            below.
          </p>
          <Link className="primary-button" href={`/orders/${placed}`}>
            View order confirmation
          </Link>
        </SectionCard>
      </main>
    );

  return (
    <main id="main" className="container main-content shopping-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link> / <Link href="/cart">Cart</Link>
        {checkout && " / Checkout"}
      </nav>
      <header className="shopping-header">
        <h1>{checkout ? "Checkout" : "Your cart"}</h1>
        <p className="muted">
          {checkout
            ? "Complete your details and review your order."
            : `${cart.count} ${cart.count === 1 ? "item" : "items"} in your shopping bag`}
        </p>
      </header>
      {notice && (
        <p className="shopping-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <div className="shop-error shopping-alert" role="alert">
          <p>
            {error === "Request origin rejected"
              ? "We could not verify this store’s checkout connection. Please refresh and try again. If this continues, contact the store."
              : error}
          </p>
          <button
            className="secondary-button"
            disabled={locked}
            onClick={() => setReview((v) => v + 1)}
          >
            Refresh prices and availability
          </button>
        </div>
      )}
      {!cart.lines.length ? (
        <div className="empty-content">
          <ProductThumbnail name="Shopping bag" />
          <h2>Your cart is empty</h2>
          <p>Explore the catalog and find something you love.</p>
          <Link className="primary-button" href="/shop">
            Explore Products
          </Link>
        </div>
      ) : (
        <div
          className={`checkout-grid ${checkout ? "is-checkout" : "is-cart"}`}
        >
          {!checkout && (
            <SectionCard title="Cart items" className="cart-items">
              <div aria-busy={updating}>
                {cart.lines.map((line) => {
                  const item = validQuote
                    ? quote.items.find(
                        (i) =>
                          i.productId === line.productId &&
                          i.variantId === line.variantId,
                      )
                    : undefined;
                  const href = `/product/${encodeURIComponent(line.slug)}`;
                  return (
                    <article
                      className="cart-line"
                      key={`${line.productId}:${line.variantId || ""}`}
                    >
                      <ProductThumbnail
                        src={line.imageUrl}
                        name={line.name}
                        href={href}
                      />
                      <div className="cart-product-info">
                        <Link className="product-name" href={href}>
                          {line.name}
                        </Link>
                        {line.variantName && (
                          <p className="muted small">{line.variantName}</p>
                        )}
                        <p className="muted small">
                          {money(item?.unitPrice ?? line.price)} each
                          {!item && " · estimated"}
                        </p>
                        {error === "Choose an available product variant" && (
                          <Link className="text-button" href={href}>
                            Review product options
                          </Link>
                        )}
                      </div>
                      <div className="cart-row-actions">
                        <div
                          className="quantity-stepper"
                          role="group"
                          aria-label={`Quantity for ${line.name}`}
                        >
                          <button
                            type="button"
                            aria-label={`Decrease quantity for ${line.name}`}
                            disabled={locked || line.quantity <= 1}
                            onClick={() =>
                              void changeQuantity(line, line.quantity - 1)
                            }
                          >
                            −
                          </button>
                          <output aria-live="polite">{line.quantity}</output>
                          <button
                            type="button"
                            aria-label={`Increase quantity for ${line.name}`}
                            disabled={locked || line.quantity >= 10000}
                            onClick={() =>
                              void changeQuantity(line, line.quantity + 1)
                            }
                          >
                            +
                          </button>
                        </div>
                        <strong className="line-total">
                          {money(item?.lineTotal ?? line.price * line.quantity)}
                          {!item && <small> estimated</small>}
                        </strong>
                        <button
                          type="button"
                          className="remove-item"
                          aria-label={`Remove ${line.name}`}
                          disabled={locked}
                          onClick={() => {
                            try {
                              cart.remove(line);
                              setNotice(`${line.name} removed from your cart.`);
                            } catch {
                              setError("Unable to update cart storage.");
                            }
                          }}
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            aria-hidden="true"
                          >
                            <path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" />
                          </svg>
                          Remove
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              <p className="muted small" role="status">
                {updating
                  ? "Verifying quantity and availability…"
                  : "Prices and stock are checked with the store."}
              </p>
              <Link className="shopping-back" href="/shop">
                ← Continue Shopping
              </Link>
            </SectionCard>
          )}
          {checkout && (
            <form
              ref={formRef}
              className="checkout-form"
              onSubmit={placeOrder}
              onChange={() => {
                if (!formRef.current) return;
                const data = new FormData(formRef.current);
                try {
                  sessionStorage.setItem(
                    "ds-checkout-draft",
                    JSON.stringify(
                      Object.fromEntries(
                        draftFields.map((name) => [
                          name,
                          String(data.get(name) || ""),
                        ]),
                      ),
                    ),
                  );
                } catch {
                  /* Optional draft storage. */
                }
              }}
            >
              <fieldset disabled={locked}>
                <SectionCard title="Contact Information">
                  {!user && (
                    <p className="muted small">
                      Checkout as a guest, or{" "}
                      <Link href="/account">sign in</Link> to keep orders in
                      your account.
                    </p>
                  )}
                  <div className="form-grid">
                    <label>
                      Full name
                      <input
                        name="name"
                        autoComplete="name"
                        required
                        minLength={2}
                        maxLength={120}
                        defaultValue={[user?.firstName, user?.lastName]
                          .filter(Boolean)
                          .join(" ")}
                      />
                    </label>
                    <label>
                      Mobile number
                      <input
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        required
                        pattern="(?:\+?88)?01[3-9][0-9]{8}"
                        title="Enter a Bangladesh mobile number: 01712345678 or +8801712345678"
                        maxLength={14}
                        defaultValue={user?.phone || ""}
                      />
                      <small className="muted">For example, 01712345678</small>
                    </label>
                    <label className="full-field">
                      Email address (optional)
                      <input
                        name="email"
                        type="email"
                        autoComplete="email"
                        maxLength={254}
                        defaultValue={user?.email}
                      />
                    </label>
                  </div>
                </SectionCard>
                <SectionCard title="Delivery Address">
                  <div className="form-grid">
                    <label className="full-field">
                      Full address
                      <input
                        name="address"
                        autoComplete="street-address"
                        required
                        minLength={3}
                        maxLength={240}
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
                        onChange={(e) => setAddrCity(e.target.value)}
                      />
                    </label>
                    <label>
                      District (optional)
                      <input
                        name="district"
                        autoComplete="address-level1"
                        maxLength={120}
                        onChange={(e) => setAddrDistrict(e.target.value)}
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
                      Delivery instructions (optional)
                      <textarea name="note" rows={3} maxLength={2000} />
                    </label>
                  </div>
                </SectionCard>
                <SectionCard title="Payment Method">
                  {paymentError && (
                    <p className="shop-error" role="alert">
                      {paymentError}
                    </p>
                  )}
                  {!payments && !paymentError && (
                    <p role="status">Loading available payment methods…</p>
                  )}
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
                          <strong>{method.label}</strong>
                          <small>
                            {!method.enabled
                              ? "Currently unavailable"
                              : method.id === "COD"
                                ? "Pay the courier when your order arrives."
                                : "Complete payment using the store’s verified payment flow."}
                          </small>
                        </span>
                      </label>
                    ))}
                  </div>
                  {payments &&
                    !payments.methods.some((method) => method.enabled) && (
                      <p role="alert">
                        No payment methods are currently available. Please
                        contact the store.
                      </p>
                    )}
                  {paymentMethod === "BANK_TRANSFER" && payments?.bank && (
                    <div className="bank-details">
                      <p>
                        {payments.bank.name} · {payments.bank.branch}
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
                </SectionCard>
                <SectionCard title="Confirm your order">
                  {checkoutError && (
                    <p className="shop-error" role="alert">
                      {checkoutError}
                    </p>
                  )}
                  {validQuote && (
                    <p className="confirmation-total">
                      Total payable <strong>{money(quote.total)}</strong>
                    </p>
                  )}
                  <label className="consent-row">
                    <input type="checkbox" required />{" "}
                    <span>
                      I confirm my delivery details and agree to place this
                      order.
                    </span>
                  </label>
                  <button
                    type="submit"
                    className="primary-button place-order"
                    disabled={
                      !validQuote ||
                      locked ||
                      !payments?.methods.some(
                        (method) =>
                          method.enabled && method.id === paymentMethod,
                      )
                    }
                  >
                    {busy ? "Processing your order…" : "Place Order"}
                  </button>
                  <p className="muted small">
                    Your final price and stock are verified securely before the
                    order is created.
                  </p>
                </SectionCard>
              </fieldset>
            </form>
          )}
          <aside
            className="shop-panel order-summary"
            aria-busy={updating || couponBusy}
          >
            <h2>Order Summary</h2>
            {checkout && (
              <div className="checkout-summary-items">
                {cart.lines.map((line) => (
                  <article
                    className="summary-product"
                    key={`${line.productId}:${line.variantId || ""}`}
                  >
                    <ProductThumbnail
                      src={line.imageUrl}
                      name={line.name}
                      href={`/product/${encodeURIComponent(line.slug)}`}
                    />
                    <div>
                      <Link href={`/product/${encodeURIComponent(line.slug)}`}>
                        {line.name}
                      </Link>
                      {line.variantName && (
                        <small className="muted">{line.variantName}</small>
                      )}
                      <small className="muted">Quantity {line.quantity}</small>
                      <strong>
                        {validQuote
                          ? money(
                              quote.items.find(
                                (item) =>
                                  item.productId === line.productId &&
                                  item.variantId === line.variantId,
                              )?.lineTotal ?? line.price * line.quantity,
                            )
                          : "Awaiting price verification"}
                      </strong>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {validQuote ? (
              <>
                <PriceSummary
                  subtotal={quote.subtotal}
                  shipping={quote.shipping}
                  tax={quote.tax}
                  total={quote.total}
                  discount={quote.discount}
                  coupon={quote.coupon?.code}
                />
                <div className="coupon-section">
                  {appliedCoupon ? (
                    <div className="applied-coupon">
                      <span>
                        {appliedCoupon}
                        <small>Discount applied</small>
                      </span>
                      <button
                        type="button"
                        className="text-button"
                        disabled={locked}
                        onClick={() => {
                          setAppliedCoupon("");
                          setCouponError("");
                          setCouponCode("");
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <form className="coupon-form" onSubmit={applyCoupon}>
                      <label className="sr-only" htmlFor="coupon-code">
                        Coupon code
                      </label>
                      <input
                        id="coupon-code"
                        placeholder="Coupon code"
                        value={couponCode}
                        onChange={(e) =>
                          setCouponCode(e.target.value.toUpperCase())
                        }
                        maxLength={32}
                        disabled={locked}
                      />
                      <button
                        type="submit"
                        className="secondary-button"
                        disabled={!couponCode.trim() || locked}
                      >
                        {couponBusy ? "Applying…" : "Apply"}
                      </button>
                    </form>
                  )}
                  {couponError && (
                    <p className="coupon-error" role="alert">
                      {couponError}
                    </p>
                  )}
                </div>
                <p className="muted small">
                  Delivery within Bangladesh. Your final total is verified again
                  when placing the order.
                </p>
                {validQuote && quote.shippingRates && (
                  <p className="muted small" style={{ marginTop: "4px" }}>
                    {quote.shippingRates.freeAbove > 0
                      ? `Free delivery on orders over ৳${quote.shippingRates.freeAbove.toLocaleString()}. `
                      : ""}
                    Delivery: ৳{quote.shippingRates.insideDhaka} inside Dhaka · ৳{quote.shippingRates.outsideDhaka} elsewhere.
                  </p>
                )}
                {!checkout && (
                  <Link
                    className="primary-button checkout-link"
                    href="/checkout"
                    aria-disabled={locked}
                    onClick={(e) => {
                      if (locked) e.preventDefault();
                    }}
                  >
                    Proceed to Checkout →
                  </Link>
                )}
              </>
            ) : (
              <p role="status">
                {error
                  ? "We need to verify prices and availability before checkout."
                  : "Checking current prices and stock…"}
              </p>
            )}
            {!validQuote && appliedCoupon && (
              <button
                type="button"
                className="text-button"
                disabled={locked}
                onClick={() => {
                  setAppliedCoupon("");
                  setCouponError("");
                }}
              >
                Remove coupon {appliedCoupon}
              </button>
            )}
            {checkout && (
              <Link className="shopping-back" href="/cart">
                ← Edit cart
              </Link>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
