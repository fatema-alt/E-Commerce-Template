"use client";
import { useToastState } from "@/components/admin/toast-provider";
/* eslint-disable @next/next/no-img-element -- Category images use API storage URLs. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CatalogAudit } from "@/components/catalog/catalog-audit";
import {
  API,
  api,
  button,
  control,
  json,
  Pagination,
  useCatalogRole,
  useConfirm,
  useUnsavedChanges,
} from "@/components/catalog/catalog-ui";

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  parent?: { name: string };
  imageUrl: string | null;
  isActive: boolean;
  isVisible: boolean;
  isFeatured: boolean;
  sortOrder: number;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  noIndex: boolean;
  updatedAt: string;
  _count: { products: number; children?: number };
  children?: Category[];
};
const empty = {
  name: "",
  slug: "",
  description: "",
  parentId: "",
  sortOrder: "0",
  metaTitle: "",
  metaDescription: "",
  canonicalUrl: "",
  noIndex: false,
  isActive: true,
  isVisible: true,
  isFeatured: false,
};
const imageUrl = (url: string) => new URL(url, new URL(API).origin).toString();

function categoryForm(category: Category): typeof empty {
  return {
    name: category.name,
    slug: category.slug,
    description: category.description ?? "",
    parentId: category.parentId ?? "",
    sortOrder: String(category.sortOrder),
    metaTitle: category.metaTitle ?? "",
    metaDescription: category.metaDescription ?? "",
    canonicalUrl: category.canonicalUrl ?? "",
    noIndex: category.noIndex,
    isActive: category.isActive,
    isVisible: category.isVisible,
    isFeatured: category.isFeatured,
  };
}
export default function CategoriesPage({
  createMode = false,
  initialCategory,
}: {
  createMode?: boolean;
  initialCategory?: Category;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Category[]>([]);
  const [tree, setTree] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [recent, setRecent] = useState<{ id: string; name: string }[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const [sortBy, setSortBy] = useState("sortOrder");
  const [view, setView] = useState("list");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useToastState("error");
  const [, setSuccess] = useToastState("success");
  const [editing, setEditing] = useState<Category | null>(
    initialCategory ?? null,
  );
  const [showEditor, setShowEditor] = useState(createMode);
  const [form, setForm] = useState(() =>
    initialCategory ? categoryForm(initialCategory) : empty,
  );
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify(initialCategory ? categoryForm(initialCategory) : empty),
  );
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [removeImage, setRemoveImage] = useState(false);
  const { canEdit, canDelete, role } = useCatalogRole();
  const { confirm, confirmation } = useConfirm();
  const dirty =
    showEditor && (JSON.stringify(form) !== baseline || !!file || removeImage);
  useUnsavedChanges(dirty);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const timer = setTimeout(() => setPreview(url), 0);
    return () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
    };
  }, [file]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          paginated: "true",
          page: String(page),
          pageSize: String(pageSize),
          sortBy,
          sortDirection: "asc",
          ...(search ? { search } : {}),
          ...(active ? { active } : {}),
        });
        const [data, stats] = await Promise.all([
          api<{ items: Category[]; total: number }>("/categories?" + params, {
            signal: controller.signal,
          }),
          api<
            Record<string, number> & { recent: { id: string; name: string }[] }
          >("/categories/summary", { signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        setItems(data.items);
        setTotal(data.total);
        setSummary(stats);
        setRecent(stats.recent);
        setError("");
        if (page > 1 && (page - 1) * pageSize >= data.total)
          setPage(Math.max(1, Math.ceil(data.total / pageSize)));
      } catch (error) {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Could not load categories",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, active, page, pageSize, sortBy, refresh, setError]);
  useEffect(() => {
    const controller = new AbortController();
    void api<Category[]>("/categories/tree", { signal: controller.signal })
      .then((rows) => {
        if (!controller.signal.aborted) setTree(rows);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error ? error.message : "Could not load hierarchy",
          );
      });
    return () => controller.abort();
  }, [refresh, setError]);
  function flatten(
    nodes: Category[],
    depth = 0,
  ): (Category & { depth: number })[] {
    return nodes.flatMap((node) => [
      { ...node, depth },
      ...flatten(node.children ?? [], depth + 1),
    ]);
  }
  const all = flatten(tree);

  async function close() {
    if (
      !busy &&
      (!dirty || (await confirm("Discard unsaved category changes?")))
    ) {
      setShowEditor(false);
      if (createMode) router.push("/categories");
    }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await api<Category>(
        editing ? "/categories/" + editing.id : "/categories",
        json(editing ? "PATCH" : "POST", {
          ...form,
          ...(editing ? { expectedUpdatedAt: editing.updatedAt } : {}),
          name: form.name.trim(),
          parentId: form.parentId || null,
          sortOrder: Number(form.sortOrder),
          canonicalUrl: form.canonicalUrl || null,
        }),
      );
      // Keep the saved ID on partial upload failure so Retry cannot duplicate the category.
      setEditing(result);
      setBaseline(JSON.stringify(form));
      if (file) {
        const body = new FormData();
        body.append("file", file);
        await api("/categories/" + result.id + "/image", {
          method: "POST",
          body,
        });
      } else if (removeImage && result.imageUrl)
        await api("/categories/" + result.id + "/image", { method: "DELETE" });
      setShowEditor(false);
      setSuccess("Category saved");
      if (createMode) router.push("/categories");
      setRefresh((n) => n + 1);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not save category",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove(category: Category) {
    if (
      !(await confirm(
        "Delete “" +
          category.name +
          "”? Products, child categories, images and historical URLs must be removed or reassigned first.",
      ))
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api("/categories/" + category.id, { method: "DELETE" });
      setSuccess("Category deleted");
      setRefresh((n) => n + 1);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not delete category",
      );
    } finally {
      setBusy(false);
    }
  }
  async function toggle(category: Category) {
    setBusy(true);
    setError("");
    try {
      await api(
        "/categories/" + category.id,
        json("PATCH", { isActive: !category.isActive }),
      );
      setSuccess(
        category.isActive
          ? "Category deactivated; products and history retained"
          : "Category activated",
      );
      setRefresh((n) => n + 1);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not update category",
      );
    } finally {
      setBusy(false);
    }
  }
  const text = (
    key:
      | "name"
      | "slug"
      | "description"
      | "metaTitle"
      | "metaDescription"
      | "canonicalUrl",
    label: string,
    maxLength: number,
    multiline = false,
  ) => (
    <label className="block space-y-2 text-sm font-medium">
      {label}
      {multiline ? (
        <textarea
          className={control}
          maxLength={maxLength}
          rows={3}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      ) : (
        <input
          className={control}
          required={key === "name" || key === "slug"}
          type={key === "canonicalUrl" ? "url" : "text"}
          minLength={key === "name" ? 2 : undefined}
          maxLength={maxLength}
          pattern={key === "slug" ? "[a-z0-9]+(-[a-z0-9]+)*" : undefined}
          value={form[key]}
          onChange={(e) => {
            const value = e.target.value;
            setForm((prev) => ({
              ...prev,
              [key]: value,
              ...(key === "name" && !editing
                ? {
                    slug: value
                      .toLowerCase()
                      .trim()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, ""),
                  }
                : {}),
            }));
          }}
        />
      )}
    </label>
  );
  const row = (category: Category, depth = 0) => (
    <tr key={category.id} className="border-t hover:bg-slate-50/60">
      <td className="p-4">
        <div
          className="flex items-center gap-3"
          style={{ paddingLeft: depth * 20 }}
        >
          {view === "tree" && !!category.children?.length && (
            <button
              className="rounded border px-2 py-1"
              aria-label={"Expand " + category.name}
              aria-expanded={expanded.includes(category.id)}
              onClick={() =>
                setExpanded((prev) =>
                  prev.includes(category.id)
                    ? prev.filter((id) => id !== category.id)
                    : [...prev, category.id],
                )
              }
            >
              {expanded.includes(category.id) ? "−" : "+"}
            </button>
          )}
          {category.imageUrl ? (
            <img
              src={imageUrl(category.imageUrl)}
              alt={category.name}
              loading="lazy"
              className="h-11 w-11 rounded-xl border object-cover"
            />
          ) : (
            <div className="h-11 w-11 rounded-xl bg-slate-100" />
          )}
          <div>
            <p className="font-semibold">{category.name}</p>
            <p className="text-xs text-slate-400">/{category.slug}</p>
          </div>
        </div>
      </td>
      <td className="p-4 text-slate-500">
        {category.parent?.name ??
          all.find((item) => item.id === category.parentId)?.name ??
          "Root"}
      </td>
      <td className="p-4">
        <Link
          className="font-medium text-indigo-600"
          href={"/products?categoryId=" + category.id}
        >
          {category._count.products} products
        </Link>
      </td>
      <td className="p-4">
        {category.isActive ? "Active" : "Inactive"}
        <span className="block text-xs text-slate-400">
          {category.isVisible ? "Public" : "Hidden"}
        </span>
      </td>
      <td className="p-4">{category.sortOrder}</td>
      <td className="p-4 text-xs text-slate-500">
        {new Date(category.updatedAt).toLocaleDateString()}
      </td>
      <td className="p-4">
        <div className="flex gap-3">
          {canEdit && (
            <>
              <button
                className="font-medium text-indigo-600"
                onClick={() =>
                  router.push("/categories/" + category.id + "/edit")
                }
              >
                Edit / move
              </button>
              <button disabled={busy} onClick={() => void toggle(category)}>
                {category.isActive ? "Deactivate" : "Activate"}
              </button>
            </>
          )}
          {canDelete && (
            <button
              disabled={busy}
              className="text-red-600"
              onClick={() => void remove(category)}
            >
              Delete
            </button>
          )}
        </div>
      </td>
    </tr>
  );
  const treeRows = (nodes: Category[], depth = 0): React.ReactNode[] =>
    nodes.flatMap((node) => [
      row(node, depth),
      ...(expanded.includes(node.id)
        ? treeRows(node.children ?? [], depth + 1)
        : []),
    ]);
  return (
    <main className="space-y-6 text-slate-900">
      {confirmation}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-indigo-600">
            CATALOG / CATEGORIES
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            {createMode
              ? editing
                ? "Edit Category"
                : "Add Category"
              : "All Categories"}
          </h1>
          <p className="mt-2 text-slate-500">
            Organize your catalog and storefront navigation.
          </p>
        </div>
        {createMode ? (
          <button
            type="button"
            className={button}
            disabled={busy}
            onClick={() => void close()}
          >
            Back to All Categories
          </button>
        ) : (
          canEdit && (
            <Link
              href="/categories/add"
              className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white"
            >
              Add New Category
            </Link>
          )
        )}
      </header>
      {!createMode && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["total", "Total categories"],
              ["active", "Active"],
              ["inactive", "Inactive"],
              ["roots", "Root categories"],
              ["subcategories", "Subcategories"],
              ["empty", "Without products"],
              ["missingImages", "Without images"],
            ].map(([key, label]) => (
              <div
                key={key}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-bold">{summary[key] ?? "—"}</p>
              </div>
            ))}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Recently updated</p>
              {recent.slice(0, 3).map((item) => (
                <p key={item.id} className="mt-1 truncate text-sm">
                  {item.name}
                </p>
              ))}
            </div>
          </div>
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
              {error}{" "}
              <button
                className="underline"
                onClick={() => setRefresh((n) => n + 1)}
              >
                Retry
              </button>
            </p>
          )}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap gap-3 border-b p-5">
              <input
                aria-label="Search categories"
                disabled={view === "tree"}
                placeholder="Search name or slug"
                className={control + " max-w-xs"}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              <select
                aria-label="Category status"
                disabled={view === "tree"}
                className={control + " max-w-40"}
                value={active}
                onChange={(e) => {
                  setActive(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
              <select
                aria-label="Sort categories"
                className={control + " max-w-40"}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="sortOrder">Display order</option>
                <option value="name">Name</option>
                <option value="updatedAt">Updated</option>
              </select>
              <button
                aria-pressed={view === "list"}
                className={button}
                onClick={() => setView("list")}
              >
                List
              </button>
              <button
                aria-pressed={view === "tree"}
                className={button}
                onClick={() => setView("tree")}
              >
                Tree
              </button>
              {view === "tree" && (
                <button
                  className={button}
                  onClick={() =>
                    setExpanded(
                      expanded.length ? [] : all.map((item) => item.id),
                    )
                  }
                >
                  {expanded.length ? "Collapse all" : "Expand all"}
                </button>
              )}
              <button
                className={button}
                onClick={() => setRefresh((n) => n + 1)}
              >
                Refresh
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    {[
                      "Category",
                      "Parent",
                      "Products",
                      "Status",
                      "Order",
                      "Updated",
                      "Actions",
                    ].map((label) => (
                      <th className="p-4" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!loading &&
                    (view === "tree"
                      ? treeRows(tree)
                      : items.map((item) => row(item)))}
                </tbody>
              </table>
              {loading ? (
                <div className="space-y-3 p-5">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="h-14 animate-pulse rounded bg-slate-100"
                    />
                  ))}
                </div>
              ) : (
                !(view === "tree" ? tree : items).length && (
                  <p className="p-12 text-center text-slate-500">
                    No categories found.
                  </p>
                )
              )}
            </div>
            {view === "list" && (
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPage={setPage}
                onSize={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            )}
          </section>
        </>
      )}
      {createMode && role === "STAFF" && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
          You do not have permission to edit categories.
        </p>
      )}
      {showEditor && canEdit && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <form onSubmit={save} className="space-y-5">

            <nav
              aria-label="Category breadcrumb"
              className="text-xs text-slate-500"
            >
              Catalog /{" "}
              {form.parentId
                ? all.find((item) => item.id === form.parentId)?.name
                : "Root"}{" "}
              / {form.name || "New category"}
            </nav>
            <div className="grid gap-4 sm:grid-cols-2">
              {text("name", "Category name", 100)}
              {text("slug", "URL slug", 200)}
              <label className="space-y-2 text-sm font-medium">
                Parent category
                <select
                  className={control}
                  value={form.parentId}
                  onChange={(e) =>
                    setForm({ ...form, parentId: e.target.value })
                  }
                >
                  <option value="">Root category</option>
                  {all
                    .filter((item) => item.id !== editing?.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {"— ".repeat(item.depth) + item.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="space-y-2 text-sm font-medium">
                Display order
                <input
                  className={control}
                  required
                  type="number"
                  min="0"
                  max="1000000"
                  step="1"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm({ ...form, sortOrder: e.target.value })
                  }
                />
              </label>
            </div>
            {text("description", "Description", 10000, true)}
            <fieldset className="space-y-3 rounded-xl border p-4">
              <legend className="px-2 text-sm font-semibold">
                Category image
              </legend>
              {(file
                ? preview
                : !removeImage && editing?.imageUrl
                  ? imageUrl(editing.imageUrl)
                  : "") && (
                <img
                  src={file ? preview : imageUrl(editing!.imageUrl!)}
                  alt="Category preview"
                  className="h-36 w-full rounded-lg object-contain"
                />
              )}
              <input
                aria-label="Choose category image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const image = e.target.files?.[0];
                  if (!image) return;
                  if (
                    image.size > 5 * 1024 * 1024 ||
                    !["image/jpeg", "image/png", "image/webp"].includes(
                      image.type,
                    )
                  ) {
                    setError("Choose a JPG, PNG or WebP up to 5 MB");
                    return;
                  }
                  setFile(image);
                  setRemoveImage(false);
                }}
              />
              <p className="text-xs text-slate-500">
                JPG, PNG or WebP · Up to 5 MB · 32–8192 pixels per side
              </p>
              {(file || editing?.imageUrl) && (
                <button
                  type="button"
                  className="text-sm text-red-600"
                  onClick={() => {
                    setFile(null);
                    setPreview("");
                    setRemoveImage(true);
                  }}
                >
                  Remove image
                </button>
              )}
            </fieldset>
            <fieldset className="space-y-4 rounded-xl border p-4">
              <legend className="px-2 text-sm font-semibold">
                Search engine settings
              </legend>
              {text("metaTitle", "SEO title", 200)}
              {text("metaDescription", "Meta description", 500, true)}
              {text("canonicalUrl", "Canonical URL", 2048)}
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.noIndex}
                  onChange={(e) =>
                    setForm({ ...form, noIndex: e.target.checked })
                  }
                />
                Exclude from search engines
              </label>
            </fieldset>
            <div className="flex flex-wrap gap-4">
              {(["isActive", "isVisible", "isFeatured"] as const).map(
                (key, index) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form[key]}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.checked })
                      }
                    />
                    {["Active", "Storefront visible", "Featured"][index]}
                  </label>
                ),
              )}
            </div>
            <div>
              {editing && <CatalogAudit entity="category" id={editing.id} />}
            </div>
            <button
              disabled={busy}
              className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save category"}
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
