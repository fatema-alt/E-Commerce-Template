"use client";
import { control } from "./catalog-ui";

type Option = { name: string; values: string[] };
export function ProductOptionsEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  let options: Option[] | null = null;
  try {
    const data: unknown = JSON.parse(value);
    if (
      Array.isArray(data) &&
      data.every(
        (item) =>
          item &&
          typeof item.name === "string" &&
          Array.isArray(item.values) &&
          item.values.every((entry: unknown) => typeof entry === "string"),
      )
    )
      options = data;
  } catch {
    /* Preserve invalid/advanced JSON for correction rather than discarding it. */
  }
  function update(next: Option[]) {
    onChange(JSON.stringify(next, null, 2));
  }
  return (
    <div className="md:col-span-2 space-y-3">
      <p className="text-sm text-slate-500">
        Add options such as Size or Color. Save the product before generating
        combinations. Each variant keeps its own SKU, price and stock.
      </p>
      {options?.map((option, index) => (
        <div
          key={index}
          className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-2"
        >
          <label className="text-sm">
            Option name
            <input
              className={control}
              value={option.name}
              maxLength={100}
              placeholder="Size"
              onChange={(event) =>
                update(
                  options!.map((entry, row) =>
                    row === index
                      ? { ...entry, name: event.target.value }
                      : entry,
                  ),
                )
              }
            />
          </label>
          <label className="text-sm">
            Values (comma separated)
            <input
              className={control}
              value={option.values.join(",")}
              placeholder="S,M,L"
              onChange={(event) =>
                update(
                  options!.map((entry, row) =>
                    row === index
                      ? { ...entry, values: event.target.value.split(",") }
                      : entry,
                  ),
                )
              }
            />
          </label>
          <button
            type="button"
            className="text-left text-xs text-red-700"
            onClick={() => update(options!.filter((_, row) => row !== index))}
          >
            Remove option
          </button>
        </div>
      ))}
      {options && (
        <button
          type="button"
          className="rounded-lg border px-3 py-2 text-sm"
          onClick={() => update([...options!, { name: "", values: [] }])}
        >
          + Add option
        </button>
      )}
      <details>
        <summary className="cursor-pointer text-sm font-medium">
          Advanced option data
        </summary>
        <label className="mt-3 block text-sm">
          Options JSON
          <textarea
            className={control + " font-mono"}
            rows={5}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
      </details>
    </div>
  );
}
