import {Button,PanelCard,ShellPageContainer} from "@vxture/design-system";
import ProductFrame from "../portal/header";
import PageHeading from "../portal/page-heading";
import {rememberedRegionInput} from "../portal/region-preference";
import {historyModel} from "./history-model";
import {historyHref,historyReportHref} from "./history-links";
import HistoryContextPanel from "./history-context-panel";
import {operatorNames} from "../sites/labels";
import {DAY_MS,dateNumber,isoDay} from "../domains/map-demo/history-calendar";
export default async function HistoryContextPage({kind,input}:{kind:'capacity'|'efficiency';input:Record<string,string|string[]|undefined>}){
 const title=kind==='capacity'?'\u5bb9\u91cf\u4e0e\u8d28\u91cf':'\u8fd0\u884c\u4e0e\u80fd\u6548';let data;
 try {data=historyModel(await rememberedRegionInput(input));}catch(error){if(!(error instanceof Error&&/^(invalid_|history_site_not_in_scope|conflicting_|missing_|outside_history)/.test(error.message)))throw error;
  return <ProductFrame active={kind} preview><ShellPageContainer className="product-page-inset max-w-none"><PageHeading title={title}/><div role="alert"><PanelCard title={"\u5206\u6790\u6761\u4ef6\u65e0\u6548"} icon="search"><Button asChild><a href="/analysis">{"\u8fd4\u56de\u7ecf\u8425\u5206\u6790"}</a></Button></PanelCard></div></ShellPageContainer></ProductFrame>;
 }
 const q=data.scope;
 return <ProductFrame active={kind} preview><ShellPageContainer className="product-page-inset max-w-none gap-lg"><PageHeading title={title} description={"\u5386\u53f2\u5468\u671f\u5173\u8054\u8c03\u67e5 \u00b7 \u4e0e\u7ecf\u8425\u5206\u6790\u4f7f\u7528\u540c\u4e00\u8303\u56f4"}
  navigation={<Button asChild variant="link"><a href={historyHref(q)}>{"\u8fd4\u56de\u7ecf\u8425\u5206\u6790"}</a></Button>}
  context={<span>{'\u6570\u636e\u622a\u81f3 '+isoDay(dateNumber(data.coverage.end)-DAY_MS)}</span>}
  actions={<><Button asChild variant="outline"><a href={historyReportHref(q)}>{"\u5386\u53f2\u62a5\u544a"}</a></Button><Button asChild variant="ghost"><a href={'/'+kind+'?city='+q.query.cityId+'&county='+q.query.countyId+'&operator='+q.query.operator}>{"\u5feb\u7167\u5206\u6790"}</a></Button></>}
  toolbar={<p className="py-md text-body-small text-muted-foreground">{q.window.start+' \u2014 '+isoDay(dateNumber(q.window.end)-DAY_MS)+' \u00b7 '+operatorNames[q.query.operator]+(data.siteName?' \u00b7 '+data.siteName:'')+' \u00b7 '+data.physicalSites+'\u5ea7\u7ad9\u5740'}</p>}/>
  <HistoryContextPanel data={data} details focus={kind}/>
  <PanelCard title={"\u7edf\u8ba1\u4f9d\u636e"} icon="database"><p className="text-body-small text-muted-foreground">{data.cross.version+' / '+data.version+' \u00b7 '+data.cross.summary.physical.physicalSamples+'\u4e2a\u7269\u7406\u7ad9\u65f6\u6837\u672c / '+data.cross.summary.samples+'\u4e2a\u670d\u52a1\u5173\u7cfb\u7ad9\u65f6\u6837\u672c\u3002\u56fa\u5b9a\u8d44\u6e90\u96c6\u5408\uff1b\u672a\u63a8\u65ad\u5386\u53f2\u6295\u9000\u8fd0\u3001\u544a\u8b66\u6216\u4eba\u5de5\u539f\u56e0\u3002'}</p></PanelCard>
 </ShellPageContainer></ProductFrame>;
}
