"use client";
import { useEffect, useState, type CSSProperties } from "react";
import type { Value } from "./cms-api";
export const engagementDefaults: Record<string, Record<string, Value>> = {
  announcementRibbon: {
    enabled: false,
    animation: "fade",
    intervalSeconds: 6,
    backgroundColor: "#101917",
    textColor: "#ffffff",
    accentColor: "#d8f45a",
    items: [],
  },
  contactWidget: {
    enabled: false,
    title: "How can we help you?",
    description: "Choose your preferred way to contact our team.",
    statusText: "DS Mart Support",
    position: "right",
    iconStyle: "chat",
    desktop: true,
    mobile: true,
    whatsapp: { enabled: false },
    phone: { enabled: false },
    email: { enabled: false },
    launcherColor: "#0086cf",
    accentColor: "#d8f45a",
    panelColor: "#101b25",
    iconColor: "#ffffff",
    borderRadius: 22,
    animation: "subtle",
    delaySeconds: 0,
    closeOnOutsideClick: true,
    rememberDismissal: false,
    excludedRoutes: [],
  },
  tracking: {
    enabled: false,
    gtmId: "",
    serverUrl: "",
    ga4MeasurementId: "",
    metaPixelId: "",
    consentDefault: "denied",
    debugMode: false,
  },
};
type Row = Record<string, Value>;
export function EngagementPreview({
  scope,
  value,
}: {
  scope: string;
  value: Value;
}) {
  const data = (value || engagementDefaults[scope]) as Row;
  const [mobile, setMobile] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const rows = ((data.items || []) as Row[]).filter(
    (item) =>
      item.enabled &&
      (item.device === "both" ||
        item.device === (mobile ? "mobile" : "desktop")),
  );
  useEffect(() => {
    if (
      scope !== "announcementRibbon" ||
      paused ||
      data.animation === "static" ||
      rows.length < 2
    )
      return;
    const timer = setInterval(
      () => setIndex((value) => value + 1),
      Math.max(3, Number(data.intervalSeconds) || 6) * 1000,
    );
    return () => clearInterval(timer);
  }, [scope, paused, data.animation, data.intervalSeconds, rows.length]);
  const item = rows[index % (rows.length || 1)];
  const channel = (key: string) => data[key] as Row | undefined;
  const style = {
    background: String(data.panelColor || "#101b25"),
    color: "#ffffff",
    borderRadius: Number(data.borderRadius || 22),
    border: `1px solid ${data.accentColor || "#d8f45a"}`,
    padding: 20,
  } as CSSProperties;
  return (
    <section className="engagement-preview">
      <h2 className="mb-2 font-semibold">Live preview</h2>
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          aria-pressed={!mobile}
          onClick={() => setMobile(false)}
        >
          Desktop
        </button>
        <button
          type="button"
          aria-pressed={mobile}
          onClick={() => setMobile(true)}
        >
          Mobile
        </button>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Preview uses draft content. Publish the saved Site Settings document to
        update the storefront. Scheduled messages are labelled by their
        configured dates in the editor; this preview shows the selected device.
      </p>
      <div className={`engagement-preview-frame ${mobile ? "mobile" : ""}`}>
        {scope === "announcementRibbon" ? (
          <div
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            style={{
              minHeight: 40,
              padding: "10px 14px",
              background: String(data.backgroundColor || "#101917"),
              color: String(data.textColor || "#ffffff"),
              borderBottom: `2px solid ${data.accentColor || "#d8f45a"}`,
              textAlign: "center",
              fontSize: 13,
            }}
          >
            <span>
              {item
                ? `${item.icon || ""} ${item.text}`
                : "Add an enabled announcement to preview it."}
            </span>
            {item?.ctaLabel && (
              <span
                style={{
                  color: String(data.accentColor || "#d8f45a"),
                  marginLeft: 12,
                }}
              >
                {String(item.ctaLabel)} ↗
              </span>
            )}
            {rows.length > 1 && (
              <div className="mt-2 flex justify-center gap-2">
                {rows.map((row, i) => (
                  <button
                    type="button"
                    key={String(row.id)}
                    aria-label={`Preview announcement ${i + 1}`}
                    onClick={() => setIndex(i)}
                    style={{
                      padding: 0,
                      width: i === index % rows.length ? 18 : 6,
                      height: 6,
                      borderRadius: 8,
                      background: String(data.accentColor || "#d8f45a"),
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              padding: 16,
              display: "grid",
              gap: 12,
              justifyItems: data.position === "left" ? "start" : "end",
            }}
          >
            {expanded && (
              <div style={{ ...style, width: "min(100%,340px)" }}>
                <p style={{ fontSize: 11, marginBottom: 6 }}>
                  {String(data.statusText || "")}
                </p>
                <h3 className="text-lg font-semibold">
                  {String(data.title || "")}
                </h3>
                <p style={{ fontSize: 13, margin: "8px 0 16px" }}>
                  {String(data.description || "")}
                </p>
                {["whatsapp", "phone", "email"]
                  .filter((key) => channel(key)?.enabled)
                  .map((key) => (
                    <div
                      key={key}
                      style={{
                        background: "#ffffff12",
                        padding: 12,
                        borderRadius: 12,
                        marginBottom: 8,
                        fontSize: 13,
                      }}
                    >
                      <strong>
                        {key === "whatsapp"
                          ? "Chat on WhatsApp"
                          : key === "phone"
                            ? "Call Customer Support"
                            : "Send an Email"}
                      </strong>
                      <p
                        style={{
                          fontSize: 11,
                          margin: "4px 0 0",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {String(
                          channel(key)?.number ||
                            channel(key)?.address ||
                            "Configure contact details",
                        )}
                      </p>
                    </div>
                  ))}
                <small>{String(data.supportHours || "")}</small>
              </div>
            )}
            <button
              type="button"
              aria-label="Toggle contact preview"
              onClick={() => setExpanded((value) => !value)}
              style={{
                width: 56,
                height: 56,
                padding: 0,
                borderRadius: "50%",
                border: `2px solid ${data.accentColor || "#d8f45a"}`,
                background: String(data.launcherColor || "#0086cf"),
                color: String(data.iconColor || "#ffffff"),
                fontSize: 24,
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                style={{ margin: "auto" }}
                aria-hidden="true"
              >
                <path
                  d={
                    data.iconStyle === "headset"
                      ? "M4 13v-1a8 8 0 0 1 16 0v6h-4v-7h4M4 11h4v7H4zM20 18v3h-5"
                      : "M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5A8.5 8.5 0 0 1 10.5 3h2a8.5 8.5 0 0 1 8.5 8.5Z"
                  }
                />
              </svg>
            </button>
          </div>
        )}
        {!data.enabled && (
          <p className="p-3 text-xs text-slate-500">
            Currently disabled. This draft preview is shown for editing.
          </p>
        )}
      </div>
    </section>
  );
}
