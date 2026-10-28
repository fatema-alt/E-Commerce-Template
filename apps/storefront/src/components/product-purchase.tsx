"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "../lib/cart";
import type { Product } from "../lib/storefront";
import { money } from "../lib/shop-client";
import { getTrackingItemId, trackAddToCart } from "../lib/gtm";
import { WishlistButton } from "./shopping-actions";

export function ProductPurchase({
  product,
  variantId,
  onVariantChange,
}: {
  product: Product;
  variantId: string;
  onVariantChange: (id: string) => void;
}) {
  const cart = useCart();
  const router = useRouter();
  const variants = product.variants || [];
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  const variant = variants.find((v) => v.id === variantId);
  const needsVariant = variants.length > 0 && !variant;
  const available = variants.length
    ? (variant?.availableStock ?? 0)
    : product.availableStock;
  const inCart =
    cart.lines.find(
      (line) => line.productId === product.id && line.variantId === variant?.id,
    )?.quantity ?? 0;
  const limit = Math.max(0, Math.min(10000, available) - inCart);
  const count = Number(quantity);
  const valid =
    /^\d+$/.test(quantity) &&
    Number.isSafeInteger(count) &&
    count >= 1 &&
    count <= limit;

  const price = variant?.price ?? product.price;
  const compare = needsVariant
    ? null
    : variant
      ? variant.compareAtPrice
      : product.compareAtPrice;
  const saving = compare && compare > price ? compare - price : 0;
  const discountPercent =
    compare && compare > price ? Math.round(((compare - price) / compare) * 100) : 0;

  const totalStock = variants.length
    ? variants.reduce((sum, v) => sum + v.availableStock, 0)
    : available;

  const quantityError =
    !needsVariant && limit > 0 && !valid
      ? `Enter a whole quantity from 1 to ${limit}.`
      : "";

  function changeQuantity(value: string) {
    setQuantity(value);
    setMessage("");
    setError("");
  }

  function chooseVariant(id: string) {
    onVariantChange(id);
    setQuantity("1");
    setMessage("");
    setError("");
  }

  // Fly-to-Cart Animation Implementation
  function triggerFlyToCart(onComplete?: () => void) {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      onComplete?.();
      return;
    }

    const sourceEl = document.querySelector<HTMLImageElement>(
      ".gallery-main .product-image",
    );
    const targetEl =
      document.querySelector<HTMLElement>("[data-cart-target]") ||
      document.querySelector<HTMLElement>("#header-cart-link") ||
      document.querySelector<HTMLElement>('.shopping-links a[href="/cart"]');

    if (!sourceEl || !targetEl) {
      onComplete?.();
      return;
    }

    const sRect = sourceEl.getBoundingClientRect();
    const tRect = targetEl.getBoundingClientRect();

    if (sRect.width === 0 || sRect.height === 0 || tRect.width === 0) {
      onComplete?.();
      return;
    }

    const clone = document.createElement("img");
    clone.src = sourceEl.src;
    clone.alt = "";
    clone.className = "fly-to-cart-clone";
    clone.style.position = "fixed";
    clone.style.zIndex = "99999";
    clone.style.pointerEvents = "none";
    clone.style.borderRadius = "14px";
    clone.style.boxShadow = "0 14px 28px rgba(0, 0, 0, 0.25)";
    clone.style.top = `${sRect.top}px`;
    clone.style.left = `${sRect.left}px`;
    clone.style.width = `${sRect.width}px`;
    clone.style.height = `${sRect.height}px`;
    clone.style.objectFit = "contain";
    clone.style.background = "white";
    document.body.appendChild(clone);

    const deltaX = tRect.left + tRect.width / 2 - (sRect.left + sRect.width / 2);
    const deltaY = tRect.top + tRect.height / 2 - (sRect.top + sRect.height / 2);

    const animation = clone.animate(
      [
        {
          transform: "translate(0px, 0px) scale(1) rotate(0deg)",
          opacity: 1,
        },
        {
          transform: `translate(${deltaX * 0.45}px, ${deltaY * 0.15 - 50}px) scale(0.65) rotate(-8deg)`,
          opacity: 0.9,
          offset: 0.45,
        },
        {
          transform: `translate(${deltaX * 0.82}px, ${deltaY * 0.65 - 20}px) scale(0.3) rotate(5deg)`,
          opacity: 0.75,
          offset: 0.8,
        },
        {
          transform: `translate(${deltaX}px, ${deltaY}px) scale(0.12) rotate(0deg)`,
          opacity: 0,
        },
      ],
      {
        duration: 620,
        easing: "cubic-bezier(0.2, 0.8, 0.25, 1)",
        fill: "forwards",
      },
    );

    const finalize = () => {
      clone.remove();
      targetEl.classList.remove("cart-icon-bounce");
      void targetEl.offsetWidth; // re-trigger reflow
      targetEl.classList.add("cart-icon-bounce");
      setTimeout(() => {
        targetEl.classList.remove("cart-icon-bounce");
      }, 600);

      onComplete?.();
    };

    animation.onfinish = finalize;
    animation.oncancel = finalize;
  }

  function add(checkout: boolean) {
    if (lock.current || !valid || needsVariant || available < 1) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    setError("");
    let navigating = false;

    try {
      cart.add(
        {
          productId: product.id,
          variantId: variant?.id,
          variantName: variant?.name,
          slug: product.slug,
          name: product.name,
          imageUrl:
            product.images?.find(
              (image) => variant && image.variantId === variant.id,
            )?.url || product.imageUrl,
          quantity: count,
          price,
          sku: variant?.sku || product.sku,
        },
        available,
      );

      setMessage(
        `${count} ${count === 1 ? "item" : "items"} added to your cart.`,
      );
      setQuantity("1");

      try {
        const itemId = getTrackingItemId({
          sku: variant?.sku || product.sku,
          productId: product.id,
          id: variant?.id,
        });
        trackAddToCart({
          items: [
            {
              item_id: itemId,
              item_name: product.name,
              price,
              quantity: count,
              item_brand: product.brand || "DS Mart",
              item_category: product.category?.name || "General",
              item_variant: variant?.name || undefined,
              currency: "BDT",
            },
          ],
        });
      } catch {
        // Safe push wrapper: tracking must never break shopping
      }

      if (checkout) {
        router.push("/checkout");
        navigating = true;
      } else {
        // Trigger smooth Fly-to-Cart animation to header cart target
        triggerFlyToCart();
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to update your cart. Please try again.",
      );
    } finally {
      if (!navigating) {
        lock.current = false;
        setBusy(false);
      }
    }
  }

  return (
    <div className="purchase-actions flex flex-col gap-5">
      {/* 1. Price Section with Clear Discount Hierarchy */}
      <div className="pdp-price-block flex flex-col gap-1.5 p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/40 border border-[var(--c-line)]">
        <div className="pdp-price-line flex flex-wrap items-baseline gap-3">
          <span className="purchase-price text-2xl sm:text-3xl font-extrabold text-[var(--c-ink)] tracking-tight">
            {needsVariant && variants.length > 1 ? "From " : ""}
            {money(needsVariant ? Math.min(...variants.map((v) => v.price)) : price)}
          </span>

          {compare && compare > price && (
            <del className="text-sm sm:text-base text-[var(--c-muted)] font-normal line-through">
              {money(compare)}
            </del>
          )}

          {discountPercent > 0 && (
            <span className="pdp-discount inline-flex items-center px-2.5 py-0.5 rounded-full bg-lime-400/25 border border-lime-400/40 text-[var(--c-ink)] text-xs font-black uppercase tracking-wider">
              {discountPercent}% OFF
            </span>
          )}
        </div>

        {saving > 0 && (
          <p className="pdp-savings text-xs font-semibold text-emerald-600 dark:text-emerald-400 m-0">
            You save {money(saving)} per item
          </p>
        )}

        <p className="pdp-price-note text-[11px] text-[var(--c-muted)] m-0">
          Delivery charges, applicable tax and enabled payment methods are shown at checkout.
        </p>
      </div>

      {/* 2. Stock Availability Indicator */}
      <div
        className={`pdp-availability inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide w-fit ${
          totalStock < 1 || (!needsVariant && available < 1)
            ? "unavailable bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
            : available <= 5 && !needsVariant
              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
        }`}
        role="status"
      >
        <span
          className={`w-2 h-2 rounded-full animate-pulse ${
            totalStock < 1 || (!needsVariant && available < 1)
              ? "bg-rose-500"
              : available <= 5 && !needsVariant
                ? "bg-amber-500"
                : "bg-emerald-500"
          }`}
          aria-hidden="true"
        />
        {totalStock < 1
          ? "Currently out of stock"
          : needsVariant
            ? "Choose an option to check availability"
            : available < 1
              ? "This option is out of stock"
              : available <= 5
                ? `Only ${available} left in stock — order soon`
                : "In stock and ready to ship"}
      </div>

      {/* 3. Product Variants Selection Chips */}
      {variants.length > 0 && (
        <fieldset className="pdp-variants border-0 p-0 m-0 space-y-2.5">
          <legend className="text-xs font-bold text-[var(--c-ink)] uppercase tracking-wider mb-1">
            Choose an option{variant && <span className="font-normal normal-case text-[var(--c-muted)] ml-1">: {variant.name}</span>}
          </legend>

          <div className="pdp-option-grid flex flex-wrap gap-2">
            {variants.map((v) => {
              const isSelected = v.id === variantId;
              const isOut = v.availableStock < 1;

              return (
                <button
                  key={v.id}
                  type="button"
                  className={`pdp-option group px-3.5 py-2 rounded-xl border text-left transition-all ${
                    isSelected
                      ? "border-slate-900 dark:border-lime-400 bg-slate-900 text-white dark:bg-lime-400 dark:text-slate-900 font-bold shadow-xs ring-2 ring-lime-400/30"
                      : isOut
                        ? "border-[var(--c-line)] opacity-40 bg-[var(--glass)] cursor-not-allowed line-through"
                        : "border-[var(--c-line)] bg-[var(--glass-solid)] text-[var(--c-ink)] hover:border-slate-400"
                  }`}
                  aria-pressed={isSelected}
                  disabled={isOut}
                  onClick={() => chooseVariant(v.id)}
                >
                  <strong className="text-xs block leading-tight">{v.name}</strong>
                  <small className={`text-[10px] block mt-0.5 ${isSelected ? "opacity-90" : "text-[var(--c-muted)]"}`}>
                    {!isOut ? money(v.price) : "Out of stock"}
                  </small>
                </button>
              );
            })}
          </div>

          {needsVariant && (
            <p className="muted small text-amber-600 dark:text-amber-400 text-xs mt-1">
              Please select an available option before adding to your cart.
            </p>
          )}
        </fieldset>
      )}

      {/* Variant Attributes facts */}
      {variant?.attributes && Object.keys(variant.attributes).length > 0 && (
        <dl className="pdp-variant-facts grid grid-cols-2 gap-2 text-xs py-2 border-y border-[var(--c-line)]">
          {Object.entries(variant.attributes).map(([label, value]) => (
            <div key={label} className="flex gap-1.5">
              <dt className="text-[var(--c-muted)] font-medium capitalize">{label}:</dt>
              <dd className="font-semibold text-[var(--c-ink)] m-0">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {(variant?.sku || product.sku) && (
        <p className="pdp-sku text-[11px] font-mono text-[var(--c-muted)] m-0">
          SKU: {variant?.sku || product.sku}
        </p>
      )}

      {/* 4. Quantity Stepper & Add to Cart / Buy Now CTAs */}
      <div className="pdp-buy-controls flex flex-col gap-3 pt-1">
        <div className="flex items-center gap-3">
          <label htmlFor="product-quantity" className="text-xs font-bold uppercase tracking-wider text-[var(--c-ink)]">
            Quantity
          </label>

          <div className="pdp-quantity-row flex items-center gap-2.5">
            <div className="pdp-stepper inline-flex items-center border border-[var(--c-line)] rounded-xl bg-[var(--glass-solid)] overflow-hidden h-11">
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={needsVariant || count <= 1 || !valid || busy}
                onClick={() => changeQuantity(String(count - 1))}
                className="w-10 h-full flex items-center justify-center text-sm font-bold text-[var(--c-ink)] hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 transition-colors"
              >
                −
              </button>
              <input
                id="product-quantity"
                type="number"
                inputMode="numeric"
                min={1}
                max={limit || 1}
                step={1}
                value={quantity}
                disabled={needsVariant || limit < 1 || busy}
                aria-invalid={Boolean(quantityError)}
                aria-describedby="quantity-help"
                onChange={(event) => changeQuantity(event.target.value)}
                onBlur={() => {
                  if (!valid && limit > 0 && !needsVariant)
                    changeQuantity(
                      String(
                        Math.max(
                          1,
                          Math.min(
                            limit,
                            Number.isFinite(count) ? Math.floor(count) : 1,
                          ),
                        ),
                      ),
                    );
                }}
                className="w-12 h-full text-center text-sm font-bold text-[var(--c-ink)] bg-transparent border-0 focus:outline-hidden"
              />
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={needsVariant || !valid || count >= limit || busy}
                onClick={() => changeQuantity(String(count + 1))}
                className="w-10 h-full flex items-center justify-center text-sm font-bold text-[var(--c-ink)] hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 transition-colors"
              >
                +
              </button>
            </div>

            {inCart > 0 && (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                ({inCart} already in cart)
              </span>
            )}
          </div>
        </div>

        <p
          id="quantity-help"
          className={quantityError ? "pdp-inline-error text-xs text-red-500 m-0" : "text-[11px] text-[var(--c-muted)] m-0"}
        >
          {quantityError ||
            (!needsVariant && available > 0 && limit === 0
              ? "All available stock is already in your cart."
              : "Stock and prices are checked again at checkout.")}
        </p>

        {/* Primary Action Buttons: Add to Cart & Buy Now */}
        <div className="pdp-primary-actions grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
          <button
            type="button"
            className="primary-button h-12 rounded-xl bg-[#d8f45a] hover:bg-[#c9e847] active:scale-[0.98] text-slate-900 font-bold text-sm tracking-wide shadow-sm hover:shadow flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:pointer-events-none"
            disabled={busy || !valid || needsVariant || available < 1}
            onClick={() => add(false)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            {busy
              ? "Adding…"
              : available < 1 && !needsVariant
                ? "Out of stock"
                : "Add to cart"}
          </button>

          <button
            type="button"
            className="secondary-button pdp-buy-now h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 font-bold text-sm tracking-wide shadow-sm active:scale-[0.98] flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:pointer-events-none"
            disabled={busy || !valid || needsVariant || available < 1}
            onClick={() => add(true)}
          >
            <span>Buy now</span>
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </div>

      {/* Cart Feedback Alerts */}
      <div aria-live="polite" aria-atomic="true">
        {message && (
          <p className="pdp-cart-success p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between m-0">
            <span>✓ {message}</span>
            <Link
              href="/cart"
              className="underline font-bold hover:text-emerald-600 ml-2"
            >
              View cart →
            </Link>
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="shop-error p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold m-0">
          {error}
        </p>
      )}

      {/* 5. Wishlist & Share Options */}
      <div className="pdp-secondary-actions flex items-center gap-3 pt-1">
        <div className="flex-1">
          <WishlistButton product={product} />
        </div>
        <ShareProduct name={product.name} />
      </div>

      <div className="pdp-trust-guarantees">
        {[["Clear pricing", "Review delivery charges and taxes before ordering.", "/checkout"], ["Order tracking", "Follow updates from your account or checkout browser.", "/orders"], ["Product support", "Ask our team about this product and return eligibility.", "/contact"], ["Payment options", "Choose an enabled payment method at checkout.", "/help"]].map(([title, description, href], index) => <Link className="pdp-trust-card" href={href} key={title}><span className="pdp-benefit-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={index === 0 ? "M4 6h16v14H4zM8 3v6M16 3v6M8 13h8M8 17h5" : index === 1 ? "M3 7h12v10H3zM15 10h4l3 4v3h-7M7 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4M18 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4" : index === 2 ? "M4 4h16v13H8l-4 4zM8 8h8M8 12h5" : "M3 5h18v14H3zM3 10h18M7 15h4"}/></svg></span><div className="trust-content"><strong>{title}</strong><span>{description}</span></div></Link>)}
      </div>

      {/* 7. Mobile Sticky Bottom Purchase Bar (hidden on desktop via CSS) */}
      <div
        data-contact-avoid="true"
        className="pdp-mobile-sticky-bar"
      >
        <div className="mobile-price-group">
          <span className="mobile-product-title">
            {product.name}
          </span>
          <span className="mobile-price">
            {money(price)}
          </span>
        </div>

        <div>
          <button
            type="button"
            className="mobile-add-btn"
            disabled={busy || !valid || needsVariant || available < 1}
            onClick={() => add(false)}
          >
            <span>{busy ? "Adding…" : available < 1 ? "Sold out" : "Add to cart"}</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function ShareProduct({ name }: { name: string }) {
  const [notice, setNotice] = useState("");

  return (
    <div className="relative">
      <button
        type="button"
        className="secondary-button px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-[var(--c-line)] hover:bg-[var(--glass)] transition-colors"
        onClick={async () => {
          try {
            if (navigator.share)
              await navigator.share({ title: name, url: window.location.href });
            else {
              await navigator.clipboard.writeText(window.location.href);
              setNotice("Link copied!");
              setTimeout(() => setNotice(""), 3000);
            }
          } catch (error) {
            if (!(error instanceof Error && error.name === "AbortError"))
              setNotice("Copy from address bar");
          }
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        <span>Share</span>
      </button>

      {notice && (
        <span
          className="absolute -top-7 right-0 px-2 py-0.5 rounded bg-[var(--c-ink)] text-[var(--bg-c)] text-[10px] font-bold shadow-sm whitespace-nowrap"
          role="status"
        >
          {notice}
        </span>
      )}
    </div>
  );
}
