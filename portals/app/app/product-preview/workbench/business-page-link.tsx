"use client";
import { ArrowUpRight } from "lucide-react";
import { useWorkbench } from "../../domains/map-demo/workbench-store";
import {useInvestigationLinks} from '../../portal/investigation';
import {mapInvestigationHref} from '../../portal/investigation-links';
import { businessHref, type BusinessKind } from "../../business-analysis/links";
export default function BusinessPageLink({ kind }: { kind: BusinessKind }) {
  const state = useWorkbench();
  const {carry}=useInvestigationLinks(mapInvestigationHref(state));
  return <a className="mw-report-download" aria-label={"\u6253\u5f00\u72ec\u7acb\u5206\u6790"} href={carry(businessHref(kind, {
    cityId: state.cityId, countyId: state.countyId, operator: state.operator, hour: state.hour, selection: state.selection ?? undefined,
    search: state.search, topic: state.topic,
    period: kind === "usage-reports" ? state.reportPeriod : kind === "operator-usage" ? state.usagePeriod : "day",
  }))}><ArrowUpRight size={13} />{"\u72ec\u7acb\u5206\u6790"}</a>;
}
