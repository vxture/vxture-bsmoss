import ProductFrame from "../../portal/header";
import ParameterCatalog from "../parameters/catalog";
export const dynamic = "force-dynamic";
export default function ClassificationsPage() {
  return <ProductFrame active="site-classifications"><ParameterCatalog kind="classifications" /></ProductFrame>;
}
