"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Boxes,
  ShoppingCart,
  Users,
  Tag,
  Star,
  Settings,
  CreditCard,
  X,
  ChevronDown,
  Plus,
  List,
  Sparkles,
  Palette,
  Image as ImageIcon,
  Activity,
  Truck,
  ClipboardList,
  Wallet,
  Receipt,
  ShieldCheck,
  User,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { useAdminAuth, type AdminRole } from "@/lib/auth-context";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: AdminRole[];
  children?: { label: string; href: string; icon: LucideIcon; roles?: AdminRole[] }[];
};

// Canonical deduplicated navigation items:
// 1. "Homepage Builder" lives exclusively inside Storefront CMS.
// 2. "Site Settings" and "Tracking & Pixels" live exclusively under Settings.
const navigation: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Orders", href: "/orders", icon: ShoppingCart },
  {
    label: "Products",
    href: "/products",
    icon: Package,
    children: [
      { label: "Add Product", href: "/products/add", icon: Plus },
      { label: "All Products", href: "/products", icon: List },
    ],
  },
  {
    label: "Categories",
    href: "/categories",
    icon: FolderTree,
    children: [
      { label: "Add Category", href: "/categories/add", icon: Plus },
      { label: "All Categories", href: "/categories", icon: List },
    ],
  },
  { label: "Inventory", href: "/inventory", icon: Boxes },
  { label: "Customers", href: "/customers", icon: Users, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
  { label: "Reports", href: "/reports", icon: BarChart3, roles: ["SUPER_ADMIN", "ADMIN"] },
  {
    label: "Finance",
    href: "/finance",
    icon: Wallet,
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    children: [
      { label: "Expense Ledger", href: "/finance/expenses", icon: Receipt },
      { label: "Categories", href: "/finance/categories", icon: FolderTree },
    ],
  },
  {
    label: "Purchasing",
    href: "/purchasing",
    icon: Truck,
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    children: [
      { label: "Purchase Orders", href: "/purchasing", icon: ClipboardList },
      { label: "New Order", href: "/purchasing/new", icon: Plus },
      { label: "Suppliers", href: "/purchasing/suppliers", icon: Users },
      { label: "Goods Receipts", href: "/purchasing/receipts", icon: Boxes },
    ],
  },
  { label: "Promotions", href: "/promotions", icon: Tag, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
  { label: "Reviews & Q&A", href: "/reviews", icon: Star },
  {
    label: "Storefront CMS",
    href: "/cms",
    icon: Palette,
    roles: ["SUPER_ADMIN", "ADMIN"],
    children: [
      {
        label: "Homepage Builder",
        href: "/cms/pages?key=home",
        icon: Sparkles,
      },
      { label: "All Pages", href: "/cms/pages", icon: List },
      { label: "Theme Customizer", href: "/cms/theme", icon: Palette },
      { label: "Navigation Menus", href: "/cms/navigation", icon: FolderTree },
      { label: "Media Library", href: "/cms/media", icon: ImageIcon },
      { label: "Announcement Bar", href: "/cms/announcements", icon: Sparkles },
      {
        label: "Floating Contact Widget",
        href: "/cms/contact-widget",
        icon: Users,
      },
    ],
  },
  {
    label: "Team & Roles",
    href: "/team",
    icon: ShieldCheck,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["SUPER_ADMIN", "ADMIN"],
    children: [
      { label: "Payments", href: "/settings/payments", icon: CreditCard },
      {
        label: "Couriers & Tracking",
        href: "/settings/couriers",
        icon: Activity,
      },
      { label: "Site Settings", href: "/cms/settings", icon: Settings },
      { label: "Tracking & Pixels", href: "/cms/tracking", icon: Activity },
    ],
  },
];

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { user, loading } = useAdminAuth();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "/products": false,
    "/categories": false,
    "/purchasing": false,
    "/finance": false,
    "/cms": false,
    "/settings": false,
  });

  const visibleNavigation = navigation.filter((item) => {
    if (!item.roles) return true;
    if (loading) return true;
    return user ? item.roles.includes(user.role) : true;
  });

  return (
    <>
      {/* Mobile Backdrop */}
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar: Mobile drawer (<768px), Tablet icon rail (768px-1023px), Desktop full (>=1024px) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 bg-white transition-all duration-300 dark:border-white/10 dark:bg-[#121A30] ${
          open
            ? "w-64 translate-x-0 shadow-2xl"
            : "-translate-x-full md:translate-x-0 md:w-20 lg:w-64"
        }`}
      >
        {/* Header Branding */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/[0.07] md:justify-center lg:justify-between lg:px-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-[#FF7900] rounded-lg"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FF7900] text-white shadow-sm shadow-[#FF7900]/30">
              <ShoppingCart size={18} />
            </div>
            <div className="block md:hidden lg:block">
              <p className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                Commerce Suite
              </p>
              <p className="text-[10px] font-medium text-slate-400 dark:text-slate-400">
                Admin Workspace
              </p>
            </div>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white md:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation list */}
        <nav
          aria-label="Main navigation"
          className="flex-1 space-y-1 overflow-y-auto px-3 py-3 [scrollbar-width:thin]"
        >
          {visibleNavigation.map((item) => {
            const Icon = item.icon;
            const itemPath = item.href.split("?")[0];
            const active =
              item.href === "/"
                ? pathname === "/"
                : item.href.includes("?")
                  ? pathname === itemPath
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

            if (item.children) {
              const isGroupExpanded = expanded[item.href] || active;
              const groupId = `sidebar-${item.label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;

              return (
                <div key={item.href} className="space-y-1">
                  <button
                    type="button"
                    aria-expanded={isGroupExpanded}
                    aria-controls={groupId}
                    title={item.label}
                    onClick={() =>
                      setExpanded((prev) => ({
                        ...prev,
                        [item.href]: !isGroupExpanded,
                      }))
                    }
                    className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7900] md:justify-center lg:justify-start ${
                      active
                        ? "bg-[#FF7900] text-white font-semibold shadow-sm shadow-[#FF7900]/25"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                    }`}
                  >
                    <Icon
                      size={19}
                      className={`shrink-0 transition-colors ${
                        active
                          ? "text-white"
                          : "text-slate-400 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200"
                      }`}
                    />
                    <span className="flex-1 text-left block md:hidden lg:block truncate">
                      {item.label}
                    </span>
                    {item.label === "Orders" && (
                      <span
                        className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold block md:hidden lg:block ${
                          active ? "bg-white/20 text-white" : "bg-[#FF7900] text-white"
                        }`}
                      >
                        7
                      </span>
                    )}
                    <ChevronDown
                      size={15}
                      className={`block shrink-0 transition-transform md:hidden lg:block ${
                        isGroupExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Submenu links */}
                  {isGroupExpanded && (
                    <ul
                      id={groupId}
                      className="ml-4 space-y-1 border-l border-slate-200 pl-2.5 dark:border-white/10 md:hidden lg:block"
                    >
                      {item.children.map((child) => {
                        const ChildIcon = child.icon;
                        const childPath = child.href.split("?")[0];
                        const childActive =
                          pathname === child.href ||
                          (child.href.includes("?") &&
                            pathname === childPath) ||
                          (child.href === item.href &&
                            pathname.startsWith(item.href + "/") &&
                            pathname !== item.href + "/add");

                        return (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              onClick={onClose}
                              aria-current={childActive ? "page" : undefined}
                              className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7900] ${
                                childActive
                                  ? "bg-[#FF7900]/15 font-bold text-[#FF7900]"
                                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100"
                              }`}
                            >
                              <ChildIcon size={14} className="shrink-0" />
                              <span className="truncate">{child.label}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                title={item.label}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7900] md:justify-center lg:justify-start ${
                  active
                    ? "bg-[#FF7900] text-white font-semibold shadow-sm shadow-[#FF7900]/25"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                }`}
              >
                <Icon
                  size={19}
                  className={`shrink-0 ${
                    active
                      ? "text-white"
                      : "text-slate-400 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200"
                  }`}
                />
                <span className="block md:hidden lg:block truncate">
                  {item.label}
                </span>
                {item.label === "Orders" && (
                  <span
                    className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold block md:hidden lg:block ${
                      active ? "bg-white/20 text-white" : "bg-[#FF7900] text-white"
                    }`}
                  >
                    7
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer info & Current user role */}
        <div className="border-t border-slate-200 p-3 text-[11px] text-slate-400 dark:border-white/10 dark:text-slate-400 block md:hidden lg:block">
          {user && (
            <Link
              href="/profile"
              onClick={onClose}
              className="flex items-center gap-2 mb-2.5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition group"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#FF7900] text-[11px] font-bold text-white shadow-xs">
                {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-[#FF7900]">
                  {user.name || user.email.split("@")[0]}
                </p>
                <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider font-medium">
                  {user.role.replace(/_/g, " ")}
                </p>
              </div>
            </Link>
          )}
          <p className="font-semibold text-slate-600 dark:text-slate-300">
            Commerce Suite
          </p>
          <p className="text-[10px]">v1.0 · Asia/Dhaka (UTC+6)</p>
        </div>
      </aside>
    </>
  );
}
