import {mkdir,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {DEMO_REGION} from '../portals/app/app/domains/map-demo/resources.ts';
import {monitoringModel,monitoringPage} from '../portals/app/app/monitoring/model.ts';
import {monitoringModelDirectory} from '../portals/app/app/monitoring/read-model.ts';
const root=monitoringModelDirectory();await mkdir(root,{recursive:true});
const regions=[['all','all'],...DEMO_REGION.cities.map(c=>[c.id,'all']),...DEMO_REGION.counties.map(c=>[c.cityId,c.id])];
for(const [city,county] of regions){
 const page=monitoringPage(monitoringModel({city,county}));
 await writeFile(`${root}/${city}-${county}.json.gz`,gzipSync(JSON.stringify(page)));
}
console.log(`[monitoring] prepared ${regions.length} paged regional models`);
