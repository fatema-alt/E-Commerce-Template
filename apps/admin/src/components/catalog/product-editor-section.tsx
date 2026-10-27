import type { ReactNode } from "react";

export function ProductEditorSection({
  title,
  description,
  children,
  collapsed = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  collapsed?: boolean;
}) {
  const content = (
    <>
      {description && <p className="product-editor-help">{description}</p>}
      <div className="product-editor-fields">{children}</div>
    </>
  );
  return collapsed ? (
    <details className="product-editor-card">
      <summary>{title}</summary>
      {content}
    </details>
  ) : (
    <section className="product-editor-card">
      <h2>{title}</h2>
      {content}
    </section>
  );
}
