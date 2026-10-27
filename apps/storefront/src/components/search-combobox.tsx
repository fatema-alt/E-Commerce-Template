"use client";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ProductThumbnail } from "./shopping-ui";
import { money } from "../lib/shop-client";
type Suggestion = {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  price: number;
};
export function SearchCombobox() {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLFormElement>(null);
  const path = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [state, setState] = useState<{
    query: string;
    items: Suggestion[];
    error: string;
  }>({ query: "", items: [], error: "" });
  const [active, setActive] = useState(-1);
  const [openPath, setOpenPath] = useState(path);
  const term = query.trim();
  const loading = term.length >= 2 && state.query !== term;
  const opened = focused && !dismissed && term.length >= 2 && openPath === path;
  const items = state.query === term ? state.items : [];
  useEffect(() => {
    if (opened && active >= 0)
      document
        .getElementById(`${id}-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, opened, id]);
  useEffect(() => {
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(term)}`,
          { signal: controller.signal, cache: "no-store" },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.message ||
              "Suggestions unavailable. Search all products instead.",
          );
        if (!controller.signal.aborted)
          setState({ query: term, items: data.items, error: "" });
      } catch (e) {
        if (!controller.signal.aborted)
          setState({ query: term, items: [], error: (e as Error).message });
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setFocused(false);
        setDismissed(true);
      }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  return (
    <form
      action="/search"
      autoComplete="off"
      className="search search-combobox"
      role="search"
      ref={root}
      onSubmit={(event) => {
        if (!term) {
          event.preventDefault();
          input.current?.focus();
        }
        setDismissed(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <label className="sr-only" htmlFor={id}>
        Search products
      </label>
      <input
        ref={input}
        id={id}
        name="q"
        type="search"
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={opened}
        aria-controls={opened ? `${id}-list` : undefined}
        aria-activedescendant={
          opened && active >= 0 && items[active] ? `${id}-${active}` : undefined
        }
        placeholder="Search products…"
        minLength={1}
        maxLength={200}
        value={query}
        onFocus={() => {
          setFocused(true);
          setDismissed(false);
          setOpenPath(path);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(-1);
          setDismissed(false);
          setOpenPath(path);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setDismissed(true);
            setActive(-1);
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setDismissed(false);
            setFocused(true);
            if (items.length)
              setActive((previous) =>
                event.key === "ArrowDown"
                  ? (previous + 1) % items.length
                  : previous <= 0
                    ? items.length - 1
                    : previous - 1,
              );
          }
          if (event.key === "Enter" && opened && items[active]) {
            event.preventDefault();
            setDismissed(true);
            router.push(`/product/${encodeURIComponent(items[active].slug)}`);
          }
        }}
      />
      <button type="submit" aria-label="Search all products">
        Search
      </button>
      {opened && (
        <div className="search-panel">
          <p className="search-panel-label">Product suggestions</p>
          <div role="status" className="search-feedback">
            {loading
              ? "Searching the catalog…"
              : state.error ||
                (!items.length
                  ? "No matching products. Try a different search."
                  : `${items.length} suggestions`)}
          </div>
          <ul id={`${id}-list`} role="listbox" aria-label="Product suggestions">
            {items.map((item, index) => (
              <li
                key={item.id}
                id={`${id}-${index}`}
                role="option"
                aria-selected={index === active}
                className={
                  index === active ? "search-option active" : "search-option"
                }
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setDismissed(true);
                  router.push(`/product/${encodeURIComponent(item.slug)}`);
                }}
                onMouseEnter={() => setActive(index)}
              >
                <ProductThumbnail src={item.imageUrl} name={item.name} />
                <span>
                  <strong>{item.name}</strong>
                  <small>{money(item.price)}</small>
                </span>
              </li>
            ))}
          </ul>
          <a
            className="search-all"
            href={`/search?q=${encodeURIComponent(term)}`}
            onClick={() => setDismissed(true)}
          >
            View all results for “{term}” →
          </a>
        </div>
      )}
    </form>
  );
}
