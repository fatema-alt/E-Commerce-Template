import { Suspense } from "react";
import { OrderHistory } from "../../../components/account-orders";
export const metadata = {
  title: "Order details",
  robots: { index: false, follow: false },
};
async function Content({ params }: { params: Promise<{ id: string }> }) {
  return <OrderHistory id={(await params).id} />;
}
export default function Page(props: { params: Promise<{ id: string }> }) {
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
