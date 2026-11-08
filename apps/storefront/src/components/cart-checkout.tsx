"use client";
import { CheckoutCustomerFields } from "./checkout-customer-fields";
import { PaymentInstructions } from "./payment-instructions";

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
import { PaymentMethodSelector } from "./payment-method-selector";
import { SectionCard, PriceSummary, ProductThumbnail } from "./shopping-ui";
import { shippingSummary } from "../lib/shipping-copy";
import { useLanguage } from "../lib/i18n";
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
  paymentOption?: string,
  deliveryArea?: string,
) {
  const cacheKey =
    serialized +
    (couponCode ? `::${couponCode.trim().toUpperCase()}` : "") +
    (city ? `::city:${city.trim().toLowerCase()}` : "") +
    (district ? `::dist:${district.trim().toLowerCase()}` : "") +
    (paymentOption ? `::opt:${paymentOption}` : "") +
    (deliveryArea ? `::area:${deliveryArea}` : "");
  let promise = pending.get(cacheKey);
  if (!promise) {
    promise = shopRequest<Quote>("quote", {
      items: JSON.parse(serialized),
      ...(couponCode ? { couponCode: couponCode.trim().toUpperCase() } : {}),
      ...(city ? { city: city.trim() } : {}),
      ...(district ? { district: district.trim() } : {}),
      ...(paymentOption ? { paymentOption } : {}),
      ...(deliveryArea ? { deliveryArea } : {}),
    }).finally(() => pending.delete(cacheKey));
    pending.set(cacheKey, promise);
  }
  return promise;
}

export function CartCheckout({
  checkout = false,
  payment = false,
  drawer = false,
}: {
  checkout?: boolean;
  payment?: boolean;
  drawer?: boolean;
}) {
  const cart = useCart();
  const router = useRouter();
  const { t, formatPrice, formatNumber, isBn } = useLanguage();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quotedKey, setQuotedKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [review, setReview] = useState(0);
  const [payments, setPayments] = useState<Payments | null>(null);
  const [paymentError, setPaymentError] = useState("");
  type CheckoutPaymentOption = "FULL_PAYMENT" | "PARTIAL_ADVANCE" | "COD";
  const [category, setCategory] = useState<"mobile_banking" | "bank">(
    "mobile_banking",
  );
  const [senderInfo, setSenderInfo] = useState("");
  const [reference, setReference] = useState("");
  const [selectedOption, setSelectedOption] = useState<
    CheckoutPaymentOption | ""
  >("");
  const [chosenMethodId, setChosenMethodId] = useState<string>("");
  const [chosenGateway, setChosenGateway] = useState("");
  const [user, setUser] = useState<Shopper | null>(null);
  const [placed, setPlaced] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(() => {
    if (typeof window === "undefined" || !checkout) return "";
    try {
      return sessionStorage.getItem("ds-checkout-coupon") || "";
    } catch {
      return "";
    }
  });
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
    "deliveryArea",
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
  const [addrCity, setAddrCity] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const draft = JSON.parse(
        sessionStorage.getItem("ds-checkout-draft") || "{}",
      );
      return typeof draft.city === "string" ? draft.city.trim() : "";
    } catch {
      return "";
    }
  });
  const [addrDistrict, setAddrDistrict] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const draft = JSON.parse(
        sessionStorage.getItem("ds-checkout-draft") || "{}",
      );
      return typeof draft.district === "string" ? draft.district.trim() : "";
    } catch {
      return "";
    }
  });

  const [deliveryArea, setDeliveryArea] = useState<
    "inside_dhaka" | "outside_dhaka" | ""
  >(() => {
    if (typeof window === "undefined") return "";
    try {
      const draft = JSON.parse(
        sessionStorage.getItem("ds-checkout-draft") || "{}",
      );
      return ["inside_dhaka", "outside_dhaka"].includes(draft.deliveryArea)
        ? draft.deliveryArea
        : "";
    } catch {
      return "";
    }
  });
  const paymentChannels = (payments?.methods || []).filter(
    (method) => method.type === category,
  );
  const availablePlans = (quote?.plans || []).filter(
    (plan) =>
      plan.available &&
      (plan.plan === "COD" ||
        Number(plan.payableNow) === 0 ||
        (payments?.methods.length || 0) > 0 ||
        (payments?.gateways?.length || 0) > 0),
  );

  const paymentOption = selectedOption;
  const planSelected = availablePlans.some(
    (plan) => plan.plan === paymentOption,
  );
  const needsPrepayment =
    !!paymentOption &&
    paymentOption !== "COD" &&
    Number(quote?.payableNow || 0) > 0;
  const gateways = payments?.gateways || [];
  const gateway =
    gateways.find((method) => method.id === chosenGateway) ||
    (!payments?.methods.length ? gateways[0] : undefined);
  const needsManualPayment = needsPrepayment && !gateway;
  const selectedMethodId =
    chosenMethodId &&
    paymentChannels.some((method) => method.id === chosenMethodId)
      ? chosenMethodId
      : paymentChannels[0]?.id || "";
  const selectedMethod = paymentChannels.find(
    (method) => method.id === selectedMethodId,
  );
  const setPaymentOption = (option: CheckoutPaymentOption) =>
    setSelectedOption(option);
  const currentKey =
    serialized +
    "::" +
    appliedCoupon +
    (checkout
      ? `::city:${addrCity.trim()}::dist:${addrDistrict.trim()}::opt:${paymentOption}::area:${deliveryArea}`
      : "");
  const validQuote = quote && quotedKey === currentKey;
  const locked = busy || updating || couponBusy;

  useEffect(() => {
    if (!checkout || placed || submissionLock.current) return;
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
      if (
        payment &&
        (!draft.name ||
          !draft.phone ||
          !draft.address ||
          !draft.city ||
          !draft.district ||
          !["inside_dhaka", "outside_dhaka"].includes(draft.deliveryArea) ||
          Array.from(
            formRef.current?.querySelectorAll<HTMLInputElement>(
              "[hidden] input",
            ) || [],
          ).some((field) => !field.checkValidity()))
      )
        router.replace("/checkout");
    } catch {
      if (payment) router.replace("/checkout");
      /* Storage is optional; the form remains usable. */
    }
  }, [checkout, payment, router, cart.lines.length, placed]);

  const beginCheckoutFired = useRef(false);
  useEffect(() => {
    if (!checkout || cart.lines.length === 0 || beginCheckoutFired.current)
      return;
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
      void requestQuote(
        serialized,
        appliedCoupon,
        checkout && addrCity.trim() ? addrCity.trim() : undefined,
        checkout && addrDistrict.trim() ? addrDistrict.trim() : undefined,
        checkout ? paymentOption : undefined,
        checkout ? deliveryArea : undefined,
      )
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
  }, [
    serialized,
    currentKey,
    review,
    appliedCoupon,
    cart.lines,
    checkout,
    addrCity,
    addrDistrict,
    paymentOption,
    deliveryArea,
  ]);

  useEffect(() => {
    let live = true;
    if (checkout) {
      void shopRequest<Payments>("payment-methods")
        .then((methods) => {
          if (live) {
            setPayments(methods);
            if (methods.methods.length) setCategory(methods.methods[0].type);
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
      const result = await requestQuote(
        serialized,
        code,
        checkout ? addrCity : undefined,
        checkout ? addrDistrict : undefined,
        checkout ? paymentOption : undefined,
        checkout ? deliveryArea : undefined,
      );
      if (!result.coupon) throw new Error("Coupon code could not be applied.");
      setAppliedCoupon(code);
      setQuote(result);
      setQuotedKey(
        serialized +
          "::" +
          code +
          (checkout
            ? `::city:${addrCity.trim()}::dist:${addrDistrict.trim()}::opt:${paymentOption}::area:${deliveryArea}`
            : ""),
      );
      try {
        sessionStorage.setItem("ds-checkout-coupon", code);
      } catch {
        /* Optional storage. */
      }
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
    if (!payment) {
      if (!validQuote || !deliveryArea || locked) return;
      try {
        const data = new FormData(e.currentTarget);
        sessionStorage.setItem(
          "ds-checkout-draft",
          JSON.stringify(
            Object.fromEntries(
              draftFields.map((name) => [
                name,
                String(data.get(name) || "").trim(),
              ]),
            ),
          ),
        );
        sessionStorage.setItem("ds-checkout-coupon", appliedCoupon);
        router.push("/checkout/payment");
      } catch {
        setCheckoutError(
          "Please allow session storage to continue securely to payment.",
        );
      }
      return;
    }
    const effectivePaymentMethod =
      paymentOption === "COD" || paymentOption === "PARTIAL_ADVANCE"
        ? "COD"
        : "MANUAL";
    if (
      !validQuote ||
      !deliveryArea ||
      submissionLock.current ||
      mutationLock.current ||
      !planSelected ||
      (needsManualPayment &&
        (!selectedMethodId || !senderInfo.trim() || !reference.trim()))
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
      paymentMethod: effectivePaymentMethod,
      ...(needsPrepayment
        ? gateway
          ? { paymentGateway: gateway.id }
          : { paymentMethodId: selectedMethodId, senderInfo, reference }
        : {}),
      paymentOption,
      deliveryArea,
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
      const digest = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(fingerprint),
          ),
        ),
      )
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      try {
        const previous = JSON.parse(
          sessionStorage.getItem("ds-checkout-attempt") || "null",
        );
        if (previous?.digest === digest && typeof previous.key === "string")
          attempt.current.key = previous.key;
        sessionStorage.setItem(
          "ds-checkout-attempt",
          JSON.stringify({ digest, key: attempt.current.key }),
        );
      } catch {
        /* In-memory submission locking still applies. */
      }
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
        sessionStorage.removeItem("ds-checkout-coupon");
        sessionStorage.removeItem("ds-checkout-attempt");
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
            paymentMethod: order.paymentMethod,
            createdAt: new Date(order.createdAt).getTime(),
          }),
        );
      } catch {
        /* Storage non-fatal */
      }
      if (needsPrepayment && gateway) {
        try {
          const payment = await shopRequest<{ redirectUrl: string }>(
            `orders/${order.id}/gateway-payment`,
            { gateway: gateway.id },
          );
          window.location.assign(payment.redirectUrl);
        } catch {
          router.push(`/orders/${order.id}?payment=initiate_failed`);
        }
      } else router.push(`/order-success/${order.id}`);
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
      <main
        id={drawer ? undefined : "main"}
        className={`container main-content shopping-page ${drawer ? "drawer-shopping" : ""}`}
      >
        <SectionCard title="Thank you for your order">
          <p>
            Your order has been created. Review its payment and delivery status
            below.
          </p>
          <Link className="primary-button" href={`/order-success/${placed}`}>
            View order confirmation
          </Link>
        </SectionCard>
      </main>
    );

  return (
    <main
      id={drawer ? undefined : "main"}
      className={`container main-content shopping-page ${drawer ? "drawer-shopping" : ""}`}
    >
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link> / <Link href="/cart">Cart</Link>
        {checkout && " / Checkout"}
        {payment && " / Payment"}
      </nav>
      <header className="shopping-header">
        <h1>
          {payment
            ? "Choose Your Payment Method"
            : checkout
              ? "Checkout"
              : (isBn ? "আপনার শপিং ব্যাগ" : "Your cart")}
        </h1>
        <p className="muted">
          {checkout
            ? "Complete your details and review your order."
            : isBn
              ? `${formatNumber(cart.count)}টি পণ্য আপনার শপিং ব্যাগে আছে`
              : `${cart.count} ${cart.count === 1 ? "item" : "items"} in your shopping bag`}
        </p>
      </header>
      {payment && (
        <p>
          <Link href="/checkout">← Back to Checkout</Link>
          <br />
          <span className="muted small">
            Payments are verified securely. A transfer reference is reviewed
            before payment is confirmed.
          </span>
        </p>
      )}
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
          <h2>{t("drawer_empty")}</h2>
          <p>{isBn ? "ক্যাটালগ ঘুরে দেখুন এবং পছন্দের পণ্যটি বেছে নিন।" : "Explore the catalog and find something you love."}</p>
          <Link className="primary-button" href="/shop">
            {isBn ? "পণ্য দেখুন" : "Explore Products"}
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
                          {t("drawer_remove")}
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
                ← {t("drawer_continue")}
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
                <CheckoutCustomerFields
                  payment={payment}
                  user={user}
                  onCityChange={setAddrCity}
                  onDistrictChange={setAddrDistrict}
                  deliveryArea={deliveryArea}
                  onDeliveryAreaChange={setDeliveryArea}
                />
                {!payment && (
                  <SectionCard title="Delivery Information">
                    <p>
                      {quote?.shippingRates
                        ? shippingSummary(quote.shippingRates)
                        : "Delivery is calculated from your address in the order overview."}
                    </p>
                    <p className="muted small">
                      Review your details before continuing to payment.
                    </p>
                  </SectionCard>
                )}
                {payment && (
                  <>
                    <SectionCard title="Payment plan">
                      {paymentError && (
                        <p className="shop-error" role="alert">
                          {paymentError}
                        </p>
                      )}
                      {!payments && !paymentError && (
                        <p role="status">Loading payment options...</p>
                      )}
                      {payments && !availablePlans.length && (
                        <p role="alert">
                          No payment option is available for this order. Please
                          contact the store.
                        </p>
                      )}
                      <div
                        className="payment-options"
                        role="radiogroup"
                        aria-label="Payment plan"
                      >
                        {availablePlans.map((plan) => (
                          <label
                            key={plan.plan}
                            className={`payment-option-card ${paymentOption === plan.plan ? "is-selected" : ""}`}
                          >
                            <input
                              type="radio"
                              name="paymentPlan"
                              required
                              value={plan.plan}
                              checked={paymentOption === plan.plan}
                              onChange={() => setPaymentOption(plan.plan)}
                            />
                            <span>
                              <strong>
                                {plan.plan === "FULL_PAYMENT"
                                  ? "Full Payment"
                                  : plan.plan === "PARTIAL_ADVANCE"
                                    ? "Partial Advance + Cash on Delivery"
                                    : "Cash on Delivery"}
                              </strong>
                              <small>
                                Pay now {money(plan.payableNow)}
                                {Number(plan.prepaidDiscount) > 0
                                  ? `, save ${money(plan.prepaidDiscount)}`
                                  : ""}{" "}
                                | Pay on delivery{" "}
                                {money(plan.amountDueOnDelivery)}
                              </small>
                            </span>
                          </label>
                        ))}
                      </div>
                      {needsPrepayment && gateways.length > 0 && (
                        <div
                          className="shopping-stack"
                          style={{ marginTop: 16 }}
                        >
                          <label>
                            Payment method
                            <select
                              value={gateway?.id || "manual"}
                              onChange={(event) =>
                                setChosenGateway(event.target.value)
                              }
                            >
                              {(payments?.methods.length || 0) > 0 && (
                                <option value="manual">Manual transfer</option>
                              )}
                              {gateways.map((method) => (
                                <option key={method.id} value={method.id}>
                                  {method.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          {gateway && (
                            <p>
                              You will be redirected to {gateway.name} to pay{" "}
                              {money(quote?.payableNow || 0)} securely after
                              placing your order.
                            </p>
                          )}
                        </div>
                      )}
                      {needsManualPayment && (
                        <div
                          className="shopping-stack"
                          style={{ marginTop: 16 }}
                        >
                          <PaymentMethodSelector
                            methods={payments?.methods || []}
                            selectedId={selectedMethodId}
                            category={category}
                            onCategoryChange={(value) => {
                              setCategory(value);
                              setChosenMethodId("");
                              setSenderInfo("");
                              setReference("");
                            }}
                            onSelect={(id) => {
                              setChosenMethodId(id);
                              setSenderInfo("");
                              setReference("");
                            }}
                          />
                          {!paymentChannels.length && (
                            <p>
                              No methods are available in this category. Choose
                              another category.
                            </p>
                          )}
                          {selectedMethod && (
                            <>
                              <PaymentInstructions
                                method={selectedMethod}
                                amount={quote?.payableNow || 0}
                              />
                              <label>
                                {category === "mobile_banking"
                                  ? "Sender mobile number"
                                  : "Sender name / account"}
                                <input
                                  name="senderInfo"
                                  required
                                  value={senderInfo}
                                  maxLength={120}
                                  type={
                                    category === "mobile_banking"
                                      ? "tel"
                                      : "text"
                                  }
                                  onChange={(e) =>
                                    setSenderInfo(e.target.value)
                                  }
                                />
                              </label>
                              <label>
                                {category === "mobile_banking"
                                  ? "Transaction ID"
                                  : "Bank reference"}
                                <input
                                  name="reference"
                                  required
                                  value={reference}
                                  minLength={3}
                                  maxLength={100}
                                  onChange={(e) => setReference(e.target.value)}
                                />
                              </label>
                            </>
                          )}
                        </div>
                      )}
                      {quote?.discountMessage && (
                        <p role="status">{quote.discountMessage}</p>
                      )}
                    </SectionCard>
                    <SectionCard title="Confirm your order">
                      {checkoutError && (
                        <p className="shop-error" role="alert">
                          {checkoutError}
                        </p>
                      )}
                      {!planSelected && (
                        <p className="muted small">
                          Choose a payment plan above to see the amount payable
                          now and on delivery.
                        </p>
                      )}
                      {validQuote && planSelected && (
                        <div
                          className="confirmation-total-block"
                          style={{ marginBottom: 12 }}
                        >
                          <p className="confirmation-total">
                            <span>Pay now</span>
                            <strong>{money(quote.payableNow || 0)}</strong>
                          </p>
                          <p>
                            Pay on delivery:{" "}
                            {money(quote.amountDueOnDelivery || 0)}
                          </p>
                        </div>
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
                          !deliveryArea ||
                          locked ||
                          !planSelected ||
                          (needsManualPayment &&
                            (!selectedMethodId ||
                              !senderInfo.trim() ||
                              !reference.trim()))
                        }
                      >
                        {busy
                          ? "Confirming your order..."
                          : "Confirm & Place Order"}
                      </button>
                      <p className="muted small">
                        Your final price and stock are checked before the order
                        is created.
                      </p>
                    </SectionCard>
                  </>
                )}
                {!payment && (
                  <SectionCard title="Ready for the next step?">
                    <button
                      type="submit"
                      className="primary-button place-order"
                      disabled={!validQuote || !deliveryArea || locked}
                    >
                      Continue to Payment →
                    </button>
                    {checkoutError && (
                      <p role="alert" className="shop-error">
                        {checkoutError}
                      </p>
                    )}
                  </SectionCard>
                )}
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
                {checkout ? (
                  <PriceSummary
                    subtotal={quote.subtotal}
                    shipping={quote.shipping}
                    tax={quote.tax}
                    total={quote.total}
                    discount={quote.discount}
                    couponDiscount={quote.couponDiscount}
                    coupon={quote.coupon?.code}
                    onlinePaymentDiscount={
                      paymentOption ? quote.prepaidDiscount : undefined
                    }
                    shippingPending={!deliveryArea}
                    totalLabel={
                      !deliveryArea
                        ? "Subtotal after discounts"
                        : !paymentOption
                          ? "Estimated total"
                          : undefined
                    }
                  />
                ) : (
                  <p className="confirmation-total">
                    <span>Product total</span>
                    <strong>{money(quote.subtotal)}</strong>
                  </p>
                )}
                {checkout && (
                  <p className="muted small">
                    {!deliveryArea
                      ? "Select your delivery area to see the delivery charge. "
                      : ""}
                    {!paymentOption
                      ? "Payment-plan discounts are applied after you choose a plan on the payment page."
                      : ""}
                  </p>
                )}
                {checkout && (
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
                            try {
                              sessionStorage.removeItem("ds-checkout-coupon");
                            } catch {
                              /* Optional storage. */
                            }
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
                )}
                {checkout && (
                  <p className="muted small">
                    Review delivery charges and available payment methods at
                    checkout. Your final total is checked when placing the
                    order.
                  </p>
                )}
                {checkout && validQuote && quote.shippingRates && (
                  <p className="muted small" style={{ marginTop: "4px" }}>
                    {shippingSummary(quote.shippingRates)}
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
                    {isBn ? `${t("drawer_checkout_btn")} →` : "Proceed to Checkout →"}
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
                  try {
                    sessionStorage.removeItem("ds-checkout-coupon");
                  } catch {
                    /* Optional storage. */
                  }
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
