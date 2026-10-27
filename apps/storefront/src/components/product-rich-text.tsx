import { toProductHtml } from "@commerce/product-content";

/** The only HTML sink for product copy; shared allowlist sanitation runs here on the server. */
export function ProductRichTextRenderer({ content }: { content: string }) {
  return (
    <div
      className="product-description"
      dangerouslySetInnerHTML={{ __html: toProductHtml(content) }}
    />
  );
}
