import {towerBrand} from "./tower-navigation";
import type { HomeSummary, HomeGrowthSummary } from "./home-read-model";
import Link from "next/link";
import { Button, Card, CardContent, Icon, ShellPageContainer } from "@vxture/design-system";
import TowerMotif from "./tower-motif";
import ProductBrandMark from "./brand";
import "./landing-home.css";
const fmt = (value: number) => value.toLocaleString("zh-CN", {maximumFractionDigits: 1});
const missing = "\u2014";
export default function LandingHome({demo, growth}: {demo: HomeSummary | null; growth: HomeGrowthSummary | null}) {
 const shared = demo && demo.occupiedSites > 0
  ? fmt(demo.usage.sharedSites * 100 / demo.occupiedSites) + "% \u00b7 " + fmt(demo.usage.sharedSites) + " \u7ad9"
  : "\u2014";
 const energy = demo?.report.energyWh;
 const month = demo?.report.window.start.slice(0, 7);
 const score = demo?.usage.physicalSites ? demo.healthTotal / demo.usage.physicalSites : null;
 const priorDaily = demo ? demo.report.previousEnergyWh / demo.report.previousDays : 0;
 const energyDelta = demo && priorDaily ? (demo.report.energyWh / demo.report.days / priorDaily - 1) * 100 : null;
 const signed = (value:number) => (value > 0 ? "+" : "") + fmt(value);
 const delta = growth ? (growth.net > 0 ? "+" : "") + fmt(growth.net) : missing;
 const facts = [
  {label:"\u7ad9\u5740\u5229\u7528", value:demo ? fmt(demo.usage.physicalSites) : missing, unit:"\u7ad9", detail:"\u5171\u4eab\u7387 " + shared},
  {label:"\u670d\u52a1\u589e\u957f", value:delta, unit:"\u7ad9", detail:"\u8f83\u4e0a\u6708\u672b\u51c0\u589e\u51cf"},
  {label:"\u670d\u52a1\u5065\u5eb7", value:score===null?missing:fmt(score), unit:"\u5206", detail:score===null?"\u6682\u4e0d\u53ef\u8bc4\u5206":"\u6f14\u793a\u7ad9\u5740\u5065\u5eb7\u5e73\u5747\u5206"},
  {label:"\u8fd0\u884c\u80fd\u8017", value:energy == null ? missing : fmt(energy / 1_000_000), unit:"MWh", detail:month ? month + " \u7d2f\u8ba1\u7528\u7535" : "\u672c\u6708\u7d2f\u8ba1\u7528\u7535"},
 ];
 const watch = [
  {title:"\u670d\u52a1\u89c4\u6a21\u53d8\u5316",icon:"chart-line-up" as const,headline:growth ? delta + " \u7ad9" : "\u8f83\u4e0a\u6708\u672b\u51c0\u589e\u51cf",copy:growth ? "\u6708\u672b\u5feb\u7167\u8986\u76d6 " + fmt(growth.current) + " \u7ad9 \u00b7 \u5feb\u7167\u65b0\u589e " + fmt(growth.entered) + " \u7ad9 \u00b7 \u5feb\u7167\u51cf\u5c11 " + fmt(growth.exited) + " \u7ad9" : "\u7f3a\u5c11\u53ef\u6bd4\u7684\u6708\u672b\u8986\u76d6\u5feb\u7167\uff0c\u6682\u4e0d\u80fd\u5224\u65ad\u670d\u52a1\u89c4\u6a21\u53d8\u5316\u3002",href:"/tower-service/services",action:"\u67e5\u770b\u670d\u52a1\u8986\u76d6"},
  {title:"\u670d\u52a1\u8d28\u91cf\u98ce\u9669",icon:"shield-check" as const,headline:demo?fmt(demo.attentionSites)+" \u7ad9\u9700\u5173\u6ce8":"\u6682\u4e0d\u53ef\u8bc4\u5206",copy:demo?"18:00 \u5feb\u7167\u4e2d\u5904\u4e8e\u544a\u8b66\u6216\u4e25\u91cd\u72b6\u6001\u7684\u7ad9\u5740\u3002":"\u8bc4\u5206\u89c4\u5219\u4e0e\u5c65\u7ea6\u4f9d\u636e\u9f50\u5907\u540e\uff0c\u5c55\u793a\u7efc\u5408\u5206\u548c\u9996\u8981\u6263\u5206\u539f\u56e0\u3002",href:"/tower-service/judgment",action:"\u67e5\u770b\u7814\u5224"},
  {title:"\u7528\u7535\u89c4\u6a21",icon:"gauge" as const,headline:energyDelta!==null?signed(energyDelta)+"%":energy == null ? "\u7528\u7535\u6570\u636e\u5f85\u63a5\u5165" : "\u540c\u53e3\u5f84\u8d8b\u52bf\u5f85\u6838\u5b9e",copy:energyDelta!==null?"\u6708\u65e5\u5747\u7528\u7535\u91cf\u8f83\u4e0a\u6708\u53d8\u5316\uff0c\u8ba1\u5165\u76f8\u540c\u5730\u57df\u7684\u7269\u7406\u7ad9\u5740\u3002":energy == null ? "\u6709\u5b8c\u6574\u8ba1\u91cf\u6570\u636e\u540e\uff0c\u518d\u5224\u65ad\u672c\u6708\u7528\u7535\u89c4\u6a21\u548c\u53d8\u5316\u3002" : "\u5df2\u5c55\u793a\u6708\u5ea6\u6f14\u793a\u7528\u7535\u91cf\uff1b\u5f85\u6709\u540c\u7b49\u5929\u6570\u548c\u8303\u56f4\u7684\u8ba1\u91cf\u6570\u636e\uff0c\u518d\u5224\u65ad\u7528\u7535\u662f\u5426\u4e0a\u5347\u3002",href:"/efficiency",action:"\u67e5\u770b\u8fd0\u884c\u80fd\u6548"},
 ];
 return <ShellPageContainer className="bsmoss-home">
  <section className="home-intro" aria-labelledby="home-title">
   <div className="home-intro-copy">
    <div className="home-kicker"><ProductBrandMark/><span>{towerBrand.name}</span></div>
    <h1 id="home-title">{"\u4ece\u7ad9\u7f51\u5f00\u59cb"}</h1>
    <p className="home-description">{"\u638c\u63e1\u7ad9\u5740\u8d44\u6e90\u4e0e\u670d\u52a1\u60c5\u51b5\uff0c\u53d1\u73b0\u8fd0\u884c\u53d8\u5316\uff0c\u4e3a\u65e5\u5e38\u7ecf\u8425\u63d0\u4f9b\u7814\u5224\u4f9d\u636e\u3002"}</p>
    <div className="home-actions"><Button asChild size="xl"><Link href="/tower-service/overview">{"\u8fdb\u5165\u7ecf\u8425\u603b\u89c8"}<Icon name="arrow-right" size="sm"/></Link></Button>{demo && <Button asChild size="xl" variant="outline"><Link href="/product-preview?hour=18" target="_blank" rel="noopener noreferrer">{"\u67e5\u770b\u7ad9\u7f51\u5168\u666f"}</Link></Button>}</div>
    <p className="home-resume">{demo ? "\u6f14\u793a\u6570\u636e \u00b7 " + demo.date + " \u00b7 " + demo.hour + ":00 \u5feb\u7167" : "\u6b63\u5f0f\u4e1a\u52a1\u6570\u636e\u5c1a\u672a\u63a5\u5165"}</p>
   </div><TowerMotif/>
  </section>
  <section className="home-summary" aria-labelledby="home-summary-title">
   <div><h2 id="home-summary-title" className="home-section-title">{"\u7ad9\u7f51\u6982\u51b5"}</h2><p className="mt-xs text-body-small text-muted-foreground">{demo ? "\u5f53\u524d\u6240\u9009\u533a\u57df \u00b7 \u6f14\u793a\u5feb\u7167" : "\u7b49\u5f85\u6388\u6743\u6570\u636e\u63a5\u5165"}</p></div>
   <dl className="home-facts">{facts.map(fact => <div key={fact.label}><dt className="text-body-small text-muted-foreground">{fact.label}</dt><dd>{fact.value}{fact.value !== missing && <span className="home-fact-unit">{fact.unit}</span>}</dd><dd className="home-fact-detail">{fact.detail}</dd></div>)}</dl>
  </section>
  <section className="home-section" aria-labelledby="home-watch-title"><h2 id="home-watch-title" className="home-section-title">{"\u7ba1\u7406\u5173\u6ce8"}</h2>
   <div className="home-watch-grid grid gap-md md:grid-cols-3">{watch.map(item => <Card key={item.title}><CardContent className="home-watch-card flex h-full flex-col gap-md p-lg">
    <h3 className="flex items-center gap-sm text-label"><Icon name={item.icon} size="md" className="text-primary"/>{item.title}</h3>
    <div className="flex-1"><p className="home-watch-value tabular-nums">{item.headline}</p><p className="mt-sm text-body-small text-muted-foreground">{item.copy}</p></div>
    <div className="flex justify-end border-t border-border pt-sm"><Button asChild variant="secondary" size="xl"><Link href={item.href}>{item.action}<Icon name="arrow-right" size="sm"/></Link></Button></div>
   </CardContent></Card>)}</div>
  </section>
 </ShellPageContainer>;
}
