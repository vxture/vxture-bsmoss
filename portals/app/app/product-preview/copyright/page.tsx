import PageHeading from "../../portal/page-heading";
import ProductWorkspace from "../../portal/workspace";
import { Button, PanelCard } from "@vxture/design-system";
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'BS-MOSS | Map sources and copyright' };

export default function CopyrightPage() {
  if (process.env.BSMOSS_PRODUCT_PREVIEW !== 'on') notFound();
  return <ProductWorkspace className="product-workspace-standalone"><main className="product-page-inset flex flex-col gap-lg bg-background text-foreground">
    <article className="flex min-w-0 flex-col gap-lg">
      <PageHeading title={'\u5730\u56fe\u6765\u6e90\u4e0e\u7248\u6743\u58f0\u660e'} actions={<Button asChild variant="outline"><a target="_blank" rel="noopener noreferrer" href="/product-preview">{'\u6253\u5f00\u7ad9\u7f51\u5168\u666f'}</a></Button>} />
      <PanelCard title={'\u6807\u51c6\u5e95\u56fe'} icon="file-text"><div className="flex flex-col gap-md text-body text-muted-foreground">
      <p><a className="text-primary underline underline-offset-4" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">{'\u00a9 OpenStreetMap contributors'}</a></p>
      <p>{'\u5730\u56fe\u6570\u636e\u6765\u81ea OpenStreetMap \u8d21\u732e\u8005\uff0c\u6309 Open Database License (ODbL) \u63d0\u4f9b\u3002\u6807\u51c6\u74e6\u7247\u4f7f\u7528 OpenStreetMap \u516c\u5171\u670d\u52a1\u3002'}</p>
      <p><a className="text-primary underline underline-offset-4" href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener noreferrer">ODbL 1.0</a>{' \u00b7 '}<a className="text-primary underline underline-offset-4" href="https://operations.osmfoundation.org/policies/tiles/" target="_blank" rel="noopener noreferrer">{'\u74e6\u7247\u670d\u52a1\u4f7f\u7528\u653f\u7b56'}</a></p>
      </div></PanelCard>
      <PanelCard title={'\u53ef\u9009\u536b\u661f\u5f71\u50cf'} icon="file-text"><div className="flex flex-col gap-md text-body text-muted-foreground">
      <p>Tiles &copy; Esri &amp; contributors. World Imagery.</p>
      <p><a className="text-primary underline underline-offset-4" href="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer" target="_blank" rel="noopener noreferrer">{'\u5f71\u50cf\u670d\u52a1\u4e0e\u6765\u6e90\u8bf4\u660e'}</a></p>
      </div></PanelCard>
      <PanelCard title={'\u4e1a\u52a1\u6570\u636e\u6765\u6e90'} icon="file-text"><div className="flex flex-col gap-md text-body text-muted-foreground">
      <p>{'\u7ad9\u5740\u70b9\u4f4d\u3001\u901a\u8bdd\u3001\u6d41\u91cf\u3001\u77ed\u4fe1\u3001\u8fd0\u8425\u6307\u6807\u4e0e\u8bbe\u5907\u72b6\u6001\u4e3a\u5408\u6210\u6570\u636e\uff0c\u4e0d\u4ee3\u8868\u771f\u5b9e\u8fd0\u8425\u5546\u6216\u7ad9\u5740\u7684\u751f\u4ea7\u6570\u636e\u3002'}</p>
      </div></PanelCard>
    </article>
  </main></ProductWorkspace>;
}
