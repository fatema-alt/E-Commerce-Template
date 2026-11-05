import OrdersClient from "./orders-client";
export const instant = false;
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ manage?: string }>;
}) {
  const { manage } = await searchParams;
  return (
    <OrdersClient
      initialManageId={
        typeof manage === "string" && /^[a-f0-9-]{36}$/i.test(manage)
          ? manage
          : ""
      }
    />
  );
}
