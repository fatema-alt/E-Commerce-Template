import { NextResponse } from "next/server";
import { getProduct } from "../../../../../lib/storefront";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const product = await getProduct((await params).slug);
    return NextResponse.json(
      { product },
      { status: product ? 200 : 404, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { message: "Product details are temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
