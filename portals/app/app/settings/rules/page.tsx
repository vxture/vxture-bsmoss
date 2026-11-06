import ProductFrame from "../../portal/header";
import ParameterCatalog from "../parameters/catalog";
export const dynamic = "force-dynamic";
export default function RulesPage() {
  return <ProductFrame active="analysis-rules"><ParameterCatalog kind="rules" /></ProductFrame>;
}
