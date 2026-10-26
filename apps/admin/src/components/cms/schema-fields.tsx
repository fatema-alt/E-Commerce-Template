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
export const input =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
export const button =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50";
function AssetField({
  id,
  name,
  value,
  assets,
  onChange,
}: {
  id: string;
  name: string;
  value: Value;
  assets: Asset[];
  onChange: (value: Value) => void;
}) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const selectedAsset = assets.find((a) => a.id === value);

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
        onSelect={(assetId) => onChange(assetId)}
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
  if (schema.type === "object") {
    const data = (value ?? {}) as Record<string, Value>;
    return (
      <div className="grid gap-4">
        {Object.entries(schema.properties ?? {}).map(([key, child]) => {
          const required = schema.required?.includes(key);
          const enabled = data[key] !== undefined;
          return (
            <div
              key={key}
              className="min-w-0 rounded-lg border border-slate-200 p-3"
            >
              {!required && (
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
              {(enabled || required) && (
                <SchemaField
                  name={key}
                  schema={child}
                  value={data[key] ?? initialValue(child)}
                  assets={assets}
                  onChange={(next) => onChange({ ...data, [key]: next })}
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
                Item {index + 1}
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
          name={name}
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
                  : "text"
            }
            value={String(value ?? "")}
            min={schema.min}
            max={schema.max}
            minLength={schema.minLength}
            maxLength={schema.maxLength}
            pattern={schema.pattern}
            onChange={(e) =>
              onChange(
                schema.type === "number"
                  ? Number(e.target.value)
                  : e.target.value,
              )
            }
          />
        </div>
      )}
    </div>
  );
}
