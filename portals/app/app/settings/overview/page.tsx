import {PanelCard, ShellPageContainer} from "@vxture/design-system";
import PageHeading from "../../portal/page-heading";
import OverviewDisplayEditor from "./editor";
import "../../site-analysis/site-analysis.css";
export const dynamic = "force-dynamic";
export default function OverviewSettingsPage() {
  const enabled = process.env.BSMOSS_PRODUCT_PREVIEW === "on";
  return <ShellPageContainer className="site-analysis-page gap-lg">
    <PageHeading icon="faders" title={"\u603b\u89c8\u8bbe\u7f6e"} description={"\u8bbe\u7f6e\u9996\u9875\u663e\u793a\u6307\u6807\u3001\u987a\u5e8f\u548c\u5355\u4f4d"} context={enabled ? <span>{"\u4ec5\u5f71\u54cd\u5f53\u524d\u6d4f\u89c8\u5668"}</span> : undefined}/>
    <PanelCard icon="faders" title={enabled ? "\u663e\u793a\u6307\u6807" : "\u603b\u89c8\u8bbe\u7f6e\u5c1a\u672a\u5f00\u653e"}>
      {enabled ? <OverviewDisplayEditor/> : <p className="text-body-small text-muted-foreground">{"\u603b\u89c8\u6570\u636e\u63a5\u5165\u540e\u5f00\u653e\u663e\u793a\u8bbe\u7f6e\u3002"}</p>}
    </PanelCard>
  </ShellPageContainer>;
}
