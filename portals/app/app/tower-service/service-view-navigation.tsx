'use client';
import {Button,Icon,type IconName} from '@vxture/design-system';
import {serviceViews,serviceViewHref} from './service-navigation';
import './service-navigation.css';

export default function ServiceNavigation({values,currentHref,returnTo,busy,onNavigate}:{values:Record<string,string|number>;currentHref:string;returnTo?:string|null;busy:boolean;onNavigate:(href:string)=>void}){
 const icons:Record<string,IconName>={operators:'users',periods:'calendar',comparison:'chart-line-up',summary:'database',details:'list-checks'};
 return <nav className="service-unified-navigation" aria-label={'\u670d\u52a1\u91cf\u5316\u677f\u5757'} inert={busy}>{serviceViews.map(view=><Button key={view.value} size="xl" variant="secondary" aria-current={String(values.view)===view.value?'page':undefined} className={String(values.view)===view.value?'text-primary':undefined} onClick={()=>{if(values.view!==view.value)onNavigate(serviceViewHref(values,view.value,currentHref,returnTo));}}><Icon name={icons[view.value]} size="sm"/>{view.label}</Button>)}</nav>;
}
