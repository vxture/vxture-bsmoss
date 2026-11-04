import ProductFrame from "../../portal/header";
import { PanelCard, ShellPageContainer } from "@vxture/design-system";
import OverviewDisplaySettings from "./settings";
export const dynamic = "force-dynamic";
export default function OverviewSettingsPage() {
  const enabled = process.env.BSMOSS_PRODUCT_PREVIEW === "on";
  return <ProductFrame active="overview-display">{enabled ? <OverviewDisplaySettings /> :
    <ShellPageContainer className="product-page-inset"><PanelCard title={"\u8fd0\u884c\u603b\u89c8\u663e\u793a\u8bbe\u7f6e\u5c1a\u672a\u5f00\u653e"}><p className="text-body-small text-muted-foreground">{"\u5b8c\u6210\u8fd0\u884c\u603b\u89c8\u6570\u636e\u63a5\u5165\u540e\u5f00\u653e\u3002"}</p></PanelCard></ShellPageContainer>}
  </ProductFrame>;
}
