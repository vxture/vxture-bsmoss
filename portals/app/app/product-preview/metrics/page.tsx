import { notFound } from 'next/navigation';
import { buildPreview, DEFAULT_REQUEST } from '../../domains/preview/model.ts';
import { Preview } from '../preview.tsx';
export const dynamic='force-dynamic';
export default function Page() {
  if(process.env.BSMOSS_PRODUCT_PREVIEW!=='on')notFound();
  return <><a className="mw-return-link" href="/product-preview">{'\u2190 \u8fd4\u56de\u9655\u897f\u5730\u56fe\u5de5\u4f5c\u53f0'}</a><Preview initial={buildPreview(DEFAULT_REQUEST)}/></>;
}
