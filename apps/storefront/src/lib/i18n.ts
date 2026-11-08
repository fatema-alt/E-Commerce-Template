"use client";

import { useSyncExternalStore, useCallback } from "react";

export type Locale = "en" | "bn";

export const LOCALE_STORAGE_KEY = "commerce-storefront-locale";
export const LOCALE_EVENT = "commerce-locale-change";

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

/** Converts English digits 0-9 into Bengali digits ০-৯ */
export function toBengaliNumerals(val: string | number): string {
  return String(val).replace(/\d/g, (d) => BN_DIGITS[Number(d)] || d);
}

/** Formats a numeric price in BDT according to locale */
export function formatCurrency(
  value: number | string | null | undefined,
  locale: Locale = "en",
  showDecimals = false,
): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";

  const formattedEn = new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(num);

  if (locale === "bn") {
    return `৳${toBengaliNumerals(formattedEn)}`;
  }
  return `৳${formattedEn}`;
}

export const DICTIONARY = {
  // Brand & Header
  site_tagline: {
    en: "Shop smart. Live smart.",
    bn: "Shop smart. Live smart.",
  },
  search_placeholder: {
    en: "Search products, brands and departments…",
    bn: "পণ্য, ব্র্যান্ড বা ক্যাটাগরি অনুসন্ধান করুন…",
  },
  search_btn: {
    en: "Search",
    bn: "খুঁজুন",
  },
  search_suggestions: {
    en: "Product suggestions",
    bn: "প্রস্তাবিত পণ্যসমূহ",
  },
  searching_catalog: {
    en: "Searching the catalog…",
    bn: "অনুসন্ধান করা হচ্ছে…",
  },
  no_matching_products: {
    en: "No matching products found.",
    bn: "কোনো পণ্য পাওয়া যায়নি।",
  },

  // Navigation Links
  nav_shop_all: {
    en: "Shop all",
    bn: "সকল পণ্য",
  },
  nav_categories: {
    en: "Browse categories",
    bn: "ক্যাটাগরি সমূহ",
  },
  nav_wishlist: {
    en: "Your wishlist",
    bn: "পছন্দের তালিকা",
  },
  nav_track: {
    en: "Track order",
    bn: "অর্ডার ট্র্যাক",
  },
  nav_help: {
    en: "Shopping help",
    bn: "সহায়তা",
  },
  nav_account: {
    en: "Account",
    bn: "অ্যাকাউন্ট",
  },
  nav_cart: {
    en: "Cart",
    bn: "ব্যাগ",
  },

  // Department Bento Section
  dept_section_title: {
    en: "Shop by Department",
    bn: "বিভাগ অনুযায়ী কেনাকাটা",
  },
  dept_section_subtitle: {
    en: "Explore our curated lifestyle collections and everyday essentials.",
    bn: "আমাদের বাছাইকৃত লাইফস্টাইল পণ্য ও নিত্যপ্রয়োজনীয় সামগ্রী ঘুরে দেখুন।",
  },
  dept_view_all: {
    en: "View All Categories",
    bn: "সব ক্যাটাগরি দেখুন",
  },
  dept_products_suffix: {
    en: "Products",
    bn: "টি পণ্য",
  },

  // Brand Slider
  brands_title: {
    en: "Explore Top Brands",
    bn: "শীর্ষ ব্র্যান্ডসমূহ",
  },
  brands_subtitle: {
    en: "Trusted partners & manufacturers",
    bn: "জনপ্রিয় ও বিশ্বস্ত ব্র্যান্ড",
  },

  // Product Card & Catalog
  card_quick_add: {
    en: "Quick Add",
    bn: "ব্যাগে যোগ করুন",
  },
  card_added: {
    en: "Added to Cart!",
    bn: "ব্যাগে যোগ হয়েছে!",
  },
  card_in_stock: {
    en: "In Stock",
    bn: "স্টকে আছে",
  },
  card_out_of_stock: {
    en: "Out of Stock",
    bn: "স্টক শেষ",
  },
  card_unavailable: {
    en: "Unavailable",
    bn: "অনুপলব্ধ",
  },
  card_save_wishlist: {
    en: "Save to wishlist",
    bn: "পছন্দের তালিকায় রাখুন",
  },
  card_remove_wishlist: {
    en: "Remove from wishlist",
    bn: "পছন্দের তালিকা থেকে সরান",
  },

  // Product Detail Page (PDP)
  pdp_add_to_cart: {
    en: "Add to cart",
    bn: "ব্যাগে যোগ করুন",
  },
  pdp_adding: {
    en: "Adding…",
    bn: "যোগ হচ্ছে…",
  },
  pdp_buy_now: {
    en: "Buy now",
    bn: "এখনই কিনুন",
  },
  pdp_in_stock: {
    en: "In stock and ready to ship",
    bn: "স্টকে আছে, দ্রুত ডেলিভারি",
  },
  pdp_out_of_stock: {
    en: "Currently out of stock",
    bn: "বর্তমানে স্টক শেষ",
  },
  pdp_sold_out: {
    en: "Sold out",
    bn: "স্টক শেষ",
  },
  pdp_view_cart: {
    en: "View cart →",
    bn: "ব্যাগ দেখুন →",
  },
  pdp_save: {
    en: "You save",
    bn: "সাশ্রয়",
  },
  pdp_per_item: {
    en: "per item",
    bn: "প্রতিটিতে",
  },

  // Shopping Bag Drawer
  drawer_title: {
    en: "DS Mart · Shopping bag",
    bn: "DS Mart · শপিং ব্যাগ",
  },
  drawer_empty: {
    en: "Your shopping bag is empty",
    bn: "আপনার শপিং ব্যাগটি খালি",
  },
  drawer_subtotal: {
    en: "Subtotal",
    bn: "মোট মূল্য",
  },
  drawer_note: {
    en: "Delivery & discounts calculated at checkout",
    bn: "ডেলিভারি চার্জ ও ছাড় চেকআউটে যুক্ত হবে",
  },
  drawer_checkout_btn: {
    en: "Proceed to checkout",
    bn: "চেকআউট করুন",
  },
  drawer_continue: {
    en: "Continue shopping",
    bn: "কেনাকাটা চালিয়ে যান",
  },
  drawer_remove: {
    en: "Remove",
    bn: "মুছুন",
  },
  drawer_qty: {
    en: "Quantity",
    bn: "পরিমাণ",
  },

  // Trust Benefits
  benefit_discovery_title: {
    en: "More to discover",
    bn: "নতুন কিছু খুঁজুন",
  },
  benefit_discovery_sub: {
    en: "Find your everyday favourites",
    bn: "প্রতিদিনের প্রয়োজনীয় পছন্দের পণ্য",
  },
  benefit_wishlist_title: {
    en: "Save what you love",
    bn: "পছন্দের পণ্য সেভ রাখুন",
  },
  benefit_wishlist_sub: {
    en: "Keep your favourites in one place",
    bn: "সহজেই খুঁজে পেতে উইশলিস্টে রাখুন",
  },
  benefit_orders_title: {
    en: "Your orders, in view",
    bn: "অর্ডার ট্র্যাকিং ও হিস্ট্রি",
  },
  benefit_orders_sub: {
    en: "Follow your shopping journey",
    bn: "রিয়েল-টাইমে ডেলিভারি আপডেট জানুন",
  },

  // Footer Links & Info
  footer_tagline: {
    en: "Shop smart. Live smart.",
    bn: "Shop smart. Live smart.",
  },
  footer_desc: {
    en: "Everyday essentials and fresh discoveries, delivered.",
    bn: "দৈনন্দিন প্রয়োজনীয় ও সেরা পণ্য, আপনার দোরগোড়ায়।",
  },
  footer_customer_care: {
    en: "Customer care",
    bn: "গ্রাহক সেবা",
  },
  footer_explore: {
    en: "Explore DS Mart",
    bn: "ডিএস মার্ট এক্সপ্লোর",
  },
  footer_shopping_help: {
    en: "Shopping help",
    bn: "সহায়তা কেন্দ্র",
  },
  footer_contact_us: {
    en: "Contact us",
    bn: "যোগাযোগ করুন",
  },
  footer_track_order: {
    en: "Track your order",
    bn: "অর্ডার ট্র্যাক করুন",
  },
  footer_your_account: {
    en: "Your account",
    bn: "আপনার অ্যাকাউন্ট",
  },
  footer_all_products: {
    en: "All products",
    bn: "সকল পণ্য",
  },
  footer_by_category: {
    en: "Shop by category",
    bn: "ক্যাটাগরি ব্রাউজ করুন",
  },
  footer_saved: {
    en: "Saved favourites",
    bn: "পছন্দের তালিকা",
  },
  footer_bag: {
    en: "Your shopping bag",
    bn: "আপনার শপিং ব্যাগ",
  },
  footer_rights: {
    en: "All rights reserved.",
    bn: "সর্বস্বত্ব সংরক্ষিত।",
  },
} as const;

export type TranslationKey = keyof typeof DICTIONARY;

let fallbackLocale: Locale | null = null;

export function readLocale(): Locale {
  if (fallbackLocale) return fallbackLocale;
  if (typeof window === "undefined") return "en";
  try {
    const val = localStorage.getItem(LOCALE_STORAGE_KEY);
    return val === "bn" || val === "en" ? val : "en";
  } catch {
    return "en";
  }
}

export function applyLocale(next: Locale) {
  fallbackLocale = next;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, next);
    // Set cookie for 1 year so server/middleware can also read it
    document.cookie = `commerce_locale=${next}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {}

  if (typeof document !== "undefined") {
    document.documentElement.lang = next;
    document.documentElement.dataset.locale = next;
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(LOCALE_EVENT, { detail: next }));
  }
}

function subscribeLocale(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  const handleUpdate = () => {
    callback();
  };

  window.addEventListener("storage", handleUpdate);
  window.addEventListener(LOCALE_EVENT, handleUpdate);

  return () => {
    window.removeEventListener("storage", handleUpdate);
    window.removeEventListener(LOCALE_EVENT, handleUpdate);
  };
}

export function useLanguage() {
  const locale = useSyncExternalStore<Locale>(
    subscribeLocale,
    readLocale,
    () => "en",
  );

  const setLocale = useCallback((next: Locale) => {
    applyLocale(next);
  }, []);

  const toggleLocale = useCallback(() => {
    const next: Locale = locale === "bn" ? "en" : "bn";
    applyLocale(next);
  }, [locale]);

  const t = useCallback(
    (key: TranslationKey, fallback?: string): string => {
      const entry = DICTIONARY[key];
      if (entry && entry[locale]) {
        return entry[locale];
      }
      return fallback || key;
    },
    [locale],
  );

  const formatPrice = useCallback(
    (val: number | string | null | undefined, showDecimals = false) => {
      return formatCurrency(val, locale, showDecimals);
    },
    [locale],
  );

  const formatNumber = useCallback(
    (val: number | string) => {
      if (locale === "bn") return toBengaliNumerals(val);
      return String(val);
    },
    [locale],
  );

  return {
    locale,
    setLocale,
    toggleLocale,
    t,
    formatPrice,
    formatNumber,
    isBn: locale === "bn",
    isEn: locale === "en",
  };
}
