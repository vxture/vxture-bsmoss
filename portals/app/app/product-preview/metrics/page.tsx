import "./legacy-metrics.css";
import { notFound } from 'next/navigation';
import { buildPreview, DEFAULT_REQUEST } from '../../domains/preview/model.ts';
import { Preview } from '../preview.tsx';
export const dynamic='force-dynamic';
export default function Page() {
  if(process.env.BSMOSS_PRODUCT_PREVIEW!=='on')notFound();
  return <div className="legacy-metrics"><a className="mw-return-link" target="_blank" rel="noopener noreferrer" href="/product-preview">{'\u6253\u5f00\u7ad9\u7f51\u5168\u666f'}</a><Preview initial={buildPreview(DEFAULT_REQUEST)}/></div>;
}
