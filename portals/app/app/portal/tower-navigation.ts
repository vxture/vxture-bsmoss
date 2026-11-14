import type {IconName} from '@vxture/design-system';
import {portalDomain,type PortalDomain,type PortalPage} from './navigation';
import {monitoringIcon} from './business-icons';
import {towerTargets} from './tower-migration';
import {businessModuleForPath} from './business-modules';

export const towerHome='/tower-service/overview';
export const towerSettings='/tower-service/rules';
const text:Record<string,{label:string;description:string;icon:IconName;domain:PortalDomain}>={
 overview:{label:'\u7ecf\u8425\u603b\u89c8',description:'\u5e95\u6570\u3001\u670d\u52a1\u4e0e\u5173\u6ce8',icon:'house-line',domain:'business'},
 network:{label:'\u7ad9\u7f51\u5168\u666f',description:'\u7a7a\u95f4\u5b9a\u4f4d\u4e0e\u5355\u7ad9\u8c03\u67e5',icon:'map-pin',domain:'business'},
 monitoring:{label:'\u8fd0\u884c\u76d1\u6d4b',description:'\u76d1\u6d4b\u8986\u76d6\u3001\u8fd0\u884c\u72b6\u6001\u4e0e\u5f02\u5e38',icon:monitoringIcon,domain:'business'},
 resources:{label:'\u8d44\u6e90\u5e95\u6570',description:'\u7ad9\u5740\u8bbe\u65bd\u4e0e\u79df\u6237',icon:'building',domain:'business'},
 services:{label:'\u670d\u52a1\u91cf\u5316',description:'\u670d\u52a1\u6570\u91cf\u3001\u7528\u91cf\u4e0e\u4f9d\u636e',icon:'users',domain:'business'},
 evidence:{label:'\u8ba1\u91cf\u4f9d\u636e',description:'\u7528\u91cf\u8bb0\u5f55\u4e0e\u53e3\u5f84',icon:'list-checks',domain:'business'},
 judgment:{label:'\u5206\u6790\u7814\u5224',description:'\u8fd0\u884c\u3001\u8fd0\u8425\u4e0e\u7ecf\u8425\u4e13\u9898\u5206\u6790',icon:'chart-line-up',domain:'business'},
 reports:{label:'\u62a5\u544a\u4e2d\u5fc3',description:'\u751f\u6210\u3001\u5f52\u6863\u4e0e\u4efb\u52a1',icon:'file-text',domain:'business'},
 sync:{label:'\u6570\u636e\u540c\u6b65',description:'\u8ba1\u5212\u3001\u7248\u672c\u4e0e\u6821\u9a8c',icon:'database',domain:'management'},
 rules:{label:'\u89c4\u5219\u914d\u7f6e',description:'\u534f\u8bae\u3001\u9608\u503c\u4e0e\u8303\u56f4',icon:'faders',domain:'management'},
};
// Navigation describes destinations; their services still authorize every read.
const migratedNavigation=towerTargets.filter(t=>t.available&&t.id!=='evidence').map(t=>({...t,...text[t.id],href:t.id==='network'?t.path+'?hour=18':t.path}));
export const towerNavigation=[...migratedNavigation,{id:'monitoring',path:'/monitoring',href:'/monitoring',...text.monitoring},{id:'reports',path:'/reports',href:'/reports',...text.reports}];
export const towerAnalysisNavigation=['monitoring','services','judgment'].flatMap(id=>towerNavigation.filter(item=>item.id===id));
// An operational tool beside the seven business modules, not a new analysis domain.
export const towerDataNavigation={id:'data-updates',path:'/operations/data-updates',href:'/operations/data-updates',label:'\u6570\u636e\u66f4\u65b0',description:'\u540c\u6b65\u4e0e\u805a\u5408\u5904\u7406',icon:'database' as IconName,domain:'business' as PortalDomain};
export function towerEntry(path:string){if(path===towerDataNavigation.path||path.startsWith(towerDataNavigation.path+'/')||path==='/operations/aggregation'||path.startsWith('/operations/aggregation/'))return towerDataNavigation;const module=businessModuleForPath(path);return towerNavigation.find(t=>module?t.id===module:path===t.path||path.startsWith(t.path+'/'));}
export function towerDomain(path:string,active:PortalPage){return towerEntry(path)?.domain??portalDomain(active);}
export const legacyNavigationTitle='\u539f\u6709\u529f\u80fd\uff08\u5f85\u8fc1\u79fb\uff09';
export const towerBrand={name:'\u5854\u670d\u7814\u5224',fullName:'\u94c1\u5854\u8fd0\u8425\u5546\u670d\u52a1\u91cf\u5316\u4e0e\u7814\u5224\u5e73\u53f0'};
