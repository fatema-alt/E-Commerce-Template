import { Suspense } from "react";
import CatalogEditPage from "@/components/catalog/catalog-edit-page";

type Props = { params: Promise<{ id: string }> };
async function Editor({ params }: Props) {
  const { id } = await params;
  return <CatalogEditPage entity="products" id={id} />;
}
export default function Page({ params }: Props) {
  return (
    <Suspense
      fallback={<p className="p-6 text-slate-500">Loading product editor…</p>}
    >
      <Editor params={params} />
    </Suspense>
  );
}
