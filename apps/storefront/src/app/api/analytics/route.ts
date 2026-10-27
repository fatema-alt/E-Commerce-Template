import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { isStorefrontRequest } from "../../../lib/request-origin";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(req: NextRequest) {
  if (!isStorefrontRequest(req, process.env.STOREFRONT_ORIGIN))
    return NextResponse.json({ ok: false }, { status: 403 });
  if (
    !req.headers.get("content-type")?.startsWith("application/json") ||
    Number(req.headers.get("content-length") || 0) > 1024
  )
    return NextResponse.json({ ok: false }, { status: 400 });
  const secret = process.env.STOREFRONT_CHECKOUT_SECRET;
  if (!secret || secret.length < 32)
    return NextResponse.json({ ok: false }, { status: 503 });
  try {
    const raw = await req.text();
    if (Buffer.byteLength(raw) > 1024)
      return NextResponse.json({ ok: false }, { status: 400 });
    const data = JSON.parse(raw);
    if (
      !data ||
      typeof data !== "object" ||
      !uuid.test(data.id) ||
      !["PAGE_VIEW", "PRODUCT_VIEW", "ADD_TO_CART", "CHECKOUT"].includes(
        data.kind,
      ) ||
      !["direct", "organic", "social", "referral", "email"].includes(
        data.source,
      )
    )
      return NextResponse.json({ ok: false }, { status: 400 });
    const cookie = req.cookies.get("commerce_analytics")?.value ?? "";
    const sessionId = uuid.test(cookie) ? cookie : randomUUID();
    const api = (
      process.env.STOREFRONT_API_BASE_URL || "http://localhost:4000/api/v1"
    ).replace(/\/$/, "");
    const upstream = await fetch(`${api}/shop/analytics`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        "X-Commerce-Admin": "1",
        "X-Commerce-Tracking": secret,
      },
      body: JSON.stringify({
        id: data.id,
        sessionId,
        kind: data.kind,
        source: data.source,
      }),
    });
    const response = NextResponse.json(
      { ok: upstream.ok },
      {
        status: upstream.ok ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
    response.cookies.set("commerce_analytics", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 1800,
    });
    return response;
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
