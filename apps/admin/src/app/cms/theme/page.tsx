import { CmsWorkspace } from "@/components/cms/cms-workspace";
export default function Page() {
  return <CmsWorkspace kind="THEME" defaultKey={process.env.CMS_THEME_KEY || "default"} />;
}
