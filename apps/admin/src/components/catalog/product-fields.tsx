"use client";
import { control } from "./catalog-ui";

export const extraDefaults = {
  type: "SIMPLE",
  status: "DRAFT",
  barcode: "",
  manufacturer: "",
  tags: "",
  collections: "",
  internalNotes: "",
  isVisible: true,
  isFeatured: false,
  costPrice: "",
  compareAtPrice: "",
  saleStartsAt: "",
  saleEndsAt: "",
  currency: "BDT",
  taxClass: "standard",
  taxInclusive: false,
  trackInventory: true,
  backorderPolicy: "DENY",
  requiresShipping: true,
  shippingClass: "",
  freeShipping: false,
  weight: "",
  length: "",
  width: "",
  height: "",
  weightUnit: "kg",
  dimensionUnit: "cm",
  countryOfOrigin: "",
  hsCode: "",
  canonicalUrl: "",
  noIndex: false,
  socialTitle: "",
  socialDescription: "",
  socialImage: "",
  options: "[]",
};
export type ExtraFields = typeof extraDefaults;
type Key = keyof ExtraFields;
export function extraFromProduct(product: object): ExtraFields {
  const source = product as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(extraDefaults).map(([key, fallback]) => [
      key,
      key === "tags" || key === "collections"
        ? ((source[key] as string[]) ?? []).join(", ")
        : key === "options"
          ? JSON.stringify(source.options ?? [], null, 2)
          : key === "saleStartsAt" || key === "saleEndsAt"
            ? source[key]
              ? new Date(String(source[key])).toISOString().slice(0, 16)
              : ""
            : (source[key] ?? fallback),
    ]),
  ) as ExtraFields;
}
export function extraPayload(fields: ExtraFields) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      key === "tags" || key === "collections"
        ? String(value)
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean)
        : key === "options"
          ? JSON.parse(String(value))
          : key === "saleStartsAt" || key === "saleEndsAt"
            ? value
              ? new Date(String(value) + "Z").toISOString()
              : null
            : value === ""
              ? null
              : value,
    ]),
  );
}

export function ProductFields({
  tab,
  value,
  onChange,
  regularPrice,
}: {
  tab: string;
  value: ExtraFields;
  onChange: (value: ExtraFields) => void;
  regularPrice: string;
}) {
  let margin = "";
  if (
    /^\d+(\.\d{1,2})?$/.test(regularPrice) &&
    /^\d+(\.\d{1,2})?$/.test(value.costPrice)
  ) {
    const cents = (text: string) => {
      const [whole, fraction = ""] = text.split(".");
      return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
    };
    const price = cents(regularPrice);
    if (price > BigInt(0)) {
      const percent =
        ((price - cents(value.costPrice)) * BigInt(10000)) / price;
      margin = (Number(percent) / 100).toFixed(2) + "%";
    }
  }
  const text = (key: Key, label: string, type = "text", maxLength = 200) => (
    <label key={key} className="space-y-2 text-sm font-medium">
      {label}
      <input
        className={control}
        type={type}
        min={type === "number" ? "0" : undefined}
        step={
          type === "number"
            ? ["costPrice", "compareAtPrice"].includes(key)
              ? ".01"
              : ".001"
            : undefined
        }
        maxLength={maxLength}
        value={String(value[key])}
        onChange={(e) => onChange({ ...value, [key]: e.target.value })}
      />
    </label>
  );
  const check = (key: Key, label: string) => (
    <label key={key} className="flex items-center gap-3 text-sm">
      <input
        type="checkbox"
        checked={Boolean(value[key])}
        onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
      />
      {label}
    </label>
  );
  const select = (key: Key, label: string, options: string[]) => (
    <label className="space-y-2 text-sm font-medium">
      {label}
      <select
        className={control}
        value={String(value[key])}
        onChange={(e) => onChange({ ...value, [key]: e.target.value })}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
  return (
    <>
      {tab === "general" && (
        <>
          {select("type", "Product type", ["SIMPLE", "VARIABLE"])}
          {text("barcode", "Barcode / GTIN / UPC / EAN", "text", 100)}
          {text("manufacturer", "Manufacturer", "text", 150)}
          {text("tags", "Tags (comma separated)", "text", 5000)}
          {text("collections", "Collections (comma separated)", "text", 5000)}
          <label className="space-y-2 text-sm font-medium md:col-span-2">
            Internal notes
            <textarea
              className={control}
              rows={3}
              maxLength={5000}
              value={value.internalNotes}
              onChange={(e) =>
                onChange({ ...value, internalNotes: e.target.value })
              }
            />
          </label>
        </>
      )}
      {tab === "pricing" && (
        <>
          {text("costPrice", "Cost price (administrators only)", "number")}
          {text("compareAtPrice", "Compare-at price", "number")}
          {margin && (
            <p className="text-sm text-indigo-600 md:col-span-2">
              Gross margin at regular price: {margin}
            </p>
          )}
          {text("saleStartsAt", "Sale starts (UTC)", "datetime-local")}
          {text("saleEndsAt", "Sale ends (UTC)", "datetime-local")}
          {text("currency", "Currency (ISO 4217)", "text", 3)}
          {text("taxClass", "Tax class", "text", 50)}
          {check("taxInclusive", "Prices include tax")}
        </>
      )}
      {tab === "inventory" && (
        <>
          {check("trackInventory", "Track inventory")}
          {select("backorderPolicy", "Backorder policy", [
            "DENY",
            "ALLOW",
            "NOTIFY",
          ])}
        </>
      )}
      {tab === "shipping" && (
        <>
          {check("requiresShipping", "Physical product / requires shipping")}
          {check("freeShipping", "Eligible for free shipping")}
          {text("shippingClass", "Shipping class", "text", 100)}
          {text("weight", "Weight", "number")}
          {select("weightUnit", "Weight unit", ["kg", "g", "lb", "oz"])}
          {select("dimensionUnit", "Dimension unit", ["cm", "mm", "in", "m"])}
          {text("length", "Length", "number")}
          {text("width", "Width", "number")}
          {text("height", "Height", "number")}
          {text(
            "countryOfOrigin",
            "Country of origin (ISO alpha-2)",
            "text",
            2,
          )}
          {text("hsCode", "Harmonized tariff code", "text", 10)}
        </>
      )}
      {tab === "seo" && (
        <>
          {text("canonicalUrl", "Canonical URL", "url", 2048)}
          {check("noIndex", "Hide from search engines (noindex)")}
          {text("socialTitle", "Social sharing title")}
          {text("socialDescription", "Social sharing description", "text", 500)}
          {text("socialImage", "Social sharing image URL", "url", 2048)}
        </>
      )}
      {tab === "publishing" && (
        <>
          {select("status", "Publication status", [
            "DRAFT",
            "ACTIVE",
            "ARCHIVED",
          ])}
          {check("isVisible", "Visible on storefront")}
          {check("isFeatured", "Featured product")}
          <p className="text-sm text-slate-500 md:col-span-2">
            Active products require a name, SKU, category and valid pricing.
            Drafts, archived products and hidden products are excluded from
            public catalog APIs.
          </p>
        </>
      )}
      {tab === "variants" && (
        <label className="space-y-2 text-sm font-medium md:col-span-2">
          Product options
          <textarea
            className={control + " font-mono"}
            rows={5}
            value={value.options}
            onChange={(e) => onChange({ ...value, options: e.target.value })}
          />
          <span className="block text-xs text-slate-500">
            {
              'Example: [{"name":"Size","values":["S","M","L"]},{"name":"Color","values":["Black","White"]}]. Maximum 200 combinations. Save options before adding variants.'
            }
          </span>
        </label>
      )}
    </>
  );
}
