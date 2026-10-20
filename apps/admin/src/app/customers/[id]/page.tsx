import { Suspense } from "react";
import CustomerDetailClient from "./customer-detail-client";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense fallback={<p>Loading customer...</p>}>
      <CustomerDetailClient id={id} />
    </Suspense>
  );
}