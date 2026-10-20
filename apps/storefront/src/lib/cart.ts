"use client";
import { useMemo, useSyncExternalStore } from "react";
import type { Product } from "./storefront";
export type CartLine = {
  productId: string;
  variantId?: string;
  slug: string;
  name: string;
  variantName?: string;
  quantity: number;
  price: number;
  imageUrl?: string | null;
};
const key = "commerce-cart-v1";
const event = "commerce-cart-change";
function snapshot() {
  try {
    return localStorage.getItem(key) || "[]";
  } catch {
    return "[]";
  }
}
function parse(raw: string): CartLine[] {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .slice(0, 100)
      .filter(
        (row): row is CartLine =>
          !!row &&
          typeof row.productId === "string" &&
          typeof row.slug === "string" &&
          typeof row.name === "string" &&
          (row.variantName === undefined ||
            typeof row.variantName === "string") &&
          (row.imageUrl == null || typeof row.imageUrl === "string") &&
          (row.variantId === undefined || typeof row.variantId === "string") &&
          Number.isSafeInteger(row.quantity) &&
          row.quantity > 0 &&
          row.quantity <= 10000 &&
          typeof row.price === "number" &&
          Number.isFinite(row.price) &&
          row.price >= 0,
      );
  } catch {
    return [];
  }
}
function write(lines: CartLine[]) {
  localStorage.setItem(key, JSON.stringify(lines));
  window.dispatchEvent(new Event(event));
}
/** Repair only obsolete variant references on an authoritative SIMPLE product. */
export function repairSimpleCart(product: Product): boolean {
  if (product.type !== "SIMPLE") return false;
  const current = parse(snapshot());
  const matching = current.filter((line) => line.productId === product.id);
  if (!matching.some((line) => line.variantId)) return false;
  const quantity = matching.reduce((sum, line) => sum + line.quantity, 0);
  if (quantity > 10000)
    throw new Error("Review this product's quantity in your cart.");
  const replacement: CartLine = {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    quantity,
    price: product.price,
    imageUrl: product.imageUrl,
  };
  const next: CartLine[] = [];
  let inserted = false;
  for (const line of current) {
    if (line.productId !== product.id) next.push(line);
    else if (!inserted) {
      next.push(replacement);
      inserted = true;
    }
  }
  write(next);
  return true;
}
const same = (
  a: Pick<CartLine, "productId" | "variantId">,
  b: Pick<CartLine, "productId" | "variantId">,
) => a.productId === b.productId && a.variantId === b.variantId;
function subscribe(callback: () => void) {
  window.addEventListener(event, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(event, callback);
    window.removeEventListener("storage", callback);
  };
}
export function useCart() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  const lines = useMemo(() => parse(raw), [raw]);
  return {
    lines,
    count: lines.reduce((sum, row) => sum + row.quantity, 0),
    add(line: CartLine, stockLimit = 10000) {
      if (
        !Number.isSafeInteger(line.quantity) ||
        line.quantity < 1 ||
        line.quantity > 10000
      )
        throw new Error("Enter a whole quantity between 1 and 10,000.");
      const current = parse(snapshot());
      const existing = current.find((row) => same(row, line));
      if (
        line.quantity + (existing?.quantity ?? 0) >
        Math.min(10000, stockLimit)
      )
        throw new Error(
          "The requested quantity exceeds the available stock. Review your cart.",
        );
      if (!existing && current.length >= 100)
        throw new Error("Your cart can contain at most 100 products.");
      write(
        existing
          ? current.map((row) =>
              same(row, line)
                ? {
                    ...line,
                    quantity: Math.min(10000, row.quantity + line.quantity),
                  }
                : row,
            )
          : [...current, line],
      );
    },
    update(line: CartLine, quantity: number) {
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000)
        return;
      write(
        parse(snapshot()).map((row) =>
          same(row, line) ? { ...row, quantity } : row,
        ),
      );
    },
    remove(line: CartLine) {
      write(parse(snapshot()).filter((row) => !same(row, line)));
    },
    clear() {
      write([]);
    },
  };
}
