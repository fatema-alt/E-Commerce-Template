import { published, type Settings } from "../../../lib/cms";
import { fallbackConfig } from "../../../lib/storefront";
export async function GET() {
  try {
    const document = await published<Settings>(
      "SITE_SETTINGS",
      process.env.CMS_SETTINGS_KEY || "default",
    );
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
