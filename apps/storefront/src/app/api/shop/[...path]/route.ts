import { NextRequest, NextResponse } from "next/server";
const api = (
  process.env.STOREFRONT_API_BASE_URL || "http://localhost:4000/api/v1"
).replace(/\/$/, "");
async function proxy(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const path = (await context.params).path.join("/");
  const allowed =
    req.method === "GET"
      ? /^(me|newsletter|payment-methods|orders(?:\/[a-f0-9-]{36})?|payments\/methods|payments\/status\/[a-f0-9-]{36})$/
      : /^(register|login|logout|password|quote|orders|payments\/initiate|newsletter(?:\/preferences)?)$/;
  if (!allowed.test(path))
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  let body: string | undefined;
  if (req.method === "POST") {
    const origin = req.headers.get("origin");
    const expected = process.env.STOREFRONT_ORIGIN || req.nextUrl.origin;
    if (
      req.headers.get("x-storefront-request") !== "1" ||
      req.headers.get("sec-fetch-site") === "cross-site" ||
      (origin && origin !== expected)
    )
      return NextResponse.json(
        { message: "Request origin rejected" },
        { status: 403 },
      );
    if (!req.headers.get("content-type")?.startsWith("application/json"))
      return NextResponse.json(
        { message: "JSON body required" },
        { status: 415 },
      );
    if (Number(req.headers.get("content-length") || 0) > 65536)
      return NextResponse.json(
        { message: "Request too large" },
        { status: 413 },
      );
    body = await req.text();
    if (Buffer.byteLength(body) > 65536)
      return NextResponse.json(
        { message: "Request too large" },
        { status: 413 },
      );
  }
  const cookie = req.cookies.get("commerce_shopper")?.value;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Commerce-Admin": "1",
  };
  if (cookie && /^[a-f0-9]{64}$/.test(cookie))
    headers.Cookie = `commerce_shopper=${cookie}`;
  const key = req.headers.get("idempotency-key");
  if (key) headers["Idempotency-Key"] = key;
  const page =
    path === "orders" && req.method === "GET"
      ? `?page=${encodeURIComponent(req.nextUrl.searchParams.get("page") || "1")}`
      : "";
  try {
    const targetUrl = path.startsWith("payments/")
      ? `${api}/${path}${page}`
      : `${api}/shop/${path}${page}`;
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
      redirect: "error",
    });
    const response = new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
    for (const value of upstream.headers.getSetCookie())
      response.headers.append("Set-Cookie", value);
    return response;
  } catch {
    return NextResponse.json(
      { message: "The store is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
}
export const GET = proxy;
export const POST = proxy;
