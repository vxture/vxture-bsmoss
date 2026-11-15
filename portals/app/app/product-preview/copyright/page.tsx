import { demoDataEnabled } from "../../lib/demo-mode";
import PageHeading from "../../portal/page-heading";
import ProductWorkspace from "../../portal/workspace";
import { Button, PanelCard } from "@vxture/design-system";
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';


export default function CopyrightPage() {
  if (!demoDataEnabled()) notFound();
  return <ProductWorkspace className="product-workspace-standalone"><main className="product-page-inset flex flex-col gap-lg bg-background text-foreground">
    <article className="flex min-w-0 flex-col gap-lg">
      <PageHeading title={'\u5730\u56fe\u6765\u6e90\u4e0e\u7248\u6743\u58f0\u660e'} actions={<Button asChild variant="outline"><a target="_blank" rel="noopener noreferrer" href="/product-preview">{'\u6253\u5f00\u7ad9\u7f51\u5168\u666f'}</a></Button>} />
      <PanelCard title={"\u4e2d\u56fd\u672c\u5730\u5e95\u56fe"} icon="file-text"><div className="flex flex-col gap-md text-body text-muted-foreground">
      <p><a className="text-primary underline underline-offset-4" href="https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json" target="_blank" rel="noopener noreferrer">China boundaries: Aliyun DataV</a></p>
      <p>{"\u4ec5\u52a0\u8f7d\u672c\u5730\u4e2d\u56fd\u7701\u7ea7\u8fb9\u754c\u4e0e\u9655\u897f\u4e1a\u52a1\u8d44\u6e90\uff0c\u4e0d\u8bf7\u6c42\u5168\u7403\u5e95\u56fe\u6216\u536b\u661f\u5f71\u50cf\u3002"}</p>
      <p>{"\u5f53\u524d\u4e3a\u884c\u653f\u8fb9\u754c\u5e95\u56fe\uff0c\u672a\u63a5\u5165\u9053\u8def\u3001POI \u4e0e\u536b\u661f\u5f71\u50cf\u3002\u8d44\u6e90\u4e0d\u4f5c\u4e3a\u6d4b\u7ed8\u6216\u5bfc\u822a\u4f9d\u636e\u3002"}</p>
      </div></PanelCard>
      <PanelCard title={'\u4e1a\u52a1\u6570\u636e\u6765\u6e90'} icon="file-text"><div className="flex flex-col gap-md text-body text-muted-foreground">
      <p>{'\u7ad9\u5740\u70b9\u4f4d\u3001\u901a\u8bdd\u3001\u6d41\u91cf\u3001\u77ed\u4fe1\u3001\u8fd0\u8425\u6307\u6807\u4e0e\u8bbe\u5907\u72b6\u6001\u4e3a\u5408\u6210\u6570\u636e\uff0c\u4e0d\u4ee3\u8868\u771f\u5b9e\u8fd0\u8425\u5546\u6216\u7ad9\u5740\u7684\u751f\u4ea7\u6570\u636e\u3002'}</p>
      </div></PanelCard>
    </article>
  </main></ProductWorkspace>;
}
