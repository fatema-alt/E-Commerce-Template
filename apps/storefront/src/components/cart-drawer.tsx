"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CartCheckout } from "./cart-checkout";
import { useLanguage } from "../lib/i18n";

/** Native modal supplies focus containment, Escape handling and focus restoration. */
export function CartDrawer() {
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const [loaded, setLoaded] = useState(false);
  const { t } = useLanguage();
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const open = () => {
      setLoaded(true);
      if (!element.open) element.showModal();
    };
    const click = (event: MouseEvent) => {
      const anchor =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (
        anchor &&
        new URL(anchor.href, location.href).origin === location.origin &&
        new URL(anchor.href, location.href).pathname === "/cart" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        event.button === 0
      ) {
        event.preventDefault();
        event.stopPropagation();
        open();
      } else if (anchor && element.contains(anchor)) element.close();
    };
    document.addEventListener("click", click, true);
    window.addEventListener("ds-open-cart", open);
    return () => {
      document.removeEventListener("click", click, true);
      window.removeEventListener("ds-open-cart", open);
    };
  }, []);
  useEffect(() => {
    dialog.current?.close();
  }, [pathname]);
  return (
    <dialog
      ref={dialog}
      id="shopping-bag-drawer"
      className="cart-drawer"
      aria-label={t("drawer_title")}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <div className="cart-drawer-content">
        <header className="cart-drawer-heading">
          <strong>{t("drawer_title")}</strong>
          <button
            type="button"
            className="secondary-button"
            aria-label="Close cart"
            onClick={() => dialog.current?.close()}
          >
            ✕
          </button>
        </header>
        {loaded && <CartCheckout drawer />}
      </div>
    </dialog>
  );
}
