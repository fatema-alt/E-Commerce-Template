import { CmsWorkspace } from "@/components/cms/cms-workspace";
export default function Page() {
  return <CmsWorkspace kind="SITE_SETTINGS" defaultKey={process.env.CMS_SETTINGS_KEY || "default"} />;
}
