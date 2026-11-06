import ConfigurationPage from "./configuration";

export const dynamic = "force-dynamic";
export default function SettingsPage() {
  return <><ConfigurationPage preview={process.env.BSMOSS_PRODUCT_PREVIEW === "on"} /></>;
}
