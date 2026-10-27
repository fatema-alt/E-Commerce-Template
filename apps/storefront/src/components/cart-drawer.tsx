"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  useCart,
  CART_DRAWER_EVENT_OPEN,
  CART_DRAWER_EVENT_CLOSE,
  CART_DRAWER_EVENT_TOGGLE,
  type CartLine,
} from "../lib/cart";
import { money } from "../lib/shop-client";

export function CartDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const cart = useCart();
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const handleOpen = useCallback(() => {
    previousActiveElement.current = document.activeElement as HTMLElement | null;
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    if (previousActiveElement.current && typeof previousActiveElement.current.focus === "function") {
      previousActiveElement.current.focus();
    }
  }, []);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) {
        previousActiveElement.current = document.activeElement as HTMLElement | null;
      }
      return !prev;
    });
  }, []);

  // Listen to drawer custom events
  useEffect(() => {
    window.addEventListener(CART_DRAWER_EVENT_OPEN, handleOpen);
    window.addEventListener(CART_DRAWER_EVENT_CLOSE, handleClose);
    window.addEventListener(CART_DRAWER_EVENT_TOGGLE, handleToggle);
    return () => {
      window.removeEventListener(CART_DRAWER_EVENT_OPEN, handleOpen);
      window.removeEventListener(CART_DRAWER_EVENT_CLOSE, handleClose);
      window.removeEventListener(CART_DRAWER_EVENT_TOGGLE, handleToggle);
    };
  }, [handleOpen, handleClose, handleToggle]);

  // Handle Escape key and body scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      // If a native modal dialog is currently open, let the modal dialog handle Escape
      if (document.querySelector("dialog[open]")) {
        return;
      }
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, handleClose]);

  // Focus trap inside drawer
  useEffect(() => {
    if (isOpen && drawerRef.current) {
      const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length) {
        focusable[0].focus();
      }
    }
  }, [isOpen]);

  const subtotal = cart.lines.reduce((sum, line) => sum + line.price * line.quantity, 0);

  // Free shipping threshold progress (e.g. 1500 BDT)
  const freeShippingThreshold = 1500;
  const progressToFreeShipping = Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100));
  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - subtotal);

  return (
    <aside
      className={`cart-drawer-root fixed inset-0 z-[100] transition-visibility ${
        isOpen ? "visible pointer-events-auto" : "invisible pointer-events-none"
      }`}
      aria-label="Shopping Cart Drawer"
      aria-hidden={!isOpen}
    >
      {/* Backdrop */}
      <div
        className={`cart-drawer-backdrop fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 ease-out ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Your Cart"
        className={`cart-drawer-panel fixed top-0 right-0 bottom-0 w-full sm:w-[430px] max-w-full h-full bg-[var(--glass-solid)] border-l border-[var(--c-line)] shadow-2xl flex flex-col justify-between transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* 1. Drawer Header */}
        <div className="cart-drawer-header px-5 py-4 border-b border-[var(--c-line)] flex items-center justify-between bg-[var(--glass)]">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-lime-400/20 text-[var(--c-ink)]">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </span>
            <div>
              <h2 className="text-lg font-bold text-[var(--c-ink)] m-0 leading-tight">Your Cart</h2>
              <p className="text-xs text-[var(--c-muted)] m-0">
                {cart.count} {cart.count === 1 ? "item" : "items"} in bag
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close cart drawer"
            className="p-2 rounded-xl text-[var(--c-muted)] hover:text-[var(--c-ink)] hover:bg-[var(--c-line)] transition-colors focus:outline-hidden focus:ring-2 focus:ring-lime-400"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 2. Free Delivery Banner / Threshold */}
        {cart.count > 0 && (
          <div className="px-5 py-2.5 bg-lime-400/10 border-b border-lime-400/20 text-xs text-[var(--c-ink)]">
            <div className="flex items-center justify-between mb-1 font-medium">
              <span>
                {remainingForFreeShipping === 0 ? (
                  <strong className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    ✓ You qualified for Free Delivery!
                  </strong>
                ) : (
                  <span>
                    Add <strong>{money(remainingForFreeShipping)}</strong> more for <strong>Free Delivery</strong>
                  </span>
                )}
              </span>
              <span className="text-[11px] font-bold text-[var(--c-muted)]">{progressToFreeShipping}%</span>
            </div>
            <div className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-lime-500 transition-all duration-500 rounded-full"
                style={{ width: `${progressToFreeShipping}%` }}
              />
            </div>
          </div>
        )}

        {/* 3. Items List (Scrollable) */}
        <div className="cart-drawer-items flex-1 overflow-y-auto p-4 sm:p-5 divide-y divide-[var(--c-line)]">
          {cart.lines.length === 0 ? (
            <div className="py-16 px-4 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center text-[var(--c-muted)] mb-4">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="8" cy="21" r="1" />
                  <circle cx="19" cy="21" r="1" />
                  <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-[var(--c-ink)] mb-1">Your cart is empty</h3>
              <p className="text-xs text-[var(--c-muted)] max-w-xs mb-6">
                Looks like you haven't added anything to your cart yet. Discover our latest collections and top deals.
              </p>
              <Link
                href="/shop"
                onClick={handleClose}
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-[var(--c-ink)] text-[var(--bg-c)] text-xs font-bold hover:opacity-90 transition-opacity"
              >
                Start Shopping ↗
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.lines.map((line) => (
                <DrawerItem
                  key={`${line.productId}-${line.variantId || "base"}`}
                  line={line}
                  onCloseDrawer={handleClose}
                />
              ))}
            </div>
          )}
        </div>

        {/* 4. Sticky Drawer Footer */}
        {cart.lines.length > 0 && (
          <div className="cart-drawer-footer border-t border-[var(--c-line)] p-4 sm:p-5 bg-[var(--glass-solid)] space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--c-muted)]">Subtotal</span>
              <span className="text-xl font-black text-[var(--c-ink)] tracking-tight">{money(subtotal)}</span>
            </div>

            <p className="text-[11px] text-[var(--c-muted)] m-0 leading-tight">
              Taxes and shipping fees calculated at checkout. Cash on Delivery available across Bangladesh.
            </p>

            <div className="space-y-2 pt-1">
              <Link
                href="/checkout"
                onClick={handleClose}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-[#d8f45a] hover:bg-[#c9e847] text-slate-900 font-bold text-sm tracking-wide shadow-sm hover:shadow active:scale-[0.99] transition-all"
              >
                Proceed to Checkout
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Link>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full py-2.5 px-3 rounded-lg border border-[var(--c-line)] bg-transparent hover:bg-black/5 dark:hover:bg-white/5 text-[var(--c-ink)] text-xs font-semibold transition-colors"
                >
                  Continue Shopping
                </button>
                <Link
                  href="/cart"
                  onClick={handleClose}
                  className="w-full py-2.5 px-3 rounded-lg border border-[var(--c-line)] bg-transparent hover:bg-black/5 dark:hover:bg-white/5 text-[var(--c-ink)] text-xs font-semibold text-center transition-colors"
                >
                  View Full Cart ↗
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function DrawerItem({
  line,
  onCloseDrawer,
}: {
  line: CartLine;
  onCloseDrawer: () => void;
}) {
  const cart = useCart();
  const [imgError, setImgError] = useState(false);

  return (
    <article className="pt-3.5 first:pt-0 flex gap-3.5 items-start">
      {/* Thumbnail */}
      <Link
        href={`/product/${encodeURIComponent(line.slug)}`}
        onClick={onCloseDrawer}
        className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-[var(--c-line)] shrink-0 relative block"
      >
        {line.imageUrl && !imgError ? (
          <img
            src={line.imageUrl}
            alt={line.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
            🛍️
          </div>
        )}
      </Link>

      {/* Info & Quantity */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/product/${encodeURIComponent(line.slug)}`}
            onClick={onCloseDrawer}
            className="text-xs sm:text-sm font-semibold text-[var(--c-ink)] hover:underline line-clamp-2 leading-snug"
          >
            {line.name}
          </Link>

          <button
            type="button"
            onClick={() => cart.remove(line)}
            aria-label={`Remove ${line.name} from cart`}
            className="text-[var(--c-muted)] hover:text-red-500 p-1 -mr-1 transition-colors"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        </div>

        {line.variantName && (
          <p className="text-[11px] text-[var(--c-muted)] mt-0.5 mb-1.5 font-medium">
            {line.variantName}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 mt-2">
          <div className="inline-flex items-center border border-[var(--c-line)] rounded-lg bg-[var(--glass)] overflow-hidden h-7">
            <button
              type="button"
              onClick={() => {
                if (line.quantity > 1) {
                  cart.update(line, line.quantity - 1);
                } else {
                  cart.remove(line);
                }
              }}
              aria-label="Decrease quantity"
              className="w-7 h-full flex items-center justify-center text-xs font-bold text-[var(--c-ink)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              −
            </button>
            <span className="w-8 text-center text-xs font-bold text-[var(--c-ink)] select-none">
              {line.quantity}
            </span>
            <button
              type="button"
              onClick={() => cart.update(line, line.quantity + 1)}
              aria-label="Increase quantity"
              className="w-7 h-full flex items-center justify-center text-xs font-bold text-[var(--c-ink)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              +
            </button>
          </div>

          <span className="text-xs sm:text-sm font-bold text-[var(--c-ink)]">
            {money(line.price * line.quantity)}
          </span>
        </div>
      </div>
    </article>
  );
}
