import ProductFrame from "../portal/header";
import ConfigurationPage from "./configuration";

export const dynamic = "force-dynamic";
export default function SettingsPage() {
  return <ProductFrame active="settings"><ConfigurationPage preview={process.env.BSMOSS_PRODUCT_PREVIEW === "on"} /></ProductFrame>;
}
