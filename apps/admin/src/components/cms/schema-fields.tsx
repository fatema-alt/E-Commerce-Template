"use client";
import { useId, useState } from "react";
import {
  type Asset,
  type Schema,
  type Value,
  assetUrl,
  initialValue,
  label,
} from "./cms-api";
import { MediaPickerModal } from "./media-picker-modal";
import { CatalogPicker } from "./catalog-picker";
export const input =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
export const button =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50";
function AssetField({
  id,
  value,
  assets,
  onChange,
}: {
  id: string;
  value: Value;
  assets: Asset[];
  onChange: (value: Value) => void;
}) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickedAsset, setPickedAsset] = useState<Asset | undefined>();
  const selectedAsset = pickedAsset?.id === value ? pickedAsset : assets.find((a) => a.id === value);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {selectedAsset?.url ? (
          <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            <img
              src={assetUrl(selectedAsset.url)}
              alt={selectedAsset.altText || ""}
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}

        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPickerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition shadow-xs"
            >
              <span>🖼️ Choose from Media Library</span>
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-50 hover:text-red-600 transition"
                title="Remove image"
              >
                ✕ Clear
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 truncate max-w-xs">
            {selectedAsset?.altText || (value ? String(value) : "No image selected")}
          </p>
        </div>
      </div>

      <select
        id={id}
        className={input + " text-xs"}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Or pick from list: (None selected)</option>
        {assets.map((a) => (
          <option key={a.id} value={a.id}>
            {a.altText || a.id}
          </option>
        ))}
      </select>

      <MediaPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={(assetId, asset) => { setPickedAsset(asset); onChange(assetId); }}
        assets={assets}
        currentAssetId={String(value ?? "")}
      />
    </div>
  );
}

export function SchemaField({
  schema,
  value,
  onChange,
  name,
  assets,
}: {
  schema: Schema;
  value: Value;
  onChange: (value: Value) => void;
  name: string;
  assets: Asset[];
}) {
  const id = useId();
  if (["productIds", "categoryIds", "productId", "categoryId"].includes(name)) {
    return <CatalogPicker kind={name.startsWith("product") ? "products" : "categories"} multiple={name.endsWith("Ids")} value={value} max={schema.maxItems} onChange={onChange} />;
  }
  if (schema.type === "object") {
    const data = (value ?? {}) as Record<string, Value>;
    return (
      <div className="grid gap-4">
        {Object.entries(schema.properties ?? {}).map(([key, child]) => {
          const graphicOnly = data.slideType === "full_banner" || (!data.slideType && data.bannerType === "without_button");
          if (graphicOnly && ["subtitle", "button", "secondaryButton", "badge", "badgeColor", "floatingBadges", "theme"].includes(key)) return null;
          if (key === "bannerType" && schema.properties?.slideType) return null;
          if (key === "slideType" || key === "bannerType") return (
            <fieldset key={key} className="space-y-2 rounded-lg border border-indigo-300 p-3">
              <legend className="text-sm font-semibold">Banner display</legend>
              <div className="flex flex-wrap gap-2">
                {(key === "slideType" ? [["split_content", "Image + HTML content"], ["full_banner", "Full banner image"]] : [["with_button", "With button"], ["without_button", "Without button"]]).map(([mode, text]) => (
                  <button type="button" key={mode} aria-pressed={key === "slideType" ? (graphicOnly ? "full_banner" : "split_content") === mode : (data.bannerType || "with_button") === mode}
                    className={`rounded-lg border px-3 py-2 text-sm ${(key === "slideType" ? (graphicOnly ? "full_banner" : "split_content") === mode : (data.bannerType || "with_button") === mode) ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white text-slate-900"}`}
                    onClick={() => onChange({ ...data, [key]: mode })}>{text}</button>
                ))}
              </div>
              <p className="text-xs text-slate-500">{graphicOnly ? "Use a 3:1 desktop banner with embedded text. No HTML overlay or cropping. Optional mobile image: 4:5. Set Banner Link to make it clickable. Title is an accessible label only." : "Use an image without embedded text. HTML content takes 45% and image takes 55% on desktop; they stack on mobile."}</p>
            </fieldset>
          );
          if (key === "enabled") return <label key={key} className="flex gap-2 text-sm font-semibold"><input type="checkbox" checked={data.enabled !== false} onChange={(event) => onChange({ ...data, enabled: event.target.checked })} />{name.startsWith("slides") ? "Enable this slide" : "Enabled"}</label>;
          const required = schema.required?.includes(key);
          const enabled = data[key] !== undefined;
          const imageField = child.type === "object" && !!child.properties?.assetId;
          return (
            <div
              key={key}
              className="min-w-0 rounded-lg border border-slate-200 p-3"
            >
              {imageField && <p className="mb-2 text-sm font-semibold">{key === "image" ? "Desktop image" : key === "mobileImage" ? "Mobile image (optional)" : label(key)}</p>}
              {!required && !imageField && (
                <label className="mb-2 flex gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) => {
                      const next = { ...data };
                      if (event.target.checked) next[key] = initialValue(child);
                      else delete next[key];
                      onChange(next);
                    }}
                  />
                  {label(key)}
                </label>
              )}
              {(enabled || required || imageField) && (
                <SchemaField
                  name={key}
                  schema={child}
                  value={data[key] ?? initialValue(child)}
                  assets={assets}
                  onChange={(next) => {
                    const updated = { ...data, [key]: next };
                    if (key === "productIds" && Array.isArray(next) && next.length && schema.properties?.source?.enum?.includes("selected")) updated.source = "selected";
                    if (key === "categoryId" && next && schema.properties?.source?.enum?.includes("category")) updated.source = "category";
                    if (imageField && !(next as Record<string, Value>).assetId && !required) delete updated[key];
                    onChange(updated);
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }
  if (schema.type === "array") {
    const rows = (value ?? []) as Value[];
    return (
      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-semibold">
          {label(name)} ({rows.length})
        </legend>
        {rows.map((row, index) => (
          <div
            key={index}
            className="space-y-3 rounded-lg border bg-slate-50 p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-auto text-xs font-semibold">
                {name === "slides" ? "Slide" : "Item"} {index + 1}
                {name === "slides" && row && typeof row === "object" && !Array.isArray(row) && typeof row.title === "string" ? ` · ${row.title}` : ""}
              </span>
              {[-1, 1].map((delta) => (
                <button
                  key={delta}
                  type="button"
                  className={button}
                  disabled={index + delta < 0 || index + delta >= rows.length}
                  aria-label={`${delta < 0 ? "Move up" : "Move down"} ${name} item ${index + 1}`}
                  onClick={() => {
                    const next = [...rows];
                    [next[index], next[index + delta]] = [
                      next[index + delta],
                      next[index],
                    ];
                    onChange(next);
                  }}
                >
                  {delta < 0 ? "↑" : "↓"}
                </button>
              ))}
              <button
                type="button"
                className={button}
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
            <SchemaField
              name={`${name} ${index + 1}`}
              schema={schema.items!}
              value={row}
              assets={assets}
              onChange={(next) =>
                onChange(rows.map((r, i) => (i === index ? next : r)))
              }
            />
          </div>
        ))}
        <button
          type="button"
          disabled={rows.length >= (schema.maxItems ?? 100)}
          className={button}
          onClick={() => {
            const next = initialValue(schema.items!);
            if (name === "slides" && next && typeof next === "object" && !Array.isArray(next) && schema.items?.properties?.slideType) {
              next.slideType = "split_content";
              next.enabled = true;
            }
            if (
              next &&
              typeof next === "object" &&
              !Array.isArray(next) &&
              "id" in next
            )
              next.id = crypto.randomUUID();
            onChange([...rows, next]);
          }}
        >
          + Add {label(name)}
        </button>
      </fieldset>
    );
  }
  if (schema.type === "boolean")
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
        {label(name)}
      </label>
    );
  const asset = name === "assetId" || name.endsWith("AssetId");
  const color = schema.pattern === "^#[a-fA-F0-9]{6}$";
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label(name)}
      </label>
      {asset ? (
        <AssetField
          id={id}
          value={value}
          assets={assets}
          onChange={onChange}
        />
      ) : schema.enum ? (
        <select
          id={id}
          className={input}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
        >
          {schema.enum.map((option) => (
            <option key={option} value={option}>
              {label(option)}
            </option>
          ))}
        </select>
      ) : (
        <div className="flex gap-2">
          {color && (
            <input
              aria-label={`${label(name)} color picker`}
              type="color"
              value={String(value || "#000000")}
              onChange={(e) => onChange(e.target.value)}
              className="h-10 w-12"
            />
          )}
          <input
            id={id}
            className={input}
            type={
              schema.type === "number"
                ? "number"
                : schema.format === "email"
                  ? "email"
                  : schema.format === "datetime"
                    ? "datetime-local"
                  : "text"
            }
            value={schema.format === "datetime" && value ? new Date(String(value)).toLocaleString('sv-SE').replace(' ', 'T').slice(0, 16) : String(value ?? "")}
            min={schema.min}
            max={schema.max}
            minLength={schema.minLength}
            maxLength={schema.maxLength}
            pattern={schema.pattern}
            onChange={(e) =>
              onChange(
                schema.type === "number"
                  ? Number(e.target.value)
                  : schema.format === "datetime" && e.target.value
                    ? new Date(e.target.value).toISOString()
                  : e.target.value,
              )
            }
          />
        </div>
      )}
    </div>
  );
}
