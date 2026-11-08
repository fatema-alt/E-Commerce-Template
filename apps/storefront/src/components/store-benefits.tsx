"use client";

import Link from "next/link";
import { useLanguage } from "../lib/i18n";

export function StoreBenefits() {
  const { t } = useLanguage();

  return (
    <div className="container store-benefits" aria-label="Explore your store">
      <Link href="/categories">
        <span className="benefit-symbol" aria-hidden="true">↗</span>
        <span>
          <strong>{t("benefit_discovery_title")}</strong>
          <small>{t("benefit_discovery_sub")}</small>
        </span>
      </Link>
      <Link href="/wishlist">
        <span className="benefit-symbol" aria-hidden="true">♡</span>
        <span>
          <strong>{t("benefit_wishlist_title")}</strong>
          <small>{t("benefit_wishlist_sub")}</small>
        </span>
      </Link>
      <Link href="/orders">
        <span className="benefit-symbol" aria-hidden="true">↦</span>
        <span>
          <strong>{t("benefit_orders_title")}</strong>
          <small>{t("benefit_orders_sub")}</small>
        </span>
      </Link>
    </div>
  );
}
