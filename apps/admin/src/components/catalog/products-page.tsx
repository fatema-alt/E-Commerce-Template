"use client";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { MediaUpload } from "@/components/catalog/media-upload";
import {
  api as catalogApi,
  json as catalogJson,
} from "@/components/catalog/catalog-ui";
import { ProductList } from "@/components/catalog/product-list";
import { CatalogAudit } from "@/components/catalog/catalog-audit";
import {
  ProductFields,
  extraDefaults,
  extraFromProduct,
  extraPayload,
} from "@/components/catalog/product-fields";
import {
  Modal,
  useCatalogRole,
  useConfirm,
  useUnsavedChanges,
} from "@/components/catalog/catalog-ui";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  Pencil,
  Trash2,
  History,
  Plus,
  ArrowLeftRight,
  Image as ImageIcon,
  Layers,
  SearchCheck,
  Tag,
} from "lucide-react";

type Category = {
  id: string;
  name: string;
  isActive: boolean;
};

type ProductVariant = {
  id: string;
  name: string;
  sku: string;
  attributes: Record<string, string>;
  price: string;
  salePrice: string | null;
  isActive: boolean;
  isDefault: boolean;
  barcode?: string | null;
  costPrice?: string | null;
  weight?: string | null;
  length?: string | null;
  width?: string | null;
  height?: string | null;
  inventory?: {
    quantity: number;
    reserved: number;
  } | null;
};

export type Product = {
  type: string;
  currency: string;
  isVisible: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string | null;
  brand?: string | null;
  shortDescription?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  price: string;
  salePrice: string | null;
  stock: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  inventory: { quantity: number; reserved: number; lowStockAt: number } | null;
  availableStock: number;
  isActive: boolean;
  categoryId: string;
  category: { id: string; name: string };
  images?: {
    id: string;
    url: string;
    altText: string | null;
    isPrimary: boolean;
    sortOrder: number;
  }[];
  variants?: ProductVariant[];
};

type ProductImage = {
  id: string;
  productId: string;
  url: string;
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
  variantId?: string | null;
};

type StockMovement = {
  id: string;
  type: string;
  quantity: number;
  beforeQty: number;
  afterQty: number;
  reason: string | null;
  createdAt: string;
};
type StockAction = { product: Product; type: "IN" | "OUT" };
type FormData = {
  name: string;
  slug: string;
  sku: string;
  description: string;
  brand: string;
  shortDescription: string;
  metaTitle: string;
  metaDescription: string;
  price: string;
  salePrice: string;
  stock: string;
  categoryId: string;
  isActive: boolean;
};
type VariantForm = {
  stock: string;
  name: string;
  sku: string;
  price: string;
  salePrice: string;
  attributes: string;
  isActive: boolean;
  isDefault: boolean;
  barcode: string;
  costPrice: string;
  weight: string;
  length: string;
  width: string;
  height: string;
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const MEDIA_ORIGIN = new URL(API).origin;

function imageSrc(url: string) {
  return new URL(url, MEDIA_ORIGIN).toString();
}

const initialForm: FormData = {
  name: "",
  slug: "",
  sku: "",
  description: "",
  brand: "",
  shortDescription: "",
  metaTitle: "",
  metaDescription: "",
  price: "",
  salePrice: "",
  stock: "0",
  categoryId: "",
  isActive: false,
};

const initialVariantForm: VariantForm = {
  isDefault: false,
  barcode: "",
  costPrice: "",
  weight: "",
  length: "",
  width: "",
  height: "",
  stock: "0",
  name: "",
  sku: "",
  price: "",
  salePrice: "",
  attributes: '{\n  "size": "M",\n  "color": "Black"\n}',
  isActive: true,
};

function productForm(product: Product): FormData {
  return {
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    description: product.description ?? "",
    brand: product.brand ?? "",
    shortDescription: product.shortDescription ?? "",
    metaTitle: product.metaTitle ?? "",
    metaDescription: product.metaDescription ?? "",
    price: product.price,
    salePrice: product.salePrice ?? "",
    stock: String(product.stock),
    categoryId: product.categoryId,
    isActive: product.isActive,
  };
}
export default function ProductsPage({
  createMode = false,
  initialProduct,
}: {
  createMode?: boolean;
  initialProduct?: Product;
}) {
  const router = useRouter();
  const [revision, setRevision] = useState(0);
  const [extra, setExtra] = useState(() =>
    initialProduct ? extraFromProduct(initialProduct) : extraDefaults,
  );
  const [baseline] = useState(() =>
    JSON.stringify({
      form: initialProduct ? productForm(initialProduct) : initialForm,
      extra: initialProduct ? extraFromProduct(initialProduct) : extraDefaults,
    }),
  );
  const { canEdit, role } = useCatalogRole();
  const { confirm, confirmation } = useConfirm();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<FormData>(() =>
    initialProduct ? productForm(initialProduct) : initialForm,
  );
  const [editingId, setEditingId] = useState<string | null>(
    initialProduct?.id ?? null,
  );
  const [editingVersion] = useState<string | null>(
    initialProduct?.updatedAt ?? null,
  );
  const [showForm, setShowForm] = useState(createMode);
  const [editorTab, setEditorTab] = useState<
    | "general"
    | "pricing"
    | "inventory"
    | "seo"
    | "media"
    | "variants"
    | "shipping"
    | "publishing"
    | "activity"
  >("general");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState("");
  const [stockAction, setStockAction] = useState<StockAction | null>(null);
  const [stockQuantity, setStockQuantity] = useState("1");
  const [stockReason, setStockReason] = useState("");
  const [stockReference, setStockReference] = useState("");
  const [stockSaving, setStockSaving] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [images, setImages] = useState<ProductImage[]>(() =>
    (initialProduct?.images ?? []).map((image) => ({
      ...image,
      productId: initialProduct!.id,
    })),
  );
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState("");
  const [imageSuccess, setImageSuccess] = useState("");

  // Variants
  const [variants, setVariants] = useState<ProductVariant[]>(
    initialProduct?.variants ?? [],
  );
  const [variantLoading, setVariantLoading] = useState(false);
  const [variantBusy, setVariantBusy] = useState(false);
  const [variantError, setVariantError] = useState("");
  const [variantSuccess, setVariantSuccess] = useState("");
  const [variantModal, setVariantModal] = useState(false);
  const [variantSearch, setVariantSearch] = useState("");
  const [variantPrice, setVariantPrice] = useState("");
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [variantForm, setVariantForm] =
    useState<VariantForm>(initialVariantForm);
  const [variantFormError, setVariantFormError] = useState("");

  const loadProducts = useCallback(async () => {
    setRevision((value) => value + 1);
  }, []);
  useUnsavedChanges(showForm && JSON.stringify({ form, extra }) !== baseline);
  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await authenticatedFetch(`${API}/categories/tree`);
        if (!response.ok) throw new Error("Failed to load categories");
        const tree: (Category & { children?: Category[] })[] =
          await response.json();
        const flatten = (
          nodes: (Category & { children?: Category[] })[],
          depth = 0,
        ): Category[] =>
          nodes.flatMap((node) => [
            {
              id: node.id,
              name: "— ".repeat(depth) + node.name,
              isActive: node.isActive,
            },
            ...flatten(node.children ?? [], depth + 1),
          ]);
        setCategories(flatten(tree));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load categories",
        );
      }
    }
    void loadCategories();
  }, []);

  const loadImages = useCallback(async (productId: string) => {
    setImagesLoading(true);
    setImageError("");
    try {
      const response = await authenticatedFetch(
        `${API}/products/${productId}/images`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Could not load product images");
      const result: ProductImage[] = await response.json();
      setImages(result);
    } catch (err) {
      setImageError(
        err instanceof Error ? err.message : "Image loading failed",
      );
    } finally {
      setImagesLoading(false);
    }
  }, []);

  const loadVariants = useCallback(async (productId: string) => {
    setVariantLoading(true);
    setVariantError("");
    try {
      const response = await authenticatedFetch(
        `${API}/products/${productId}/variants`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Could not load variants");
      setVariants(await response.json());
    } catch (err) {
      setVariants([]);
      setVariantError(
        err instanceof Error ? err.message : "Variant loading failed",
      );
    } finally {
      setVariantLoading(false);
    }
  }, []);

  async function readApiError(response: Response, fallback: string) {
    const data = await response.json().catch(() => ({}));
    return Array.isArray(data.message)
      ? data.message.join(", ")
      : data.message || fallback;
  }

  async function setPrimaryImage(imageId: string) {
    if (!editingId || imageBusy) return;
    setImageBusy(true);
    setImageError("");
    setImageSuccess("");
    try {
      const response = await authenticatedFetch(
        `${API}/products/${editingId}/images/${imageId}/primary`,
        { method: "PATCH" },
      );
      if (!response.ok) throw new Error("Could not set primary image");
      setImageSuccess("Primary image updated");
      await loadImages(editingId);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setImageBusy(false);
    }
  }

  async function updateImage(
    imageId: string,
    changes: {
      altText?: string;
      sortOrder?: number;
      variantId?: string | null;
    },
  ) {
    if (!editingId || imageBusy) return;
    setImageBusy(true);
    setImageError("");
    try {
      await catalogApi(
        "/products/" + editingId + "/images/" + imageId,
        catalogJson("PATCH", changes),
      );
      setImageSuccess("Image details updated");
      await loadImages(editingId);
    } catch (error) {
      setImageError(
        error instanceof Error ? error.message : "Image update failed",
      );
    } finally {
      setImageBusy(false);
    }
  }

  async function replaceImage(imageId: string, file: File) {
    if (!editingId || imageBusy) return;
    setImageBusy(true);
    setImageError("");
    try {
      const body = new globalThis.FormData();
      body.append("file", file);
      await catalogApi(
        "/products/" + editingId + "/images/" + imageId + "/replace",
        { method: "POST", body },
      );
      setImageSuccess("Image replaced");
      await loadImages(editingId);
    } catch (error) {
      setImageError(
        error instanceof Error ? error.message : "Image replacement failed",
      );
    } finally {
      setImageBusy(false);
    }
  }

  async function deleteImage(imageId: string) {
    if (
      !editingId ||
      imageBusy ||
      !(await confirm("Remove this image from the gallery?"))
    )
      return;
    setImageBusy(true);
    setImageError("");
    setImageSuccess("");
    try {
      const response = await authenticatedFetch(
        `${API}/products/${editingId}/images/${imageId}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Could not delete image");
      setImageSuccess("Image removed from gallery");
      await loadImages(editingId);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setImageBusy(false);
    }
  }

  // ---------- Variants ----------
  function openVariantModal(variant?: ProductVariant) {
    setVariantFormError("");
    if (variant) {
      setEditingVariantId(variant.id);
      setVariantForm({
        isDefault: variant.isDefault,
        barcode: variant.barcode ?? "",
        costPrice: variant.costPrice ?? "",
        weight: variant.weight ?? "",
        length: variant.length ?? "",
        width: variant.width ?? "",
        height: variant.height ?? "",
        stock: String(variant.inventory?.quantity ?? 0),
        name: variant.name,
        sku: variant.sku,
        price: variant.price,
        salePrice: variant.salePrice ?? "",
        attributes: JSON.stringify(variant.attributes ?? {}, null, 2),
        isActive: variant.isActive,
      });
    } else {
      setEditingVariantId(null);
      setVariantForm({ ...initialVariantForm, price: form.price });
    }
    setVariantModal(true);
  }

  function closeVariantModal() {
    if (variantBusy) return;
    setVariantModal(false);
    setEditingVariantId(null);
    setVariantFormError("");
  }

  async function saveVariant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId || variantBusy) return;

    const name = variantForm.name.trim();
    const sku = variantForm.sku.trim();
    const stock = Number(variantForm.stock);
    const price = Number(variantForm.price);
    const salePrice =
      variantForm.salePrice.trim() === ""
        ? null
        : Number(variantForm.salePrice);

    if (
      !editingVariantId &&
      (variantForm.stock.trim() === "" ||
        !Number.isSafeInteger(stock) ||
        stock < 0)
    )
      return setVariantFormError(
        "Opening stock must be a non-negative whole number",
      );
    if (name.length < 1) return setVariantFormError("Variant name is required");
    if (!sku) return setVariantFormError("Variant SKU is required");
    if (variantForm.price.trim() === "" || !Number.isFinite(price) || price < 0)
      return setVariantFormError("Enter a valid price");
    if (
      salePrice !== null &&
      (!Number.isFinite(salePrice) || salePrice < 0 || salePrice > price)
    )
      return setVariantFormError(
        "Sale price must be between 0 and the regular price",
      );

    let attributes: Record<string, string>;
    try {
      const parsed = JSON.parse(variantForm.attributes || "{}");
      if (
        parsed === null ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      )
        throw new Error();
      attributes = Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [
          k,
          String(v),
        ]),
      );
    } catch {
      return setVariantFormError(
        'Attributes must be a valid JSON object, e.g. {"size":"M","color":"Black"}',
      );
    }

    setVariantBusy(true);
    setVariantFormError("");
    setVariantError("");
    setVariantSuccess("");
    try {
      const url = editingVariantId
        ? `${API}/products/${editingId}/variants/${editingVariantId}`
        : `${API}/products/${editingId}/variants`;
      const response = await authenticatedFetch(url, {
        method: editingVariantId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          sku,
          price: variantForm.price,
          salePrice: variantForm.salePrice || null,
          attributes,
          isActive: variantForm.isActive,
          isDefault: variantForm.isDefault,
          barcode: variantForm.barcode || null,
          costPrice: variantForm.costPrice || null,
          weight: variantForm.weight || null,
          length: variantForm.length || null,
          width: variantForm.width || null,
          height: variantForm.height || null,
          ...(!editingVariantId ? { stock } : {}),
        }),
      });
      if (!response.ok)
        throw new Error(await readApiError(response, "Failed to save variant"));
      setVariantSuccess(
        editingVariantId
          ? "Variant updated successfully"
          : "Variant created successfully",
      );
      setVariantModal(false);
      setEditingVariantId(null);
      await loadVariants(editingId);
    } catch (err) {
      setVariantFormError(
        err instanceof Error ? err.message : "Failed to save variant",
      );
    } finally {
      setVariantBusy(false);
    }
  }

  async function deleteVariant(variant: ProductVariant) {
    if (
      !editingId ||
      variantBusy ||
      !(await confirm(
        `Deactivate variant "${variant.name}"? Stock history will be retained.`,
      ))
    )
      return;
    setVariantBusy(true);
    setVariantError("");
    setVariantSuccess("");
    try {
      const response = await authenticatedFetch(
        `${API}/products/${editingId}/variants/${variant.id}`,
        { method: "DELETE" },
      );
      if (!response.ok)
        throw new Error(
          await readApiError(response, "Failed to delete variant"),
        );
      setVariantSuccess("Variant deleted successfully");
      await loadVariants(editingId);
    } catch (err) {
      setVariantError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setVariantBusy(false);
    }
  }

  async function generateVariants() {
    if (
      !editingId ||
      !(await confirm(
        "Generate all saved option combinations with zero opening stock? Existing combinations will be skipped.",
      ))
    )
      return;
    setVariantBusy(true);
    setVariantError("");
    try {
      const result = await catalogApi<{
        results: { name: string; success: boolean; error?: string }[];
      }>(
        "/products/" + editingId + "/variants/generate",
        catalogJson("POST", { skuPrefix: form.sku }),
      );
      setVariantSuccess(
        result.results.filter((row) => row.success).length +
          " combinations completed",
      );
      setVariantError(
        result.results
          .filter((row) => !row.success)
          .map((row) => row.name + ": " + row.error)
          .join("; "),
      );
      await loadVariants(editingId);
    } catch (error) {
      setVariantError(
        error instanceof Error ? error.message : "Generation failed",
      );
    } finally {
      setVariantBusy(false);
    }
  }
  async function bulkVariantPrice() {
    if (
      !editingId ||
      !(await confirm(
        "Set the regular price of all variants to " +
          variantPrice +
          "? Invalid sale-price relationships will be reported.",
      ))
    )
      return;
    setVariantBusy(true);
    setVariantError("");
    try {
      const results: { success: boolean; error?: string }[] = [];
      for (let index = 0; index < variants.length; index += 100) {
        const result = await catalogApi<{ results: typeof results }>(
          "/products/" + editingId + "/variants/bulk",
          catalogJson("POST", {
            ids: variants.slice(index, index + 100).map((row) => row.id),
            price: variantPrice,
          }),
        );
        results.push(...result.results);
      }
      setVariantSuccess(
        results.filter((row) => row.success).length + " variants updated",
      );
      setVariantError(
        results
          .filter((row) => !row.success)
          .map((row) => row.error)
          .join("; "),
      );
      await loadVariants(editingId);
    } catch (error) {
      setVariantError(
        error instanceof Error ? error.message : "Bulk update failed",
      );
    } finally {
      setVariantBusy(false);
    }
  }

  function resetForm() {
    if (createMode) router.push("/products");
    setFieldErrors({});
    setExtra(extraDefaults);
    setForm(initialForm);
    setEditingId(null);
    setShowForm(false);
    setEditorTab("general");
    setVariants([]);
    setVariantModal(false);
    setEditingVariantId(null);
    setVariantError("");
    setVariantSuccess("");
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (form.name.trim().length < 2 || form.name.length > 200)
      errors.name = "Use a product name of 2?200 characters.";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug) || form.slug.length > 200)
      errors.slug =
        "Use lowercase letters, numbers and single hyphens (up to 200 characters).";
    if (!form.sku.trim() || form.sku.length > 100)
      errors.sku = "Enter a unique SKU of up to 100 characters.";
    if (!form.categoryId) errors.categoryId = "Select a category.";
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(form.price))
      errors.price =
        "Enter a non-negative price with at most two decimal places.";
    if (
      form.salePrice &&
      (!/^\d{1,10}(\.\d{1,2})?$/.test(form.salePrice) ||
        Number(form.salePrice) > Number(form.price))
    )
      errors.salePrice =
        "Sale price must be a valid amount no greater than regular price.";
    if (
      !editingId &&
      (!form.stock.trim() ||
        !Number.isSafeInteger(Number(form.stock)) ||
        Number(form.stock) < 0 ||
        Number(form.stock) > 2147483647)
    )
      errors.stock = "Enter a non-negative whole-number opening quantity.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setError("Correct the highlighted product fields.");
      setEditorTab(
        errors.name || errors.slug || errors.sku || errors.categoryId
          ? "general"
          : errors.stock
            ? "inventory"
            : "pricing",
      );
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        sku: form.sku.trim(),
        description: form.description,
        brand: form.brand.trim() || null,
        shortDescription: form.shortDescription.trim() || null,
        metaTitle: form.metaTitle.trim() || null,
        metaDescription: form.metaDescription.trim() || null,
        price: form.price,
        salePrice: form.salePrice || null,
        ...(!editingId
          ? { stock: Number(form.stock) }
          : { expectedUpdatedAt: editingVersion }),
        categoryId: form.categoryId,
        ...extraPayload(extra),
      };
      const response = await authenticatedFetch(
        editingId ? `${API}/products/${editingId}` : `${API}/products`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok)
        throw new Error(await readApiError(response, "Failed to save product"));
      setSuccess(
        editingId
          ? "Product updated successfully"
          : "Product created successfully",
      );
      resetForm();
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(product: Product) {
    if (
      !(await confirm(
        `Soft delete "${product.name}"? Inventory history will be retained.`,
      ))
    )
      return;
    setError("");
    setSuccess("");
    try {
      const response = await authenticatedFetch(
        `${API}/products/${product.id}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Failed to delete product");
      setSuccess("Product deleted successfully");
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function submitStockAdjustment(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!stockAction || stockSaving) return;
    const quantity = Number(stockQuantity);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      setError("Enter a valid positive whole-number quantity");
      return;
    }
    if (
      stockAction.type === "OUT" &&
      quantity > stockAction.product.availableStock
    ) {
      setError("Quantity exceeds available stock");
      return;
    }
    setStockSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await authenticatedFetch(
        `${API}/products/${stockAction.product.id}/stock-adjustments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: stockAction.type,
            quantity,
            reason: stockReason.trim() || undefined,
            referenceId: stockReference.trim() || undefined,
          }),
        },
      );
      if (!response.ok)
        throw new Error(
          await readApiError(response, "Stock adjustment failed"),
        );
      setSuccess(
        `Stock ${stockAction.type === "IN" ? "increased" : "decreased"} successfully`,
      );
      setStockAction(null);
      setStockQuantity("1");
      setStockReason("");
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stock adjustment failed");
    } finally {
      setStockSaving(false);
    }
  }

  async function showStockHistory(product: Product) {
    setHistoryProduct(product);
    setMovements([]);
    setHistoryLoading(true);
    setError("");
    try {
      const response = await authenticatedFetch(
        `${API}/products/${product.id}/stock-movements`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Failed to load stock history");
      setMovements(await response.json());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load stock history",
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500";

  return (
    <div className="space-y-7">
      {confirmation}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-indigo-600">
            CATALOG / PRODUCTS
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            {createMode
              ? editingId
                ? "Edit Product"
                : "Add Product"
              : "All Products"}
          </h1>
          <p className="mt-2 text-slate-500">
            Manage products, prices, categories and inventory.
          </p>
        </div>
        {createMode ? (
          <button
            type="button"
            onClick={async () => {
              if (
                JSON.stringify({ form, extra }) === baseline ||
                (await confirm("Discard unsaved product changes?"))
              )
                resetForm();
            }}
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium"
          >
            Back to All Products
          </button>
        ) : (
          canEdit && (
            <button
              onClick={() => router.push("/products/add")}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700"
            >
              <Plus size={18} />
              Add New Product
            </button>
          )
        )}
      </div>
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="rounded-xl bg-green-50 p-4 text-green-700"
        >
          {success}
        </div>
      )}
      {createMode && role === "STAFF" && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
          You do not have permission to edit products.
        </p>
      )}
      {showForm && canEdit && (
        <form
          onSubmit={saveProduct}
          noValidate
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="mb-6 text-xl font-bold">
            {editingId ? "Edit Product" : "Create Product"}
          </h2>
          <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-4">
            {(
              [
                ["general", "General", Tag],
                ["pricing", "Pricing", Package],
                ["inventory", "Inventory", ArrowLeftRight],
                ["seo", "SEO", SearchCheck],
                ["media", "Images", ImageIcon],
                ["variants", "Variants", Layers],
                ["shipping", "Shipping", Package],
                ["publishing", "Publishing", Tag],
                ["activity", "Activity", History],
              ] as const
            ).map(([tab, label, Icon]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setEditorTab(tab)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${editorTab === tab ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>
          <div className="mb-4 rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
            {editorTab === "general" &&
              "Basic product information and category."}
            {editorTab === "pricing" &&
              "Regular price and optional discounted price."}
            {editorTab === "inventory" &&
              "Opening quantity for new products; use stock adjustments for existing products."}
            {editorTab === "seo" &&
              "Search-engine title and description are saved to the product database."}
            {editorTab === "media" &&
              "Upload JPG, PNG or WebP images (up to 5 MB). Save a new product before uploading images."}
            {editorTab === "variants" &&
              "Manage size/color variants with their own SKU, price and attributes. Save the product first to add variants."}
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <ProductFields
              tab={editorTab}
              value={extra}
              onChange={setExtra}
              regularPrice={form.price}
            />
            {editorTab === "activity" && (
              <div className="md:col-span-2">
                {editingId ? (
                  <CatalogAudit entity="product" id={editingId} />
                ) : (
                  <p className="text-sm text-slate-500">
                    Save the product to start its audit history.
                  </p>
                )}
              </div>
            )}
            <div className={editorTab === "general" ? "contents" : "hidden"}>
              <label className="space-y-2 text-sm font-medium">
                Product Name
                <input
                  className={inputClass}
                  required
                  minLength={2}
                  aria-invalid={!!fieldErrors.name}
                  aria-describedby={
                    fieldErrors.name ? "product-error-name" : undefined
                  }
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      name,
                      slug: editingId
                        ? prev.slug
                        : name
                            .toLowerCase()
                            .trim()
                            .replace(/[^a-z0-9]+/g, "-")
                            .replace(/^-|-$/g, ""),
                    }));
                  }}
                />
                {fieldErrors.name && (
                  <span
                    id="product-error-name"
                    className="block text-xs text-red-700"
                  >
                    {fieldErrors.name}
                  </span>
                )}
              </label>
              <label className="space-y-2 text-sm font-medium">
                Slug
                <input
                  className={inputClass}
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  aria-invalid={!!fieldErrors.slug}
                  aria-describedby={
                    fieldErrors.slug ? "product-error-slug" : undefined
                  }
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                />
                {fieldErrors.slug && (
                  <span
                    id="product-error-slug"
                    className="block text-xs text-red-700"
                  >
                    {fieldErrors.slug}
                  </span>
                )}
              </label>
              <label className="space-y-2 text-sm font-medium">
                SKU
                <input
                  className={inputClass}
                  required
                  aria-invalid={!!fieldErrors.sku}
                  aria-describedby={
                    fieldErrors.sku ? "product-error-sku" : undefined
                  }
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                />
                {fieldErrors.sku && (
                  <span
                    id="product-error-sku"
                    className="block text-xs text-red-700"
                  >
                    {fieldErrors.sku}
                  </span>
                )}
              </label>
              <label className="space-y-2 text-sm font-medium">
                Category
                <select
                  className={inputClass}
                  required
                  aria-invalid={!!fieldErrors.categoryId}
                  aria-describedby={
                    fieldErrors.categoryId
                      ? "product-error-categoryId"
                      : undefined
                  }
                  value={form.categoryId}
                  onChange={(e) =>
                    setForm({ ...form, categoryId: e.target.value })
                  }
                >
                  <option value="">Select category</option>
                  {categories
                    .filter((c) => c.isActive || c.id === form.categoryId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                {fieldErrors.categoryId && (
                  <span
                    id="product-error-categoryId"
                    className="block text-xs text-red-700"
                  >
                    {fieldErrors.categoryId}
                  </span>
                )}
              </label>
              <label className="space-y-2 text-sm font-medium">
                Brand
                <input
                  className={inputClass}
                  maxLength={150}
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  placeholder="Optional brand"
                />
              </label>
              <label className="space-y-2 text-sm font-medium md:col-span-2">
                Short Description
                <textarea
                  className={inputClass}
                  rows={2}
                  maxLength={500}
                  value={form.shortDescription}
                  onChange={(e) =>
                    setForm({ ...form, shortDescription: e.target.value })
                  }
                />
              </label>
              <label className="space-y-2 text-sm font-medium md:col-span-2">
                Full Description
                <textarea
                  className={inputClass}
                  rows={5}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </label>
            </div>
            <div className={editorTab === "pricing" ? "contents" : "hidden"}>
              <label className="space-y-2 text-sm font-medium">
                Regular Price (BDT)
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  aria-invalid={!!fieldErrors.price}
                  aria-describedby={
                    fieldErrors.price ? "product-error-price" : undefined
                  }
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
                {fieldErrors.price && (
                  <span
                    id="product-error-price"
                    className="block text-xs text-red-700"
                  >
                    {fieldErrors.price}
                  </span>
                )}
              </label>
              <label className="space-y-2 text-sm font-medium">
                Sale Price (BDT)
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  step="0.01"
                  aria-invalid={!!fieldErrors.salePrice}
                  aria-describedby={
                    fieldErrors.salePrice
                      ? "product-error-salePrice"
                      : undefined
                  }
                  value={form.salePrice}
                  onChange={(e) =>
                    setForm({ ...form, salePrice: e.target.value })
                  }
                />
                {fieldErrors.salePrice && (
                  <span
                    id="product-error-salePrice"
                    className="block text-xs text-red-700"
                  >
                    {fieldErrors.salePrice}
                  </span>
                )}
              </label>
              {form.price &&
                form.salePrice &&
                Number(form.price) > Number(form.salePrice) && (
                  <p className="text-sm font-medium text-green-700 md:col-span-2">
                    Discount:{" "}
                    {Math.round(
                      (1 - Number(form.salePrice) / Number(form.price)) * 100,
                    )}
                    %
                  </p>
                )}
            </div>
            <div className={editorTab === "inventory" ? "contents" : "hidden"}>
              <label className="space-y-2 text-sm font-medium">
                Stock Quantity
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  step="1"
                  required
                  disabled={!!editingId || extra.type === "VARIABLE"}
                  aria-invalid={!!fieldErrors.stock}
                  aria-describedby={
                    fieldErrors.stock ? "product-error-stock" : undefined
                  }
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
                {fieldErrors.stock && (
                  <span
                    id="product-error-stock"
                    className="block text-xs text-red-700"
                  >
                    {fieldErrors.stock}
                  </span>
                )}
              </label>
              <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
                {editingId
                  ? "To record a reason for a stock change, use the IN/OUT actions in the product table."
                  : "This quantity will create an opening inventory movement when the product is saved."}
              </div>
            </div>
            <div className={editorTab === "seo" ? "contents" : "hidden"}>
              <label className="space-y-2 text-sm font-medium md:col-span-2">
                Meta Title
                <input
                  className={inputClass}
                  maxLength={200}
                  value={form.metaTitle}
                  onChange={(e) =>
                    setForm({ ...form, metaTitle: e.target.value })
                  }
                  placeholder={form.name || "Search result title"}
                />
                <span className="block text-xs text-slate-400">
                  {form.metaTitle.length}/200 characters
                </span>
              </label>
              <label className="space-y-2 text-sm font-medium md:col-span-2">
                Meta Description
                <textarea
                  className={inputClass}
                  rows={4}
                  maxLength={500}
                  value={form.metaDescription}
                  onChange={(e) =>
                    setForm({ ...form, metaDescription: e.target.value })
                  }
                  placeholder="Short search result description"
                />
                <span className="block text-xs text-slate-400">
                  {form.metaDescription.length}/500 characters
                </span>
              </label>
              <div className="md:col-span-2 rounded-xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Search preview
                </p>
                <p className="mt-2 text-lg font-medium text-blue-700">
                  {form.metaTitle || form.name || "Product title"}
                </p>
                <p className="text-sm text-green-700">
                  /products/{form.slug || "product-slug"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {form.metaDescription ||
                    form.shortDescription ||
                    "Product description"}
                </p>
              </div>
            </div>
            {editorTab === "media" && (
              <div className="md:col-span-2 space-y-5">
                {!editingId ? (
                  <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50 p-6 text-sm text-indigo-800">
                    First complete the required product fields and click Create
                    Product. Then edit the saved product to upload images.
                  </div>
                ) : (
                  <>
                    <MediaUpload
                      productId={editingId}
                      onUploaded={() => {
                        void loadImages(editingId);
                        void loadProducts();
                      }}
                    />
                    {imageError && (
                      <p
                        role="alert"
                        className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
                      >
                        {imageError}
                      </p>
                    )}
                    {imageSuccess && (
                      <p
                        role="status"
                        className="rounded-lg bg-green-50 p-3 text-sm text-green-700"
                      >
                        {imageSuccess}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">
                        Image gallery ({images.length})
                      </h3>
                      <button
                        type="button"
                        onClick={() => void loadImages(editingId)}
                        className="text-sm text-indigo-600"
                      >
                        Refresh gallery
                      </button>
                    </div>
                    {imagesLoading ? (
                      <p className="text-sm text-slate-500">
                        Loading images...
                      </p>
                    ) : images.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                        No images uploaded yet.
                      </div>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {images.map((image) => (
                          <div
                            key={image.id}
                            className="overflow-hidden rounded-xl border border-slate-200"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imageSrc(image.url)}
                              alt={image.altText || "Product image"}
                              className="h-44 w-full bg-slate-100 object-contain"
                            />
                            <div className="space-y-3 p-3">
                              <label className="block text-xs text-slate-500">
                                Alt text
                                <input
                                  className={inputClass}
                                  aria-label={
                                    "Alt text for image " +
                                    (image.sortOrder + 1)
                                  }
                                  maxLength={200}
                                  value={image.altText ?? ""}
                                  onChange={(e) =>
                                    setImages((prev) =>
                                      prev.map((item) =>
                                        item.id === image.id
                                          ? { ...item, altText: e.target.value }
                                          : item,
                                      ),
                                    )
                                  }
                                  onBlur={() =>
                                    void updateImage(image.id, {
                                      altText: image.altText ?? "",
                                    })
                                  }
                                />
                              </label>
                              <label className="block text-xs text-slate-500">
                                Display order
                                <input
                                  className={inputClass}
                                  type="number"
                                  min="0"
                                  max="1000"
                                  value={image.sortOrder}
                                  onChange={(e) =>
                                    setImages((prev) =>
                                      prev.map((item) =>
                                        item.id === image.id
                                          ? {
                                              ...item,
                                              sortOrder: Number(e.target.value),
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                  onBlur={() =>
                                    void updateImage(image.id, {
                                      sortOrder: image.sortOrder,
                                    })
                                  }
                                />
                              </label>
                              <label className="block text-xs text-slate-500">
                                Variant
                                <select
                                  className={inputClass}
                                  value={image.variantId ?? ""}
                                  onChange={(e) =>
                                    void updateImage(image.id, {
                                      variantId: e.target.value || null,
                                    })
                                  }
                                >
                                  <option value="">
                                    All variants / product
                                  </option>
                                  {variants.map((variant) => (
                                    <option key={variant.id} value={variant.id}>
                                      {variant.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="block text-xs text-slate-500">
                                Replace image
                                <input
                                  type="file"
                                  disabled={imageBusy}
                                  accept="image/jpeg,image/png,image/webp"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) void replaceImage(image.id, file);
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                              {image.isPrimary && (
                                <span className="text-xs font-semibold text-green-700">
                                  Primary image
                                </span>
                              )}
                              <div className="flex flex-wrap gap-2">
                                {!image.isPrimary && (
                                  <button
                                    type="button"
                                    disabled={imageBusy}
                                    onClick={() =>
                                      void setPrimaryImage(image.id)
                                    }
                                    className="rounded-lg border px-3 py-2 text-xs disabled:opacity-50"
                                  >
                                    Set Primary
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={imageBusy}
                                  onClick={() => void deleteImage(image.id)}
                                  className="rounded-lg border border-red-200 px-3 py-2 text-xs text-red-700 disabled:opacity-50"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {editorTab === "variants" && (
              <div className="md:col-span-2 space-y-5">
                {!editingId ? (
                  <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50 p-6 text-sm text-indigo-800">
                    First complete the required product fields and click Create
                    Product. Then edit the saved product to add variants.
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="font-semibold">
                        Variants ({variants.length})
                      </h3>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => void loadVariants(editingId)}
                          className="text-sm text-indigo-600"
                        >
                          Refresh
                        </button>
                        <button
                          type="button"
                          onClick={() => openVariantModal()}
                          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                        >
                          <Plus size={15} /> Add Variant
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <input
                        aria-label="Search variants"
                        className={inputClass + " max-w-xs"}
                        placeholder="Search variant name or SKU"
                        value={variantSearch}
                        onChange={(e) => setVariantSearch(e.target.value)}
                      />
                      <button
                        type="button"
                        disabled={variantBusy || extra.type !== "VARIABLE"}
                        className="rounded-lg border px-3 py-2 text-sm"
                        onClick={() => void generateVariants()}
                      >
                        Generate combinations
                      </button>
                      <input
                        aria-label="Bulk variant price"
                        className={inputClass + " max-w-40"}
                        type="number"
                        min="0"
                        step=".01"
                        placeholder="New price"
                        value={variantPrice}
                        onChange={(e) => setVariantPrice(e.target.value)}
                      />
                      <button
                        type="button"
                        disabled={
                          variantBusy || !variantPrice || !variants.length
                        }
                        className="rounded-lg border px-3 py-2 text-sm"
                        onClick={() => void bulkVariantPrice()}
                      >
                        Price all variants
                      </button>
                    </div>
                    {variantError && (
                      <p
                        role="alert"
                        className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
                      >
                        {variantError}
                      </p>
                    )}
                    {variantSuccess && (
                      <p
                        role="status"
                        className="rounded-lg bg-green-50 p-3 text-sm text-green-700"
                      >
                        {variantSuccess}
                      </p>
                    )}
                    {variantLoading ? (
                      <p className="text-sm text-slate-500">
                        Loading variants...
                      </p>
                    ) : variants.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
                        No variants yet. Click “Add Variant” to create a
                        size/color combination.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full min-w-[720px] text-left text-sm">
                          <thead className="bg-slate-50 text-slate-500">
                            <tr>
                              <th className="p-3">Variant</th>
                              <th className="p-3">SKU</th>
                              <th className="p-3">Attributes</th>
                              <th className="p-3">Price</th>
                              <th className="p-3">Stock</th>
                              <th className="p-3">Status</th>
                              <th className="p-3">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {variants
                              .filter((variant) =>
                                (variant.name + " " + variant.sku)
                                  .toLowerCase()
                                  .includes(variantSearch.toLowerCase()),
                              )
                              .map((variant) => (
                                <tr key={variant.id} className="border-t">
                                  <td className="p-3 font-semibold text-slate-900">
                                    {variant.name}
                                    {variant.isDefault && (
                                      <span className="ml-2 rounded bg-indigo-50 px-2 py-1 text-xs text-indigo-600">
                                        Default
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3 text-slate-500">
                                    {variant.sku}
                                  </td>
                                  <td className="p-3">
                                    <div className="flex flex-wrap gap-1">
                                      {Object.entries(
                                        variant.attributes ?? {},
                                      ).map(([key, value]) => (
                                        <span
                                          key={key}
                                          className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600"
                                        >
                                          {key}: {value}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    {variant.salePrice ? (
                                      <>
                                        <span className="font-semibold">
                                          ৳
                                          {Number(variant.salePrice).toFixed(2)}
                                        </span>{" "}
                                        <span className="text-xs text-slate-400 line-through">
                                          ৳{Number(variant.price).toFixed(2)}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="font-semibold">
                                        ৳{Number(variant.price).toFixed(2)}
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    {variant.inventory ? (
                                      <>
                                        <div className="font-semibold">
                                          {variant.inventory.quantity}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                          {variant.inventory.reserved} reserved
                                        </div>
                                      </>
                                    ) : (
                                      <span className="text-slate-400">—</span>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    <span
                                      className={
                                        variant.isActive
                                          ? "text-green-700"
                                          : "text-slate-500"
                                      }
                                    >
                                      {variant.isActive ? "ACTIVE" : "INACTIVE"}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    <div className="flex gap-3">
                                      <button
                                        type="button"
                                        disabled={variantBusy}
                                        onClick={() =>
                                          openVariantModal(variant)
                                        }
                                        className="text-indigo-600 disabled:opacity-50"
                                        aria-label={`Edit variant ${variant.name}`}
                                      >
                                        <Pencil size={16} />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={variantBusy}
                                        onClick={() =>
                                          void deleteVariant(variant)
                                        }
                                        className="text-red-600 disabled:opacity-50"
                                        aria-label={`Delete variant ${variant.name}`}
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Product"
                  : "Create Product"}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (
                  JSON.stringify({ form, extra }) === baseline ||
                  (await confirm("Discard unsaved product changes?"))
                )
                  resetForm();
              }}
              className="rounded-xl border border-slate-200 px-6 py-3"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {!createMode && (
        <ProductList
          revision={revision}
          categories={categories}
          onEdit={(product) => router.push("/products/" + product.id + "/edit")}
          onStock={(product, type) => {
            setStockAction({ product, type });
            setStockQuantity("1");
            setStockReason("");
            setStockReference("");
          }}
          onHistory={(product) => void showStockHistory(product)}
          onDelete={(product) => void deleteProduct(product)}
        />
      )}

      {variantModal && (
        <Modal
          title={editingVariantId ? "Edit variant" : "Add variant"}
          busy={variantBusy}
          onClose={closeVariantModal}
        >
          <form
            onSubmit={saveVariant}
            noValidate
            role="dialog"
            aria-modal="true"
            aria-label="Variant editor"
            className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-xl font-bold">
              {editingVariantId ? "Edit Variant" : "Add Variant"}
            </h2>
            {variantFormError && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
              >
                {variantFormError}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2 text-sm font-medium">
                Variant Name
                <input
                  className={inputClass}
                  value={variantForm.name}
                  placeholder="e.g. Black / M"
                  onChange={(e) =>
                    setVariantForm({ ...variantForm, name: e.target.value })
                  }
                />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                SKU
                <input
                  className={inputClass}
                  value={variantForm.sku}
                  onChange={(e) =>
                    setVariantForm({ ...variantForm, sku: e.target.value })
                  }
                />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                Price (BDT)
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  step="0.01"
                  value={variantForm.price}
                  onChange={(e) =>
                    setVariantForm({ ...variantForm, price: e.target.value })
                  }
                />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                Sale Price (BDT)
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  step="0.01"
                  value={variantForm.salePrice}
                  onChange={(e) =>
                    setVariantForm({
                      ...variantForm,
                      salePrice: e.target.value,
                    })
                  }
                />
              </label>
              {!editingVariantId && (
                <label className="block space-y-2 text-sm font-medium">
                  Opening Stock
                  <input
                    className={inputClass}
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={variantForm.stock}
                    onChange={(e) =>
                      setVariantForm({ ...variantForm, stock: e.target.value })
                    }
                  />
                </label>
              )}
            </div>
            <label className="block space-y-2 text-sm font-medium">
              Attributes (JSON)
              <textarea
                className={`${inputClass} font-mono`}
                rows={5}
                value={variantForm.attributes}
                onChange={(e) =>
                  setVariantForm({ ...variantForm, attributes: e.target.value })
                }
              />
              <span className="block text-xs text-slate-400">
                {'Example: {"size":"M","color":"Black"}'}
              </span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  "barcode",
                  "costPrice",
                  "weight",
                  "length",
                  "width",
                  "height",
                ] as const
              ).map((key) => (
                <label key={key} className="space-y-2 text-sm font-medium">
                  {key === "costPrice"
                    ? "Cost price"
                    : key[0].toUpperCase() + key.slice(1)}
                  <input
                    className={inputClass}
                    type={key === "barcode" ? "text" : "number"}
                    min="0"
                    step={key === "costPrice" ? ".01" : ".001"}
                    value={variantForm[key]}
                    onChange={(e) =>
                      setVariantForm({ ...variantForm, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
            </div>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={variantForm.isDefault}
                onChange={(e) =>
                  setVariantForm({
                    ...variantForm,
                    isDefault: e.target.checked,
                  })
                }
              />
              Default variant
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={variantForm.isActive}
                onChange={(e) =>
                  setVariantForm({ ...variantForm, isActive: e.target.checked })
                }
              />{" "}
              Active Variant
            </label>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={variantBusy}
                className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
              >
                {variantBusy
                  ? "Saving..."
                  : editingVariantId
                    ? "Update Variant"
                    : "Create Variant"}
              </button>
              <button
                type="button"
                disabled={variantBusy}
                onClick={closeVariantModal}
                className="rounded-xl border px-5 py-3"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {stockAction && (
        <Modal
          title="Stock adjustment"
          busy={stockSaving}
          onClose={() => setStockAction(null)}
        >
          <form
            onSubmit={submitStockAdjustment}
            role="dialog"
            aria-modal="true"
            aria-label="Stock adjustment"
            className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-xl font-bold">
              Stock {stockAction.type} · {stockAction.product.name}
            </h2>
            <p className="text-sm text-slate-600">
              Available: {stockAction.product.availableStock} · Reserved:{" "}
              {stockAction.product.inventory?.reserved ?? 0}
            </p>
            <label className="block space-y-2 text-sm font-medium">
              Quantity
              <input
                type="number"
                min="1"
                step="1"
                required
                className={inputClass}
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
              />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              Reference
              <input
                className={inputClass}
                maxLength={100}
                value={stockReference}
                onChange={(event) => setStockReference(event.target.value)}
              />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              Reason (optional)
              <textarea
                className={inputClass}
                maxLength={500}
                rows={3}
                value={stockReason}
                onChange={(e) => setStockReason(e.target.value)}
              />
            </label>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={stockSaving}
                className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
              >
                {stockSaving
                  ? "Saving..."
                  : `Confirm Stock ${stockAction.type}`}
              </button>
              <button
                type="button"
                disabled={stockSaving}
                onClick={() => setStockAction(null)}
                className="rounded-xl border px-5 py-3"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
      {historyProduct && (
        <Modal
          title="Stock movement history"
          onClose={() => setHistoryProduct(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Stock movement history"
            className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold">
                Stock History · {historyProduct.name}
              </h2>
              <button
                onClick={() => setHistoryProduct(null)}
                className="rounded-lg border px-4 py-2"
              >
                Close
              </button>
            </div>
            <div className="max-h-[65vh] overflow-auto">
              {historyLoading ? (
                <p className="p-4">Loading history...</p>
              ) : movements.length === 0 ? (
                <p className="p-4 text-slate-500">No movements found.</p>
              ) : (
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Qty</th>
                      <th className="p-3">Before → After</th>
                      <th className="p-3">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((movement) => (
                      <tr key={movement.id} className="border-t">
                        <td className="p-3">
                          {new Date(movement.createdAt).toLocaleString()}
                        </td>
                        <td className="p-3">{movement.type}</td>
                        <td className="p-3">{movement.quantity}</td>
                        <td className="p-3">
                          {movement.beforeQty} → {movement.afterQty}
                        </td>
                        <td className="p-3">{movement.reason || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </Modal>
      )}
    </div>
  );
}
