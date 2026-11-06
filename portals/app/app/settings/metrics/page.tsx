import ProductFrame from "../../portal/header";
import MetricCatalog from "./catalog";
export const dynamic = "force-dynamic";
export default function MetricsPage() {
  return <ProductFrame active="metric-catalog"><MetricCatalog /></ProductFrame>;
}
