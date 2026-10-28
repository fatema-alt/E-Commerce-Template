import { authenticatedFetch } from "@/lib/authenticated-fetch";
export const API =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
export type Value =
  string | number | boolean | null | Value[] | { [key: string]: Value };
export type Schema = {
  type: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  enum?: string[];
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  maxItems?: number;
  minItems?: number;
  pattern?: string;
  format?: string;
};
export type Asset = {
  id: string;
  url: string | null;
  thumbnailUrl: string | null;
  bytes: number;
  altText: string | null;
};
export type Registry = {
  documents: Record<string, Schema>;
  blocks: Record<string, Schema>;
  defaultTheme: Record<string, Value>;
};
export type Document = {
  title?: string;
  key: string;
  revision: number;
  state: string;
  publishedVersionId: string | null;
  scheduledAt: string | null;
  latestVersion: { id?:string; version: number; content: Record<string, Value> } | null;
};
export class CmsRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "CmsRequestError";
  }
}
export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await authenticatedFetch(API + path, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new CmsRequestError(
      response.status === 409
        ? "This document changed elsewhere. Reload before saving; your edits remain on screen."
        : Array.isArray(body.message)
          ? body.message.join(", ")
          : body.message || `Request failed (${response.status})`,
      response.status,
    );
  }
  return response.json();
}
export function initialValue(schema: Schema): Value {
  if (schema.enum) return schema.enum[0];
  if (schema.type === "object")
    return Object.fromEntries(
      (schema.required ?? []).map((key) => [
        key,
        initialValue(schema.properties![key]),
      ]),
    );
  if (schema.type === "array")
    return Array.from({ length: schema.minItems ?? 0 }, () =>
      initialValue(schema.items!),
    );
  if (schema.type === "boolean") return true;
  if (schema.type === "number") return schema.min ?? 0;
  return "";
}
export function label(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (s) => s.toUpperCase());
}
export function assetUrl(url: string | null) {
  return url?.startsWith("/") ? new URL(API).origin + url : (url ?? "");
}
