import {mkdir,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {readTowerPreview} from '../portals/app/app/domains/tower-service/history-reader.ts';
import {pageModelKey} from '../portals/app/app/domains/tower-service/page-read-model.ts';
import {previewRoot} from '../portals/app/app/domains/tower-service/preview.ts';
import {DEMO_REGION} from '../portals/app/app/domains/map-demo/resources.ts';
import {dashboardModel,networkModel} from '../portals/app/app/tower-service/dashboard/model.ts';
import {baselineModel} from '../portals/app/app/tower-service/resources/baseline-model.ts';
import {servicesModel} from '../portals/app/app/tower-service/services/model.ts';
import {energyModel} from '../portals/app/app/tower-service/judgment/energy-model.ts';

process.env.BSMOSS_DATA_MODE='demo';
const directory=previewRoot()+'/demo-history/pages';await mkdir(directory,{recursive:true});
const scopes=[['all','all'],...DEMO_REGION.cities.map(c=>[c.id,'all']),...DEMO_REGION.counties.map(c=>[c.cityId,c.id])];
let count=0;
for(const [city,county] of scopes){
 const r=await readTowerPreview({city,county},undefined);
 for(const [kind,model] of [
  ['dashboard',()=>dashboardModel(r.input,r.versions,r.access.operators,r.access.cityIds)],
  ['network',()=>networkModel(r.input,r.versions,r.access.operators,r.access.cityIds)],
  ['resources',()=>baselineModel({view:'composition',...r.input},r.versions)],
  ['services',()=>servicesModel(r.input,r.versions,r.access.operators)],
  ['energy',()=>energyModel(r.input,r)],
 ]){await writeFile(directory+'/'+pageModelKey(kind,r.input)+'.json.gz',gzipSync(JSON.stringify(model())));count++;}
 if(count%50===0)console.log('[page-models] '+count+' prepared');
}
console.log('[page-models] published '+count+' models across '+scopes.length+' regions');
