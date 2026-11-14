'use client';
import Link from 'next/link';
import {Button,ShellPageContainer} from '@vxture/design-system';
import PageHeading from '../portal/page-heading';
import {configurationTime} from '../settings/configuration-layout';
import {DEMO_REGION} from '../domains/map-demo/resources';
import {snapshotQuery,type SnapshotContext,type SnapshotDescriptor} from '../domains/tower-service/query';
import SnapshotControls from '../tower-service/query-controls';
import ReportLibrary from '../tower-service/judgment/report-library';
import {centreSectionHref,towerReportCentreHref} from './centre-links';
import '../portal/pagination.css';

export default function TowerReportWorkspace({context,snapshot,snapshots,operators,reportId}:{context:SnapshotContext;snapshot:SnapshotDescriptor;snapshots:SnapshotDescriptor[];operators:string[];reportId:string}){
 const scope=snapshotQuery(context);
 const href=(patch:Record<string,string|number>={})=>towerReportCentreHref({...scope,...Object.fromEntries(Object.entries(patch).map(([key,value])=>[key,String(value)]))});
 return <ShellPageContainer className="site-analysis-page product-page-inset gap-lg">
  <PageHeading title={'\u62a5\u544a\u4e2d\u5fc3'} icon="file-text" description={'\u6309\u5feb\u7167\u3001\u533a\u57df\u548c\u8fd0\u8425\u5546\u751f\u6210\u7814\u5224\u62a5\u544a'} context={!reportId&&<span className="text-body-small text-muted-foreground">{'\u6570\u636e\u622a\u81f3 '+configurationTime(snapshot.dataThrough)}</span>} actions={<Button asChild variant="outline"><Link href={centreSectionHref('library',scope)}>{'\u5468\u671f\u62a5\u544a\u4e0e\u4efb\u52a1'}</Link></Button>}/>
  {!reportId&&<section className="site-analysis-toolbar"><SnapshotControls context={context} snapshots={snapshots} region={DEMO_REGION} href={href} operators={operators} showRegion={false}/></section>}
  <ReportLibrary context={context} reportId={reportId} href={href} showLegacyLink={false}/>
 </ShellPageContainer>;
}
