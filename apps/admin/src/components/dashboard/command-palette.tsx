"use client";

import { useEffect, useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  LayoutDashboard,
  Package,
  FolderTree,
  Boxes,
  ShoppingCart,
  Users,
  Star,
  Settings,
  CreditCard,
  Plus,
  ArrowRight,
} from "lucide-react";

type SearchItem = {
  id: string;
  title: string;
  category: "Navigation" | "Actions" | "Products" | "Orders";
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  description?: string;
};

const DEFAULT_ITEMS: SearchItem[] = [
  { id: "nav-dash", title: "Dashboard Overview", category: "Navigation", href: "/", icon: LayoutDashboard },
  { id: "nav-orders", title: "Manage Orders", category: "Navigation", href: "/orders", icon: ShoppingCart },
  { id: "nav-orders-pending", title: "Pending Orders", category: "Orders", href: "/orders?status=PENDING", icon: ShoppingCart, description: "Requires confirmation" },
  { id: "nav-products", title: "Product Catalog", category: "Navigation", href: "/products", icon: Package },
  { id: "act-add-product", title: "Add New Product", category: "Actions", href: "/products/add", icon: Plus },
  { id: "nav-categories", title: "Categories Directory", category: "Navigation", href: "/categories", icon: FolderTree },
  { id: "act-add-category", title: "Add New Category", category: "Actions", href: "/categories/add", icon: Plus },
  { id: "nav-inventory", title: "Inventory & Stock Levels", category: "Navigation", href: "/inventory", icon: Boxes },
  { id: "nav-customers", title: "Customer Records", category: "Navigation", href: "/customers", icon: Users },
  { id: "nav-reviews", title: "Product Reviews & Q&A", category: "Navigation", href: "/reviews", icon: Star },
  { id: "nav-payments", title: "Payment Gateway Settings", category: "Actions", href: "/settings/payments", icon: CreditCard, description: "bKash, Nagad, SSLCommerz" },
  { id: "nav-cms", title: "Storefront CMS Pages", category: "Navigation", href: "/cms/pages", icon: Settings },
  { id: "nav-tracking", title: "Tracking & Pixels", category: "Actions", href: "/cms/tracking", icon: Settings },
];

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        setQuery("");
        setSelectedIndex(0);
        inputRef.current?.focus();
      }, 20);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onClose();
      }
      if (!open) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const filtered = query.trim()
    ? DEFAULT_ITEMS.filter((item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.category.toLowerCase().includes(query.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(query.toLowerCase())),
      )
    : DEFAULT_ITEMS;

  function handleSelect(item: SearchItem) {
    onClose();
    startTransition(() => {
      router.push(item.href);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(filtered.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(filtered.length, 1));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      handleSelect(filtered[selectedIndex]);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global search command palette"
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-white/10 dark:bg-[#121A30]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3.5 dark:border-white/10">
          <Search size={18} className="text-slate-400 dark:text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search orders, products, customers, pages (type to filter)..."
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white dark:placeholder:text-slate-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X size={14} />
            </button>
          )}
          <kbd className="hidden sm:inline-block rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 [scrollbar-width:thin]">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <ul className="space-y-1">
              {filtered.map((item, index) => {
                const Icon = item.icon;
                const isSelected = index === selectedIndex;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-sm transition-colors ${
                        isSelected
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300"
                          }`}
                        >
                          <Icon size={16} />
                        </span>
                        <div className="truncate">
                          <p className="font-medium truncate">{item.title}</p>
                          {item.description && (
                            <p
                              className={`text-xs truncate ${
                                isSelected ? "text-white/80" : "text-slate-400 dark:text-slate-400"
                              }`}
                            >
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400"
                          }`}
                        >
                          {item.category}
                        </span>
                        <ArrowRight
                          size={14}
                          className={`transition-transform ${isSelected ? "translate-x-0.5" : "opacity-0"}`}
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5 text-[11px] text-slate-400 dark:border-white/10 dark:text-slate-400">
          <span>Navigate with &uarr; &darr; keys</span>
          <span>Press Enter to select</span>
        </div>
      </div>
    </div>
  );
}
