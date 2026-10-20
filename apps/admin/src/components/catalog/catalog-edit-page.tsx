"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ProductsPage, { type Product } from "./products-page";
import CategoriesPage, { type Category } from "./categories-page";
import { api, button } from "./catalog-ui";

export default function CatalogEditPage({
  entity,
  id,
}: {
  entity: "products" | "categories";
  id: string;
}) {
  const [record, setRecord] = useState<Product | Category | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void api<Product | Category>("/" + entity + "/" + id, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) {
          setRecord(data);
          setError("");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Unable to load this record",
          );
      });
    return () => controller.abort();
  }, [entity, id, retry]);

  if (error)
    return (
      <div
        role="alert"
        className="space-y-4 rounded-xl bg-red-50 p-6 text-red-700"
      >
        <p>{error}</p>
        <button
          className={button}
          onClick={() => setRetry((value) => value + 1)}
        >
          Retry
        </button>
        <Link className="ml-4 underline" href={"/" + entity}>
          Back to list
        </Link>
      </div>
    );
  if (!record)
    return (
      <div
        aria-label="Loading editor"
        className="h-64 animate-pulse rounded-2xl bg-white"
      />
    );
  return entity === "products" ? (
    <ProductsPage key={id} createMode initialProduct={record as Product} />
  ) : (
    <CategoriesPage key={id} createMode initialCategory={record as Category} />
  );
}
