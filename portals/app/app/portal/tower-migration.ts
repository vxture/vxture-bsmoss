import type {PortalPage} from './navigation';
export const towerTargets=[
 {id:'overview',path:'/tower-service/overview',batch:'T07',available:true},
 {id:'network',path:'/product-preview',batch:'T07',available:true},
 {id:'resources',path:'/tower-service/resources',batch:'T03',available:true},
 {id:'services',path:'/tower-service/services',batch:'T04',available:true},
 {id:'evidence',path:'/tower-service/evidence',batch:'T05',available:true},
 {id:'judgment',path:'/tower-service/judgment',batch:'T06',available:true},
 {id:'sync',path:'/tower-service/sync',batch:'T02',available:true},
 {id:'rules',path:'/tower-service/rules',batch:'T02',available:true},
] as const;
export type MigrationState='pending'|'partial'|'legacy'|'foundation';
export interface MigrationEntry {state:MigrationState;targets:readonly string[];batch:string}
const pending=(targets:readonly string[],batch:string):MigrationEntry=>({state:'pending',targets,batch});
const partial=(targets:readonly string[],batch:string):MigrationEntry=>({state:'partial',targets,batch});
const legacy:MigrationEntry={state:'legacy',targets:[],batch:'T08'};
export const towerMigration:Record<PortalPage,MigrationEntry>={
 home:partial(['overview'],'T07'),board:partial(['judgment'],'T06'),map:partial(['network'],'T07'),sites:partial(['resources'],'T03'),
 'customer-use':partial(['resources','services','evidence'],'T03-T05'),sharing:partial(['resources','judgment'],'T03-T06'),
 monitoring:legacy,capacity:legacy,efficiency:partial(['evidence'],'T05'),'operator-usage':legacy,
 analysis:partial(['services','judgment'],'T04-T06'),reports:partial(['judgment'],'T06'),'usage-reports':partial(['judgment'],'T06'),
 'usage-review':legacy,'review-history':legacy,'data-updates':partial(['sync'],'T02'),aggregation:partial(['sync'],'T02'),'report-jobs':partial(['judgment'],'T06'),
 'source-configurations':partial(['sync'],'T02'),'object-mappings':partial(['sync'],'T02'),'configuration-audit':{state:'foundation',targets:['sync','rules'],batch:'T02'},
 'operator-identities':partial(['rules'],'T02'),'business-dictionaries':partial(['rules'],'T02'),'metric-catalog':partial(['rules'],'T02-T04'),'site-classifications':partial(['rules'],'T02'),
 'analysis-rules':partial(['rules'],'T02-T06'),members:partial(['rules'],'T02'),jurisdiction:partial(['rules'],'T02'),
 templates:partial(['judgment'],'T06'),'overview-display':pending(['overview'],'T07'),settings:partial(['rules'],'T08'),
};
export function migrationLabel(page:PortalPage){const state=towerMigration[page].state;return state==='legacy'?'\u4fdd\u7559\u65e7\u7248':state==='partial'?'\u90e8\u5206\u8fc1\u79fb':state==='foundation'?'\u57fa\u7840\u80fd\u529b\u4fdd\u7559':'\u5f85\u8fc1\u79fb';}
export function migrationDescription(page:PortalPage,description?:string){return migrationLabel(page)+' \u00b7 '+(description??'');}
