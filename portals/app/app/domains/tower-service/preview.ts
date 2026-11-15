import {towerReportService} from './tower-report-service';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {serviceResourceModel} from '../../customer-use/resource-model';
import {DEMO_SITES} from '../map-demo/resources';
import {DEMO_DATE,DEMO_VERSION} from '../map-demo/rules';
import {registryRecord} from '../site-registry/demo-store';
import {resourceGraph} from '../site-registry/resource-rules';
import {resourceSnapshot} from '../../tower-service/resources/model';
import {FileFoundationStore} from './store';
import {previewEvidence} from './evidence-preview';
import {foundationService} from './service';
import {OPERATORS,SERVICES,UNITS,inventoryChecks,type FoundationState,type FoundationAccess,type Inventory} from './foundation';
export const PREVIEW_COOKIE='bsmoss-tower-preview-v1';
export const previewRoot=()=>process.env.BSMOSS_DEMO_ROOT ? resolve(process.env.BSMOSS_DEMO_ROOT) : resolve(process.cwd(),process.cwd().replace(/\\/g,'/').endsWith('/portals/app')?'../../tmp/tower-foundation':'tmp/tower-foundation');
let captured:Inventory|undefined;
export function previewInventory():Inventory {
 if(!captured){const model=serviceResourceModel({}),sites=new Map(DEMO_SITES.map(s=>[s.id,s]));captured={descriptor:structuredClone(resourceSnapshot),provinceId:'610000',expectedSites:model.rollup.totals.sites,expectedDevices:model.rollup.totals.devices,rows:model.rows.map(r=>{const record=registryRecord(sites.get(r.id)!,18),graph=resourceGraph(record,DEMO_DATE,DEMO_VERSION);return {attributes:{siteType:record.siteType,scene:record.profile,address:record.address,assetCode:record.assetCode},id:r.id,name:r.name,city:r.city,county:r.county,cityName:r.cityName,countyName:r.countyName,allOperators:[...r.allOperators],graph,devices:graph.devices.map(d=>({id:d.id,name:d.name,category:d.category,owner:d.owner,spec:d.spec}))};})};}
 return structuredClone(captured);
}
export function previewSeed(workspaceId:string):FoundationState{const inventory=previewInventory();return {schema:1,workspaceId,revision:0,snapshots:[{id:inventory.descriptor.id,previousId:null,origin:'reference',digest:createHash('sha256').update(JSON.stringify(inventory)).digest('hex'),inventory,checks:inventoryChecks(inventory)}],runs:[],plans:[{id:'resources',enabled:false,intervalMinutes:60,nextAt:null,sourceId:'demo-resource-inventory',city:'all',operators:[...OPERATORS]}],rules:[],directory:SERVICES.map(id=>({id,name:id,kind:'service' as const,operator:null,units:[...UNITS]})),audit:[]};}
export function previewAccess(workspaceId:string,subject='local-preview'):FoundationAccess{return {workspaceId,subject,expiresAt:4102444800000,actions:['read','sync','schedule','rules','reports'],provinceIds:['610000'],cityIds:['*'],operators:[...OPERATORS],siteIds:null};}
export function validPreviewSession(session:string|undefined):session is string{return !!session&&/^[a-f0-9]{64}$/.test(session);}
export function previewFoundation(session:string){if(process.env.BSMOSS_PRODUCT_PREVIEW!=='on'||!validPreviewSession(session))throw Error('preview_unavailable');const workspaceId='preview-'+session,store=new FileFoundationStore(previewRoot(),workspaceId,()=>previewSeed(workspaceId));return foundationService(store,{access:async()=>{if(process.env.BSMOSS_PRODUCT_PREVIEW!=='on')throw Error('permission_denied');return previewAccess(workspaceId);},source:async sourceId=>{if(sourceId!=='demo-resource-inventory')throw Error('source_unavailable');const inventory=previewInventory();inventory.evidence=previewEvidence(inventory);return inventory;},now:Date.now});}

export function previewTowerReports(session:string){if(process.env.BSMOSS_PRODUCT_PREVIEW!=='on'||!validPreviewSession(session))throw Error('preview_unavailable');const workspaceId='preview-'+session;return towerReportService(new FileFoundationStore(previewRoot(),workspaceId,()=>previewSeed(workspaceId)),{access:async()=>{if(process.env.BSMOSS_PRODUCT_PREVIEW!=='on')throw Error('permission_denied');return previewAccess(workspaceId);},snapshots:async input=>{if(!String(input.snapshotId??'').startsWith('tower-demo-history-')&&!String(input.compareSnapshotId??'').startsWith('tower-demo-history-'))return [];const {readTowerPreview}=await import('./history-reader');return (await readTowerPreview(input,session)).versions;},now:Date.now});}

let readInventory: Inventory | undefined;
// Shared immutable seed for readers; mutable stores continue to use copies.
export function previewReadInventory(): Inventory {
 if (!readInventory) {
  readInventory = previewInventory();
  const freeze = (value: unknown): void => { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) freeze(child); } };
  freeze(readInventory);
 }
 return readInventory;
}
