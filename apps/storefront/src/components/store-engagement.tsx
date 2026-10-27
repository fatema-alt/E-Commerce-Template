"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import {
  activeAnnouncements,
  contactChannels,
  excludedContactRoute,
  type EngagementSettings,
  type RibbonSettings,
} from "../lib/engagement";
import { safeHref } from "../lib/cms";

function useMedia(query: string) {
  return useSyncExternalStore(
    (callback) => {
      const match = window.matchMedia(query);
      match.addEventListener("change", callback);
      return () => match.removeEventListener("change", callback);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
function useSettings(initial: EngagementSettings) {
  const [settings, setSettings] = useState(initial);
  useEffect(() => {
    let live = true;
    let loading = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (loading || document.visibilityState === "hidden") return;
      loading = true;
      try {
        const response = await fetch("/api/storefront-settings", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.ok && live) setSettings(await response.json());
      } catch {
        /* Keep last known published settings during an outage. */
      } finally {
        loading = false;
      }
    };
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      live = false;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return settings;
}

export function AnnouncementRibbon({
  initial,
  initialNow,
}: {
  initial: EngagementSettings;
  initialNow: number;
}) {
  const settings = useSettings(initial);
  const ribbon: RibbonSettings | undefined =
    settings.announcementRibbon ||
    (settings.announcement?.enabled && settings.announcement.text
      ? {
          enabled: true,
          animation: "static",
          intervalSeconds: 6,
          items: [
            {
              id: "legacy",
              enabled: true,
              text: settings.announcement.text,
              ctaUrl: settings.announcement.href,
              device: "both",
            },
          ],
        }
      : undefined);
  const mobile = useMedia("(max-width: 767px)");
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const [now, setNow] = useState(initialNow);
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  const [manualPause, setManualPause] = useState(false);
  const ribbonRoot = useRef<HTMLElement>(null);
  const items = ribbon?.enabled ? activeAnnouncements(ribbon, now, mobile) : [];
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (
      paused ||
      manualPause ||
      reduced ||
      !ribbon?.enabled ||
      ribbon.animation === "static" ||
      items.length < 2
    )
      return;
    const timer = setInterval(
      () => {
        // Check the actual DOM as well as React state: focus can enter while a
        // queued timer or a pointer-leave update is being processed.
        if (
          document.visibilityState === "hidden" ||
          ribbonRoot.current?.contains(document.activeElement) ||
          ribbonRoot.current?.matches(":hover")
        )
          return;
        setIndex((value) => value + 1);
      },
      Math.max(3, ribbon.intervalSeconds || 6) * 1000,
    );
    return () => clearInterval(timer);
  }, [
    paused,
    manualPause,
    reduced,
    ribbon?.enabled,
    ribbon?.animation,
    ribbon?.intervalSeconds,
    items.length,
  ]);
  if (!ribbon?.enabled || !items.length) return null;
  const active = index % items.length;
  const item = items[active];
  const href = safeHref(item.ctaUrl);
  const style = {
    "--ribbon-bg": ribbon.backgroundColor || "#101917",
    "--ribbon-text": ribbon.textColor || "#ffffff",
    "--ribbon-accent": ribbon.accentColor || "#d8f45a",
  } as CSSProperties;
  return (
    <section
      ref={ribbonRoot}
      className={`smart-ribbon ribbon-${ribbon.animation}`}
      style={style}
      aria-label="Store announcements"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <div className="smart-ribbon-inner container">
        <div key={item.id} className="ribbon-message">
          {item.icon && <span aria-hidden="true">{item.icon}</span>}
          <span>
            {href && !item.ctaLabel ? (
              <Link href={href}>{item.text}</Link>
            ) : (
              item.text
            )}
          </span>
          {href && item.ctaLabel && (
            <Link className="ribbon-cta" href={href}>
              {item.ctaLabel} <span aria-hidden="true">↗</span>
            </Link>
          )}
        </div>
        {items.length > 1 && (
          <div className="ribbon-controls">
            <div className="ribbon-dots">
              {items.map((row, i) => (
                <button
                  key={row.id}
                  type="button"
                  aria-label={`Show announcement ${i + 1}: ${row.text}`}
                  aria-current={i === active ? "true" : undefined}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
            <button
              className="ribbon-pause"
              type="button"
              aria-label={
                manualPause ? "Play announcements" : "Pause announcements"
              }
              aria-pressed={manualPause}
              onClick={() => setManualPause((value) => !value)}
            >
              {manualPause ? "▶" : "Ⅱ"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function ContactIcon({ kind }: { kind: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "whatsapp" ? (
        <><path d="M20.5 11.7a8.5 8.5 0 0 1-12.7 7.4L3 20.5l1.4-4.8a8.5 8.5 0 1 1 16.1-4Z"/><path d="m8 7 2 3-1 1a9 9 0 0 0 4 4l1-1 3 2c-1 3-5 1-7-1s-4-6-2-8Z"/></>
      ) : kind === "email" ? (
        <>
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <path d="m4 7 8 6 8-6" />
        </>
      ) : kind === "phone" ? (
        <path d="M6 3h3l2 5-2 2a14 14 0 0 0 5 5l2-2 5 2v3c0 2-2 3-4 3C9 20 4 15 3 7c0-2 1-4 3-4Z" />
      ) : kind === "headset" ? (
        <>
          <path d="M4 13v-1a8 8 0 0 1 16 0v1M20 17v3h-5" />
          <rect x="3" y="11" width="4" height="7" rx="2" />
          <rect x="17" y="11" width="4" height="7" rx="2" />
        </>
      ) : (
        <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5A8.5 8.5 0 0 1 10.5 3h2a8.5 8.5 0 0 1 8.5 8.5Z" />
      )}
    </svg>
  );
}
export function FloatingContact({ initial }: { initial: EngagementSettings }) {
  const settings = useSettings(initial);
  const widget = settings.contactWidget;
  const path = usePathname();
  const mobile = useMedia("(max-width: 767px)");
  const [open, setOpen] = useState(false);
  const delayKey = `${!!widget?.enabled}:${widget?.delaySeconds || 0}`;
  const [readyKey, setReadyKey] = useState("");
  const ready = readyKey === delayKey;
  const [dismissed, setDismissed] = useState(false);
  const [obscured, setObscured] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const id = useId();
  const channels = widget ? contactChannels(widget) : [];
  const visible =
    !!widget?.enabled &&
    channels.length > 0 &&
    (mobile ? widget.mobile : widget.desktop) &&
    !excludedContactRoute(path, widget.excludedRoutes);
  useEffect(() => {
    if (!visible) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const target = launcher.current?.getBoundingClientRect();
        if (!target) return;
        const overlaps = [
          ...document.querySelectorAll(
            ".place-order,.checkout-link,[data-contact-avoid],.cookie-banner",
          ),
        ].some((element) => {
          const box = element.getBoundingClientRect();
          return (
            box.width > 0 &&
            box.height > 0 &&
            target.left < box.right &&
            target.right > box.left &&
            target.top < box.bottom &&
            target.bottom > box.top
          );
        });
        setObscured(overlaps);
      });
    };
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [visible, ready, path]);
  useEffect(() => {
    const timer = setTimeout(
      () => setReadyKey(delayKey),
      Math.max(0, widget?.delaySeconds || 0) * 1000,
    );
    return () => clearTimeout(timer);
  }, [widget?.delaySeconds, delayKey]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (widget?.rememberDismissal) {
        try {
          if (sessionStorage.getItem("ds-contact-dismissed") === "1")
            setDismissed(true);
        } catch {
          /* Optional preference. */
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [widget?.rememberDismissal]);
  const close = useCallback(
    (restoreFocus = true) => {
      setOpen(false);
      if (widget?.rememberDismissal) {
        try {
          sessionStorage.setItem("ds-contact-dismissed", "1");
        } catch {
          /* Optional preference. */
        }
        setDismissed(true);
      }
      if (restoreFocus) launcher.current?.focus();
    },
    [widget?.rememberDismissal],
  );
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    const outside = (event: PointerEvent) => {
      if (
        widget?.closeOnOutsideClick !== false &&
        !root.current?.contains(event.target as Node)
      )
        close(false);
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open, widget?.closeOnOutsideClick, close]);
  // Do not keep a panel open after navigation, even when the layout persists.
  const [openedPath, setOpenedPath] = useState(path);
  if (!visible || !ready || !widget) return null;
  const expanded = open && openedPath === path;
  const style = {
    "--contact-launcher": widget.launcherColor || "#0086cf",
    "--contact-accent": widget.accentColor || "#d8f45a",
    "--contact-panel": widget.panelColor || "#101b25",
    "--contact-icon": widget.iconColor || "#ffffff",
    "--contact-light-panel":
      widget.lightPanelColor || widget.panelColor || "#101b25",
    "--contact-light-text": widget.lightTextColor || "#ffffff",
    "--contact-dark-panel":
      widget.darkPanelColor || widget.panelColor || "#101b25",
    "--contact-dark-text": widget.darkTextColor || "#ffffff",
    "--contact-radius": `${widget.borderRadius || 22}px`,
  } as CSSProperties;
  return (
    <div
      className={`floating-contact contact-${widget.position} contact-${widget.animation || "subtle"} ${dismissed ? "contact-dismissed" : ""}`}
      style={{
        ...style,
        visibility: obscured && !expanded ? "hidden" : undefined,
      }}
      ref={root}
    >
      {expanded && (
        <section
          role="dialog"
          aria-label={widget.title}
          id={id}
          ref={panel}
          className="contact-panel"
        >
          <button
            className="contact-close"
            type="button"
            aria-label="Close contact panel"
            onClick={() => close()}
          >
            ×
          </button>
          {widget.statusText && (
            <p className="contact-status">{widget.statusText}</p>
          )}
          <h2>{widget.title}</h2>
          <p className="contact-description">{widget.description}</p>
          <div className="contact-channels">
            {channels.map((channel) => (
              <a
                key={channel.id}
                className={`contact-channel channel-${channel.id}`}
                href={channel.href}
                {...(channel.id === "whatsapp"
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                <span className="contact-channel-icon">
                  <ContactIcon kind={channel.id} />
                </span>
                <span>
                  <strong>{channel.label}</strong>
                  <small>{channel.detail}</small>
                </span>
                <span aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
          {widget.supportHours && (
            <p className="contact-hours">{widget.supportHours}</p>
          )}
        </section>
      )}
      <button
        className="contact-launcher"
        type="button"
        ref={launcher}
        aria-label={
          expanded
            ? "Close support contact options"
            : "Open support contact options"
        }
        aria-haspopup="dialog"
        aria-expanded={expanded}
        aria-controls={expanded ? id : undefined}
        onClick={() => {
          if (expanded) close();
          else {
            setOpenedPath(path);
            setOpen(true);
          }
        }}
      >
        <ContactIcon kind={widget.iconStyle || "chat"} />
      </button>
    </div>
  );
}
