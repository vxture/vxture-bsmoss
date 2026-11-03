import { Activity, ArrowUpRight, BarChart3, FileText, Map, RadioTower, Zap } from "lucide-react";
import type { PortalDemo } from "./demo";

const names: Record<string, string> = { mobile: "\u79fb\u52a8", telecom: "\u7535\u4fe1", unicom: "\u8054\u901a", broadcast: "\u5e7f\u7535", other: "\u5176\u4ed6" };
const number = (v: number, digits = 0) => v.toLocaleString("zh-CN", { maximumFractionDigits: digits });
const percent = (v: number | null) => v === null ? "\u2014" : number(v * 100, 1) + "%";

export default function PortalHome({ demo, loginEnabled }: { demo: PortalDemo | null; loginEnabled: boolean }) {
  if (!demo) return <div className="portal-content">
    <div className="portal-heading"><div><p>BS-MOSS / OVERVIEW</p><h1>{"\u8fd0\u884c\u603b\u89c8"}</h1></div><span>{"\u9655\u897f\u7701"}</span></div>
    <section className="portal-access"><RadioTower size={32} /><h2>{"\u4ece\u5168\u7701\u6001\u52bf\uff0c\u5230\u7ad9\u5740\u5206\u6790"}</h2>
      <p>{"\u767b\u5f55\u540e\u8fdb\u5165\u6388\u6743\u8303\u56f4\u5185\u7684\u5468\u671f\u5206\u6790\u3001\u62a5\u544a\u4e0e\u7ba1\u7406\u5de5\u4f5c\u533a\u3002"}</p>
      {loginEnabled ? <a className="portal-primary" href="/auth/login?returnTo=%2Fanalysis">{"\u4f7f\u7528\u5e73\u53f0\u8d26\u53f7\u767b\u5f55"}<ArrowUpRight size={15} /></a> : <p>{"\u6b63\u5f0f\u6570\u636e\u5c1a\u672a\u5f00\u653e\uff0c\u7b49\u5f85\u5b8c\u6210\u5e73\u53f0\u63a5\u5165\u4e0e\u6765\u6e90\u6388\u6743\u3002"}</p>}
      <div className="portal-formal-links"><a href="/analysis">{"\u5468\u671f\u5206\u6790"}</a><a href="/reports">{"\u62a5\u544a\u4e2d\u5fc3"}</a></div>
    </section>
  </div>;
  const { usage, status } = demo;
  return <div className="portal-content" data-portal-mode="demo" data-demo-version={demo.version}>
    <div className="portal-heading"><div><p>BS-MOSS / OVERVIEW</p><h1>{"\u8fd0\u884c\u603b\u89c8"}</h1></div>
      <div className="portal-context"><span>{"\u9655\u897f\u7701 \u00b7 " + demo.date}</span><b>{"\u6f14\u793a\u6570\u636e"}</b><a href="/product-preview?hour=18">{"\u8fdb\u5165\u7ad9\u7f51\u5730\u56fe"}<ArrowUpRight size={15} /></a></div>
    </div>
    <section className="portal-summary" aria-label={"\u7ad9\u7f51\u6982\u51b5"}>
      <div><RadioTower size={19} /><span>{"\u6f14\u793a\u7ad9\u5740"}</span><strong>{number(usage.physicalSites)}<small>{"\u5ea7"}</small></strong></div>
      <div><span>{"\u8fd0\u8425\u5546\u670d\u52a1\u5173\u7cfb"}</span><strong>{number(usage.serviceRelations)}<small>{"\u6761"}</small></strong></div>
      <div><span>{"\u5171\u4eab\u7ad9\u5740"}</span><strong>{number(usage.sharedSites)}<small>{"\u5ea7"}</small></strong></div>
      <div><span>{"18:00 \u9700\u5173\u6ce8\u7ad9\u5740"}</span><strong className="portal-amber">{number(status.warning + status.critical)}<small>{"\u5ea7"}</small></strong></div>
      <a className="portal-status-link" href="/product-preview?hour=18"><span>{"\u6b63\u5e38 " + number(status.normal)}</span><span>{"\u5173\u6ce8 " + number(status.warning)}</span><span>{"\u91cd\u70b9 " + number(status.critical)}</span><ArrowUpRight size={16} /></a>
    </section>
    <section className="portal-domains" aria-label={"\u4e09\u7c7b\u4e1a\u52a1\u6307\u6807"}>
      <article><div className="portal-card-title"><BarChart3 size={17} /><h2>{"\u7ecf\u8425\u670d\u52a1"}</h2><span>{"\u5168\u65e5\u7d2f\u8ba1"}</span></div>
        <div className="portal-main-value">{number(usage.totals.bytes / 1073741824, 1)}<small>GiB</small></div><p>{"\u4e1a\u52a1\u6d41\u91cf"}</p>
        <div className="portal-pairs"><span>{"\u901a\u8bdd "}<b>{number(usage.totals.voiceSeconds / 60, 1)}<small>{" \u5206\u949f"}</small></b></span><span>{"\u77ed\u4fe1 "}<b>{number(usage.totals.sms)}<small>{" \u6761"}</small></b></span></div>
        <a href="/product-preview?usage=day&hour=18">{"\u67e5\u770b\u8fd0\u8425\u5546\u7528\u91cf"}<ArrowUpRight size={14} /></a>
      </article>
      <article><div className="portal-card-title"><Activity size={17} /><h2>{"\u8fd0\u8425\u72b6\u6001"}</h2><span>18:00</span></div>
        <div className="portal-main-value">{percent(status.connectionRate)}</div><p>{"\u63a5\u901a\u7387 \u00b7 \u6309\u6b21\u6570\u6c47\u603b"}</p>
        <div className="portal-pairs"><span>{"\u8d44\u6e90\u8d1f\u8f7d "}<b>{percent(status.load)}</b></span><span>{"\u91cd\u70b9\u7ad9\u5740 "}<b>{number(status.critical)}<small>{" \u5ea7"}</small></b></span></div>
        <a href="/product-preview?topic=capacity&hour=18">{"\u67e5\u770b\u5bb9\u91cf\u4e0e\u8d28\u91cf"}<ArrowUpRight size={14} /></a>
      </article>
      <article><div className="portal-card-title"><Zap size={17} /><h2>{"\u8fd0\u884c\u53c2\u6570"}</h2><span>{"\u5168\u65e5\u7d2f\u8ba1"}</span></div>
        <div className="portal-main-value">{usage.energyWh === null ? "\u2014" : number(usage.energyWh / 1000, 1)}<small>kWh</small></div><p>{"\u7269\u7406\u7ad9\u5740\u7535\u8017"}</p>
        <div className="portal-pairs"><span>{"\u4f9b\u7535\u4e0e\u8bbe\u5907"}<b>{"\u72b6\u6001\u89c2\u5bdf"}</b></span><span>{"\u80fd\u6548"}<b>{"\u4e13\u9898\u5206\u6790"}</b></span></div>
        <a href="/product-preview?topic=efficiency&hour=18">{"\u67e5\u770b\u8fd0\u884c\u4e0e\u80fd\u6548"}<ArrowUpRight size={14} /></a>
      </article>
    </section>
    <div className="portal-grid">
      <section className="portal-panel"><div className="portal-panel-heading"><h2>{"\u5730\u5e02\u4e1a\u52a1\u5206\u5e03"}</h2><span>{"18:00 \u00b7 \u6d41\u91cf\u6392\u540d"}</span></div>
        <div className="portal-city-list">{demo.cities.map((city, index) => <a href={"/product-preview?city=" + city.id + "&hour=18"} key={city.id}>
          <i>{String(index + 1).padStart(2, "0")}</i><strong>{city.name}</strong><div className="portal-bar"><span style={{ width: (demo.cities[0].bytes ? city.bytes / demo.cities[0].bytes * 100 : 0) + "%" }} /></div><b>{number(city.bytes / 1073741824, 1)}<small> GiB</small></b><span>{number(city.count) + " \u7ad9"}</span><ArrowUpRight size={13} />
        </a>)}</div>
      </section>
      <section className="portal-panel"><div className="portal-panel-heading"><h2>{"\u8fd0\u8425\u5546\u7528\u91cf\u7ed3\u6784"}</h2><span>{"\u5168\u65e5 \u00b7 \u6309\u6d41\u91cf\u5360\u6bd4"}</span></div>
        <div className="portal-operator-list">{usage.rows.map(row => <a href={"/product-preview?usage=day&operator=" + row.code + "&hour=18"} key={row.code}>
          <div><strong>{names[row.code]}</strong><span>{percent(usage.totals.bytes ? row.bytes / usage.totals.bytes : null)}</span></div><div className="portal-bar"><span style={{ width: (usage.totals.bytes ? row.bytes / usage.totals.bytes * 100 : 0) + "%" }} /></div>
          <p>{number(row.bytes / 1073741824, 1) + " GiB"}<span>{number(row.sites) + " \u6761\u670d\u52a1\u5173\u7cfb"}</span></p>
        </a>)}</div>
      </section>
    </div>
    <div className="portal-grid portal-bottom-grid">
      <section className="portal-panel"><div className="portal-panel-heading"><h2>{"\u91cd\u70b9\u7ad9\u5740\u89c2\u5bdf"}</h2><span>{"18:00 \u00b7 \u6a21\u62df\u72b6\u6001"}</span></div>
        <div className="portal-table-wrap"><table><thead><tr>{["\u7ad9\u5740", "\u5730\u5e02", "\u72b6\u6001", "\u8d1f\u8f7d\u7387", "\u6d41\u91cf"].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>
          {demo.priorities.map(site => <tr key={site.id}><td><a href={"/product-preview?hour=18&site=" + site.id}>{site.name}<ArrowUpRight size={12} /></a></td><td>{site.city}</td><td><span className={"portal-state " + site.status}>{site.status === "critical" ? "\u91cd\u70b9" : site.status === "warning" ? "\u5173\u6ce8" : "\u6b63\u5e38"}</span></td><td>{percent(site.load)}</td><td>{number(site.trafficGiB, 1) + " GiB"}</td></tr>)}
        </tbody></table></div>
      </section>
      <section className="portal-panel portal-workspaces"><div className="portal-panel-heading"><h2>{"\u4e1a\u52a1\u5de5\u4f5c\u533a"}</h2></div>
        <a href="/product-preview?hour=18"><Map size={18} /><div><strong>{"\u7ad9\u7f51\u5730\u56fe"}</strong><p>{"\u7a7a\u95f4\u5b9a\u4f4d\u3001\u9009\u533a\u3001\u5bf9\u6bd4\u4e0e\u5355\u7ad9\u5206\u6790"}</p></div><ArrowUpRight size={15} /></a>
        <a href="/product-preview?report=day&hour=18"><FileText size={18} /><div><strong>{"\u5468\u671f\u62a5\u544a\u6f14\u793a"}</strong><p>{"\u65e5\u5468\u6708\u5206\u6790\u4e0e\u8bc1\u636e\u5bfc\u51fa"}</p></div><ArrowUpRight size={15} /></a>
        <a href="/analysis"><BarChart3 size={18} /><div><strong>{"\u6b63\u5f0f\u5468\u671f\u5206\u6790"}</strong><p>{"\u5e73\u53f0\u6388\u6743\u8303\u56f4\u5185\u7684\u6307\u6807\u4e0e\u8bc1\u636e"}</p></div><ArrowUpRight size={15} /></a>
        <a href="/reports"><FileText size={18} /><div><strong>{"\u6b63\u5f0f\u62a5\u544a\u4e2d\u5fc3"}</strong><p>{"\u62a5\u544a\u7248\u672c\u3001\u53d1\u5e03\u4e0e\u5bfc\u51fa\u8bb0\u5f55"}</p></div><ArrowUpRight size={15} /></a>
      </section>
    </div>
    <footer className="portal-footer"><span>{"\u56fa\u5b9a\u6f14\u793a\u65e5\u671f \u00b7 1,080 \u4e2a\u6a21\u62df\u7ad9\u5740\uff1b\u4e0d\u4ee3\u8868\u771f\u5b9e\u63a5\u5165\u4e0e\u6570\u636e\u5b8c\u6574\u7387\u3002"}</span><span>{"\u7269\u7406\u7535\u8017\u4e0d\u6309\u8fd0\u8425\u5546\u5206\u644a"}</span></footer>
  </div>;
}