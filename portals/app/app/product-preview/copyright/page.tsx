import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'BS-MOSS | Map sources and copyright' };

export default function CopyrightPage() {
  if (process.env.BSMOSS_PRODUCT_PREVIEW !== 'on') notFound();
  return <main style={{minHeight:'100dvh',background:'#09171d',color:'#b8c9bb',padding:'48px 24px',fontFamily:'Arial, sans-serif'}}>
    <article style={{maxWidth:760,margin:'0 auto',lineHeight:1.9}}>
      <a href="/product-preview" style={{color:'#a8c79a',fontSize:13}}>{'\u8fd4\u56de\u5de5\u4f5c\u53f0'}</a>
      <p style={{letterSpacing:2,color:'#819b88'}}>BS-MOSS</p>
      <h1 style={{fontSize:24,color:'#d0dcbc'}}>{'\u5730\u56fe\u6765\u6e90\u4e0e\u7248\u6743\u58f0\u660e'}</h1>
      <h2 style={{fontSize:17}}>{'\u6807\u51c6\u5e95\u56fe'}</h2>
      <p><a style={{color:'#b7d6a6'}} href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">{'\u00a9 OpenStreetMap contributors'}</a></p>
      <p>{'\u5730\u56fe\u6570\u636e\u6765\u81ea OpenStreetMap \u8d21\u732e\u8005\uff0c\u6309 Open Database License (ODbL) \u63d0\u4f9b\u3002\u6807\u51c6\u74e6\u7247\u4f7f\u7528 OpenStreetMap \u516c\u5171\u670d\u52a1\u3002'}</p>
      <p><a style={{color:'#a8c79a'}} href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener noreferrer">ODbL 1.0</a>{' \u00b7 '}<a style={{color:'#a8c79a'}} href="https://operations.osmfoundation.org/policies/tiles/" target="_blank" rel="noopener noreferrer">{'\u74e6\u7247\u670d\u52a1\u4f7f\u7528\u653f\u7b56'}</a></p>
      <h2 style={{fontSize:17}}>{'\u53ef\u9009\u536b\u661f\u5f71\u50cf'}</h2>
      <p>Tiles &copy; Esri &amp; contributors. World Imagery.</p>
      <p><a style={{color:'#a8c79a'}} href="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer" target="_blank" rel="noopener noreferrer">{'\u5f71\u50cf\u670d\u52a1\u4e0e\u6765\u6e90\u8bf4\u660e'}</a></p>
      <h2 style={{fontSize:17}}>{'\u6f14\u793a\u4e1a\u52a1\u6570\u636e'}</h2>
      <p>{'\u7ad9\u5740\u70b9\u4f4d\u3001\u901a\u8bdd\u3001\u6d41\u91cf\u3001\u77ed\u4fe1\u3001\u8fd0\u8425\u6307\u6807\u4e0e\u8bbe\u5907\u72b6\u6001\u4e3a\u4ea7\u54c1\u6f14\u793a\u5408\u6210\u6570\u636e\uff0c\u4e0d\u4ee3\u8868\u771f\u5b9e\u8fd0\u8425\u5546\u6216\u7ad9\u5740\u7684\u751f\u4ea7\u6570\u636e\u3002'}</p>
    </article>
  </main>;
}
