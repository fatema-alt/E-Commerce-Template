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
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: { label: string; href: string; icon: LucideIcon }[];
};

const navigation: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  {
    label: "Homepage Builder",
    href: "/cms/pages?key=home",
    icon: Sparkles,
  },
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
  { label: "Orders", href: "/orders", icon: ShoppingCart },
  { label: "Promotions", href: "/promotions", icon: Tag },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Reviews & Q&A", href: "/reviews", icon: Star },
  {
    label: "Storefront CMS",
    href: "/cms",
    icon: LayoutDashboard,
    children: [
      { label: "Homepage Builder", href: "/cms/pages?key=home", icon: Sparkles },
      { label: "All Pages", href: "/cms/pages", icon: List },
      { label: "Theme Customizer", href: "/cms/theme", icon: Palette },
      { label: "Navigation Menus", href: "/cms/navigation", icon: FolderTree },
      { label: "Media Library", href: "/cms/media", icon: ImageIcon },
      { label: "Site Settings", href: "/cms/settings", icon: Settings },
      { label: "Announcement Bar", href: "/cms/announcements", icon: Sparkles },
      { label: "Floating Contact Widget", href: "/cms/contact-widget", icon: Users },
      { label: "Tracking & Pixels", href: "/cms/tracking", icon: Activity },
    ],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    children: [
      { label: "Payment Gateways", href: "/settings/payments", icon: CreditCard },
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "/products": true,
    "/categories": true,
    "/cms": true,
    "/settings": true,
  });

  return (
    <>
      {open && (
        <button
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-18 items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-lg font-extrabold text-indigo-600">
              Commerce Suite
            </p>
            <p className="text-xs text-slate-500">Admin Workspace</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close sidebar"
            className="lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <nav
          aria-label="Main navigation"
          className="flex-1 space-y-1 overflow-y-auto p-4"
        >
          {navigation.map((item) => {
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
              const groupId = `sidebar-${item.label.toLowerCase()}`;
              return (
                <div key={item.href}>
                  <button
                    type="button"
                    aria-expanded={expanded[item.href]}
                    aria-controls={groupId}
                    onClick={() =>
                      setExpanded((previous) => ({
                        ...previous,
                        [item.href]: !previous[item.href],
                      }))
                    }
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`}
                  >
                    <Icon size={19} />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown
                      size={16}
                      className={`transition-transform ${expanded[item.href] ? "rotate-180" : ""}`}
                    />
                  </button>
                  <ul
                    id={groupId}
                    hidden={!expanded[item.href]}
                    className="ml-6 mt-1 space-y-1 border-l border-slate-200 pl-3"
                  >
                    {item.children.map((child) => {
                      const ChildIcon = child.icon;
                      const childPath = child.href.split("?")[0];
                      const childActive =
                        pathname === child.href ||
                        (child.href.includes("?") && pathname === childPath) ||
                        (child.href === item.href &&
                          pathname.startsWith(item.href + "/") &&
                          pathname !== item.href + "/add");
                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            onClick={onClose}
                            aria-current={childActive ? "page" : undefined}
                            className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${childActive ? "bg-indigo-50 font-semibold text-indigo-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`}
                          >
                            <ChildIcon size={15} />
                            {child.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon size={19} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4 text-xs text-slate-500">
          Commerce Suite · Development
        </div>
      </aside>
    </>
  );
}
