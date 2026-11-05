import { Suspense } from "react";
import { redirect } from "next/navigation";
import { OrderHistory } from "../../../components/account-orders";
export const metadata = {
  title: "Order details",
  robots: { index: false, follow: false },
};
type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment?: string | string[] }>;
};
async function Content({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { payment } = await searchParams;
  if (payment === "success" || payment === "already_paid") {
    // The confirmation page still loads the scoped backend order; this query
    // only chooses the screen and never establishes payment status.
    redirect(`/order-success/${encodeURIComponent(id)}`);
  }
  return <OrderHistory id={id} />;
}
export default function Page(props: PageProps) {
  return (
    <Suspense
      fallback={
        <main id="main" className="container main-content">
          Loading order…
        </main>
      }
    >
      <Content {...props} />
    </Suspense>
  );
}
