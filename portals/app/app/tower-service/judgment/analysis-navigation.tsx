'use client';
import Link from 'next/link';
import {Button,Icon} from '@vxture/design-system';
import type {SnapshotContext} from '../../domains/tower-service/query';
import {analysisHref,type SharingGrain} from './analysis-links';
import {dashboardHref} from '../dashboard/links';
export default function AnalysisNavigation({context,active,grain='month',pending=false}:{context:SnapshotContext;active:'energy'|'sharing'|'occupancy'|'regions';grain?:SharingGrain;pending?:boolean}){
 return <nav className="judgment-heading-links" inert={pending} aria-label={'\u5206\u6790\u4e13\u9898'}>{[{view:'energy' as const,label:'\u80fd\u8017\u5206\u6790'},{view:'sharing' as const,label:'\u5171\u4eab\u5206\u6790'},{view:'occupancy' as const,label:'\u5165\u9a7b\u53d8\u5316'},{view:'regions' as const,label:'\u533a\u57df\u5bf9\u6bd4'}].map(item=><Button key={item.view} asChild size="xl" variant="secondary" className={active===item.view?'bg-primary-muted text-primary':undefined}><Link href={item.view==='regions'?dashboardHref('/tower-service/network',context):analysisHref(context,item.view,grain)} aria-current={active===item.view?'page':undefined}><Icon name={item.view==='energy'?'lightning':item.view==='sharing'?'users':item.view==='occupancy'?'chart-line-up':'map-pin'} size="sm"/>{item.label}</Link></Button>)}</nav>;
}
