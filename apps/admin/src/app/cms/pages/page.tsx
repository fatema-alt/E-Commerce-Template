import { CmsWorkspace } from "@/components/cms/cms-workspace";
export default function Page() {
  return <CmsWorkspace settingsDocumentKey={process.env.CMS_SETTINGS_KEY || "default"} fallbackHomeKey={process.env.CMS_HOME_KEY || "home"} kind="PAGE" area="pages" />;
}
