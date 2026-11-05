import type {MapQuery} from '../domains/map-demo/types';
import {reviewHref} from '../domains/usage-verification/links';
export function relatedReviewHref(scope:Pick<MapQuery,'cityId'|'countyId'|'operator'|'hour'|'selection'|'search'>,period:string,site?:string,metric:'all'|'bytes'|'voiceSeconds'|'sms'='all'){
 return reviewHref({scope:{...scope,regionId:'610000'},period:period==='week'||period==='month'?period:'day',site,metric,category:'all',status:'all',page:1});
}
export function relatedDossierHref(site:string,scope:Pick<MapQuery,'cityId'|'countyId'|'operator'|'hour'>,period:string='day',tab='business'){
 return '/sites/'+encodeURIComponent(site)+'?'+new URLSearchParams({city:scope.cityId,county:scope.countyId,operator:scope.operator,hour:String(scope.hour),period:period==='week'||period==='month'?period:'day',tab});
}
