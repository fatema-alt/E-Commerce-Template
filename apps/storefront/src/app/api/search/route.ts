import { product } from "../../../lib/storefront";
export async function GET(request: Request) {
  const query =
    new URL(request.url).searchParams.get("q")?.trim().slice(0, 200) || "";
  if (query.length < 2)
    return Response.json(
      { items: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  try {
    const base = (
      process.env.STOREFRONT_API_BASE_URL || "http://localhost:4000/api/v1"
    ).replace(/\/$/, "");
    const response = await fetch(
      `${base}/storefront/products?${new URLSearchParams({ search: query, page: "1", pageSize: "6" })}`,
      { cache: "no-store", signal: AbortSignal.timeout(6000) },
    );
    if (!response.ok) throw new Error("Catalog unavailable");
    const data = await response.json();
    if (!Array.isArray(data.items)) throw new Error("Invalid catalog response");
    const items = data.items
      .map(product)
      .filter(Boolean)
      .slice(0, 6)
      .map((item: NonNullable<ReturnType<typeof product>>) => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        imageUrl: item.imageUrl,
        price: item.price,
      }));
    return Response.json(
      { items },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        message:
          "Suggestions are temporarily unavailable. You can still search all products.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
