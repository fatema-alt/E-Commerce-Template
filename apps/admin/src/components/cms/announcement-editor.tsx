"use client";

import type { Asset, Schema, Value } from "./cms-api";
import { SchemaField, button } from "./schema-fields";
import { engagementDefaults } from "./engagement-preview";

export function announcementDraft(content: Record<string, Value>) {
  const legacy = content.announcement as Record<string, Value> | undefined;
  return {
    ...engagementDefaults.announcementRibbon,
    ...((content.announcementRibbon as Record<string, Value> | undefined) ||
      (legacy
        ? {
            enabled: legacy.enabled,
            items: legacy.text
              ? [
                  {
                    id: "legacy",
                    enabled: true,
                    text: legacy.text,
                    device: "both",
                    ...(legacy.href ? { ctaUrl: legacy.href } : {}),
                  },
                ]
              : [],
          }
        : {})),
  };
}

export function AnnouncementEditor({
  value,
  schema,
  assets,
  disabled,
  onChange,
}: {
  value: Record<string, Value>;
  schema: Schema;
  assets: Asset[];
  disabled: boolean;
  onChange: (value: Value) => void;
}) {
  const data = { ...engagementDefaults.announcementRibbon, ...value };
  const items = (data.items || []) as Record<string, Value>[];
  const globalSchema = {
    ...schema,
    properties: Object.fromEntries(
      Object.entries(schema.properties || {}).filter(
        ([key]) => key !== "items",
      ),
    ),
  };
  const update = (next: Record<string, Value>) =>
    onChange({ ...data, ...next });
  const reorder = (index: number, offset: number) => {
    const next = [...items];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    update({ items: next });
  };
  return (
    <fieldset disabled={disabled} className="space-y-5">
      <p className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900">
        Enable the bar, add messages, then Save Draft and Publish. Infinite
        scroll moves every active message in one continuous ribbon. Hover,
        keyboard focus or Pause stops the animation.
      </p>
      <SchemaField
        name="Announcement ribbon"
        schema={globalSchema}
        value={data}
        assets={assets}
        onChange={(next) => update(next as Record<string, Value>)}
      />
      <p className="text-xs text-slate-500">
        Scroll Speed controls infinite scroll in pixels per second (20–120).
        Interval Seconds controls the other slide modes. Dates use your local
        timezone and are saved in UTC.
      </p>
      <h3 className="font-semibold">Messages ({items.length}/20)</h3>
      {!items.length && (
        <p className="text-sm text-slate-500">
          Add a message to display the announcement bar.
        </p>
      )}
      {items.map((item, index) => (
        <section
          key={String(item.id)}
          className="space-y-3 rounded-lg border bg-slate-50 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold">Message {index + 1}</h4>
            <div className="flex gap-2">
              <button
                type="button"
                className={button}
                disabled={disabled || index === 0}
                onClick={() => reorder(index, -1)}
              >
                Move up
              </button>
              <button
                type="button"
                className={button}
                disabled={disabled || index === items.length - 1}
                onClick={() => reorder(index, 1)}
              >
                Move down
              </button>
              <button
                type="button"
                className={button}
                onClick={() =>
                  update({ items: items.filter((_, row) => row !== index) })
                }
              >
                Remove message
              </button>
            </div>
          </div>
          <SchemaField
            name={`Message ${index + 1}`}
            schema={schema.properties!.items.items!}
            value={item}
            assets={assets}
            onChange={(next) =>
              update({
                items: items.map((row, position) =>
                  position === index ? next : row,
                ),
              })
            }
          />
        </section>
      ))}
      <button
        type="button"
        className={button}
        disabled={disabled || items.length >= 20}
        onClick={() =>
          update({
            items: [
              ...items,
              {
                id: crypto.randomUUID(),
                enabled: true,
                text: "Your announcement",
                device: "both",
              },
            ],
          })
        }
      >
        Add message
      </button>
    </fieldset>
  );
}
