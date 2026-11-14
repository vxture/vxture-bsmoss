'use client';
import {SegmentedControl} from '@vxture/design-system';
import {serviceViews,serviceViewHref} from './service-navigation';
import './service-navigation.css';

export default function ServiceNavigation({values,currentHref,returnTo,busy,onNavigate}:{values:Record<string,string|number>;currentHref:string;returnTo?:string|null;busy:boolean;onNavigate:(href:string)=>void}){
 return <div className="service-unified-navigation" inert={busy}><SegmentedControl ariaLabel="服务量化板块" value={String(values.view)} items={serviceViews.map(view=>({value:view.value,label:view.label}))} onChange={value=>{if(values.view!==value)onNavigate(serviceViewHref(values,value,currentHref,returnTo));}}/></div>;
}
