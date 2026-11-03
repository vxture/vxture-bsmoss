import { ChevronDown } from "lucide-react";
import { portalNavigation, type PortalPage } from "./navigation";
import "./header.css";

export default function ProductHeader({ active, preview = process.env.BSMOSS_PRODUCT_PREVIEW === "on" }: { active: PortalPage; preview?: boolean }) {
  const nav = portalNavigation(preview), management = nav.filter(item => item.group === "management");
  return <header className="product-header">
    <a className="product-brand" href="/" aria-label={"\u89c2\u6f9c\u95e8\u6237\u9996\u9875"}>
      <strong>{"\u89c2\u6f9c"}</strong><span><b>BS-MOSS</b><small>{"\u57fa\u7ad9\u591a\u57df\u8fd0\u884c\u76d1\u7ba1\u5e73\u53f0"}</small></span>
    </a>
    <nav aria-label={"\u4ea7\u54c1\u5bfc\u822a"}>
      {nav.filter(item => item.group === "business").map(item => <a key={item.id} href={item.href} aria-current={active === item.id ? "page" : undefined}>{item.label}</a>)}
      <details className="product-menu">
        <summary data-active={management.some(item => item.id === active)}>{"\u7ba1\u7406\u5de5\u4f5c\u533a"}<ChevronDown size={13} /></summary>
        <div>{management.map(item => <a key={item.id} href={item.href} aria-current={active === item.id ? "page" : undefined}>{item.label}</a>)}</div>
      </details>
    </nav>
  </header>;
}
