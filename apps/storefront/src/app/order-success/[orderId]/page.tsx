import { Suspense } from "react";
import { OrderHistory } from "../../../components/account-orders";

export const metadata = {
  title: "Order confirmation",
  robots: { index: false, follow: false },
};
async function Content({ params }: { params: Promise<{ orderId: string }> }) {
  return <OrderHistory id={(await params).orderId} success />;
}
export default function Page(props: { params: Promise<{ orderId: string }> }) {
  return (
    <Suspense
      fallback={
        <main id="main" className="container main-content" role="status">
          Loading order confirmation…
        </main>
      }
    >
      <Content {...props} />
    </Suspense>
  );
}
