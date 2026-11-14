import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import type {NetworkModel} from './model';
export interface RegionShape {code:string;name:string;path:string;x:number;y:number}
interface Feature {properties:{adcode:number;name:string;centroid?:number[];center?:number[]};geometry:{type:string;coordinates:number[][][]|number[][][][]}}
// Only public, already bundled administrative polygons are used. No point
// coordinates, station locations, remote tile services or new map dependency.
export function projectRegions(features:Feature[]):RegionShape[]{
 const projected=(v:number[])=>{if(v.length<2||!v.every(Number.isFinite)||Math.abs(v[1])>=85)throw Error('invalid_region_geometry');return [v[0]*Math.PI/180,-Math.log(Math.tan(Math.PI/4+v[1]*Math.PI/360))];};
 const rings=features.map(f=>{if(!['Polygon','MultiPolygon'].includes(f.geometry.type))throw Error('invalid_region_geometry');return {feature:f,rings:(f.geometry.type==='Polygon'?f.geometry.coordinates as number[][][]:(f.geometry.coordinates as number[][][][]).flat()).map(r=>r.map(projected))};});
 const points=rings.flatMap(f=>f.rings.flat()),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);if(!points.length)return [];
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),scale=720/Math.max(maxX-minX,maxY-minY);
 const position=(p:number[])=>[40+(720-(maxX-minX)*scale)/2+(p[0]-minX)*scale,40+(720-(maxY-minY)*scale)/2+(p[1]-minY)*scale];
 return rings.map(({feature:f,rings})=>{const center=f.properties.centroid??f.properties.center,at=center?position(projected(center)):position(rings[0][0]);return {code:String(f.properties.adcode),name:f.properties.name,path:rings.map(r=>r.map((p,i)=>{const [x,y]=position(p);return (i?'L':'M')+x.toFixed(2)+','+y.toFixed(2);}).join('')+'Z').join(''),x:at[0],y:at[1]};});
}
export async function networkGeography(model:Pick<NetworkModel,'context'|'region'>){
 const city=model.context.city,county=model.context.county,url=city==='all'?'/geo/shaanxi-cities.geojson':model.region.cities.find(r=>r.id===city)?.boundaryUrl;
 if(!url)return {shapes:[] as RegionShape[],available:false};
 try{const appRoot=process.cwd().replace(/\\/g,'/').endsWith('/portals/app')?process.cwd():resolve(process.cwd(),'portals/app'),asset=JSON.parse(await readFile(resolve(appRoot,'public'+url),'utf8')) as {features:Feature[]};
  const permitted=new Set((city==='all'?model.region.cities:model.region.counties.filter(r=>r.cityId===city&& (county==='all'||r.id===county))).map(r=>r.id));
  return {shapes:projectRegions(asset.features.filter(f=>permitted.has(String(f.properties.adcode)))),available:true};
 }catch{return {shapes:[] as RegionShape[],available:false};}
}
