'use client';
import type {ReactNode} from 'react';
import {Button,Icon,ShellHeaderTools,useTheme} from '@vxture/design-system';
import EntryBackdrop from './backdrop';
import ProductBrandMark from '../portal/brand';
import {towerBrand} from '../portal/tower-navigation';

export default function PublicEntryShell({children}:{children:ReactNode}) {
 const {theme,setMode}=useTheme();
 return <div className="bsmoss-entry"><EntryBackdrop/>
  <header className="entry-header" data-surface="transparent"><div className="entry-shell-width">
   <div className="entry-brands"><a className="entry-platform-brand" href="https://ruyin.work/" aria-label="Ruyin"><img src="/assets/brand/ruyin-platform.svg" width="24" height="24" alt=""/><span>Ruyin</span></a><span className="entry-brand-divider" aria-hidden="true"/><a className="entry-product-brand" href="/" aria-label={towerBrand.name}><ProductBrandMark/><span>BS-MOSS</span></a></div>
   <div className="entry-header-tools" aria-label={'\u9875\u9762\u5de5\u5177'}>
    <ShellHeaderTools label={'\u4e3b\u9898\u3001\u8bed\u8a00\u4e0e\u5168\u5c4f'} theme={{current:theme,onChange:setMode,toLightLabel:'\u5207\u6362\u6d45\u8272',toDarkLabel:'\u5207\u6362\u6df1\u8272'}} locale={{current:'zh-CN',options:[{locale:'zh-CN',nativeName:'\u7b80\u4f53\u4e2d\u6587'}],onChange:()=>{},label:'\u8bed\u8a00'}} fullscreen={{targetId:'app',enterLabel:'\u5168\u5c4f\u663e\u793a',exitLabel:'\u9000\u51fa\u5168\u5c4f'}}/>
    <Button asChild variant="ghost" size="icon-md"><a href="https://vxture.com/" target="_blank" rel="noopener noreferrer" aria-label={'VXTURE \u4e3b\u7ad9'}><Icon name="home" size="sm"/></a></Button>
   </div>
  </div></header>
  <main className="entry-main"><div className="entry-composition"><p className="entry-eyebrow">TOWER SERVICE INTELLIGENCE</p>{children}<div className="entry-message"><p>{'\u94c1\u5854\u8fd0\u8425\u670d\u52a1\u91cf\u5316\u4e0e\u667a\u80fd\u7814\u5224\u5e73\u53f0'}</p><span>QUANTIFY SERVICES. INFORM DECISIONS.</span></div></div></main>
  <footer className="entry-legal"><div className="entry-shell-width"><span>{'\u00a9 '+new Date().getFullYear()+' VXTURE \u00b7 RUYIN'}</span><nav aria-label={'\u6cd5\u5f8b\u4fe1\u606f'}>{[['terms','\u670d\u52a1\u6761\u6b3e'],['privacy','\u9690\u79c1\u653f\u7b56'],['copyright','\u7248\u6743\u58f0\u660e']].map(([path,label])=><a key={path} href={'https://vxture.com/zh-CN/legal/'+path} target="_blank" rel="noopener noreferrer">{label}</a>)}</nav></div></footer>
 </div>;
}


