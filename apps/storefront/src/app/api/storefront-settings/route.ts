import type { Settings } from "../../../lib/cms";
import { fallbackConfig, resolveApiBaseUrl } from "../../../lib/storefront";
export async function GET() {
  try {
    const key = process.env.CMS_SETTINGS_KEY || "default";
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(key))
      throw new Error("Invalid settings key");
    const upstream = await fetch(
      `${resolveApiBaseUrl()}/storefront/cms/SITE_SETTINGS/${key}`,
      { cache: "no-store", signal: AbortSignal.timeout(8000) },
    );
    if (!upstream.ok && upstream.status !== 404)
      throw new Error("Settings unavailable");
    const document: { content: Settings } | null =
      upstream.status === 404 ? null : await upstream.json();
    const settings = document?.content;
    return Response.json(
      {
        announcementRibbon: settings?.announcementRibbon,
        announcement: document
          ? settings?.announcement
          : { enabled: true, text: fallbackConfig.announcement || "" },
        contactWidget: settings?.contactWidget,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { message: "Store settings are temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
