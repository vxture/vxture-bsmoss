import type { Bounds, CircleSelection, PolygonSelection, MapQuery, Selection } from './types.ts';
export const POLYGON_VERTEX_LIMIT=32;
type Point=[number,number];
const cross=(a:Point,b:Point,c:Point)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const onSegment=(p:Point,a:Point,b:Point)=>Math.abs(cross(a,b,p))<=1e-12&&p[0]>=Math.min(a[0],b[0])-1e-12&&p[0]<=Math.max(a[0],b[0])+1e-12&&p[1]>=Math.min(a[1],b[1])-1e-12&&p[1]<=Math.max(a[1],b[1])+1e-12;
function segmentsIntersect(a:Point,b:Point,c:Point,d:Point):boolean {
  const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);
  return ((x>0&&y<0||x<0&&y>0)&&(z>0&&w<0||z<0&&w>0))||onSegment(c,a,b)||onSegment(d,a,b)||onSegment(a,c,d)||onSegment(b,c,d);
}
function parsePolygon(value:string):PolygonSelection {
  if(value.length>2048)throw Error('invalid_polygon');
  const raw=value.slice(8).split(';');
  if(raw.length<3||raw.length>POLYGON_VERTEX_LIMIT+1)throw Error('invalid_polygon');
  const vertices:Point[]=raw.map(pair=>{
    const fields=pair.split(','),p=fields.map(Number);
    if(fields.length!==2||fields.some(v=>!v.trim())||p.some(v=>!Number.isFinite(v))||p[0]<-180||p[0]>180||p[1]<-85||p[1]>85)throw Error('invalid_polygon');
    return [Number(p[0].toFixed(6)),Number(p[1].toFixed(6))];
  });
  const same=(a:Point,b:Point)=>a[0]===b[0]&&a[1]===b[1];
  if(same(vertices[0],vertices[vertices.length-1]))vertices.pop();
  const n=vertices.length;
  if(n<3||n>POLYGON_VERTEX_LIMIT||new Set(vertices.map(p=>p.join(','))).size!==n)throw Error('invalid_polygon');
  const bounds=selectionBounds({kind:'polygon',vertices});
  parseBounds(bounds.join(','));
  if(bounds[2]-bounds[0]>=180)throw Error('invalid_polygon');
  let area=0;
  for(let i=0;i<n;i++){
    const a=vertices[i],b=vertices[(i+1)%n];
    // Local-origin shoelace avoids cancellation at province coordinates.
    area+=cross(vertices[0],a,b);
    if(Math.abs(cross(a,b,vertices[(i+2)%n]))<=1e-12)throw Error('invalid_polygon');
    for(let j=i+1;j<n;j++){
      if(j===i+1||i===0&&j===n-1)continue;
      if(segmentsIntersect(a,b,vertices[j],vertices[(j+1)%n]))throw Error('invalid_polygon');
    }
  }
  if(Math.abs(area)<1e-10)throw Error('invalid_polygon');
  if(area<0)vertices.reverse();
  // Same ring with a different starting point or winding has one identity.
  let first=0;
  for(let i=1;i<n;i++)if(vertices[i][0]<vertices[first][0]||vertices[i][0]===vertices[first][0]&&vertices[i][1]<vertices[first][1])first=i;
  return {kind:'polygon',vertices:[...vertices.slice(first),...vertices.slice(0,first)]};
}
export function polygonFromPoints(vertices:Point[]):PolygonSelection|null {
  try{return parsePolygon('polygon:'+vertices.map(p=>p.join(',')).join(';'));}catch{return null;}
}
export function parseBounds(value:string):Bounds {
  const raw=value.split(',');
  if(raw.length!==4||raw.some(p=>!p.trim()))throw Error('invalid_bounds');
  const p=raw.map(Number);
  if(p.some(n=>!Number.isFinite(n))||p[0]<-180||p[2]>180||p[1]<-85||p[3]>85||p[0]>=p[2]||p[1]>=p[3])throw Error('invalid_bounds');
  return p as Bounds;
}
export function inBounds(lng:number,lat:number,bounds:Bounds):boolean {
  return lng>=bounds[0]&&lng<=bounds[2]&&lat>=bounds[1]&&lat<=bounds[3];
}
export function rectangle(a:[number,number],b:[number,number]):Bounds|null {
  const bounds:Bounds=[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])];
  if(bounds[2]-bounds[0]<0.00001||bounds[3]-bounds[1]<0.00001)return null;
  try{return parseBounds(bounds.join(','));}catch{return null;}
}
export function boundsPolygon(b:Bounds) {
  return {type:'Polygon' as const,coordinates:[[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]],[b[0],b[1]]]]};
}
// Spherical WGS84 longitude/latitude distance, independent of camera projection.
const EARTH_METERS=6371008.8,DEG=Math.PI/180;
export function distanceMeters(a:[number,number],b:[number,number]):number {
  const dLat=(b[1]-a[1])*DEG,dLng=(b[0]-a[0])*DEG;
  const h=Math.sin(dLat/2)**2+Math.cos(a[1]*DEG)*Math.cos(b[1]*DEG)*Math.sin(dLng/2)**2;
  return 2*EARTH_METERS*Math.asin(Math.sqrt(Math.max(0,Math.min(1,h))));
}
export function selectionBounds(s:Selection):Bounds {
  if(Array.isArray(s))return s;
  if(s.kind==='polygon')return [Math.min(...s.vertices.map(p=>p[0])),Math.min(...s.vertices.map(p=>p[1])),Math.max(...s.vertices.map(p=>p[0])),Math.max(...s.vertices.map(p=>p[1]))];
  const angular=s.radiusMeters/EARTH_METERS,dLat=angular/DEG;
  const dLng=Math.asin(Math.sin(angular)/Math.cos(s.center[1]*DEG))/DEG;
  return [s.center[0]-dLng,s.center[1]-dLat,s.center[0]+dLng,s.center[1]+dLat];
}
export function parseSelection(value:string):Selection {
  if(value.startsWith('polygon:'))return parsePolygon(value);
  if(!value.startsWith('circle:'))return parseBounds(value);
  if(value.length>140)throw Error('invalid_circle');
  const raw=value.slice(7).split(','),p=raw.map(Number);
  if(raw.length!==3||raw.some(v=>!v.trim())||p.some(v=>!Number.isFinite(v))||p[0]<-180||p[0]>180||p[1]<-85||p[1]>85||p[2]<10||p[2]>500000)throw Error('invalid_circle');
  const circle:CircleSelection={kind:'circle',center:[p[0],p[1]],radiusMeters:p[2]};
  // This province-level tool does not support polar or antimeridian circles.
  parseBounds(selectionBounds(circle).join(','));
  return circle;
}
export function serializeSelection(s:Selection):string {
  return Array.isArray(s)?s.join(','):s.kind==='polygon'?'polygon:'+s.vertices.map(p=>p.join(',')).join(';'):'circle:'+s.center.join(',')+','+s.radiusMeters;
}
export function circleFromPoints(center:[number,number],edge:[number,number]):CircleSelection|null {
  try {
    const c=center.map(v=>Number(v.toFixed(6))) as [number,number];
    return parseSelection('circle:'+c.join(',')+','+Math.round(distanceMeters(c,edge))) as CircleSelection;
  }catch{return null;}
}
export function inSelection(lng:number,lat:number,s:Selection):boolean {
  if(Array.isArray(s))return inBounds(lng,lat,s);
  if(s.kind==='circle')return distanceMeters(s.center,[lng,lat])<=s.radiusMeters+0.000001;
  if(!inBounds(lng,lat,selectionBounds(s)))return false;
  let inside=false;
  for(let i=0,j=s.vertices.length-1;i<s.vertices.length;j=i++){
    const a=s.vertices[j],b=s.vertices[i];
    if(onSegment([lng,lat],a,b))return true;
    if((a[1]>lat)!==(b[1]>lat)&&lng<(b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
export function selectionPolygon(s:Selection) {
  if(Array.isArray(s))return boundsPolygon(s);
  if(s.kind==='polygon')return {type:'Polygon' as const,coordinates:[[...s.vertices,[...s.vertices[0]]]]};
  const lat=s.center[1]*DEG,lng=s.center[0]*DEG,angle=s.radiusMeters/EARTH_METERS;
  const ring=Array.from({length:96},(_,i)=>{
    const bearing=i/96*Math.PI*2;
    const y=Math.asin(Math.sin(lat)*Math.cos(angle)+Math.cos(lat)*Math.sin(angle)*Math.cos(bearing));
    const x=lng+Math.atan2(Math.sin(bearing)*Math.sin(angle)*Math.cos(lat),Math.cos(angle)-Math.sin(lat)*Math.sin(y));
    return [x/DEG,y/DEG];
  });
  ring.push([...ring[0]]);
  return {type:'Polygon' as const,coordinates:[ring]};
}
export function selectionLabel(s:Selection):string {
  return Array.isArray(s)?'\u77e9\u5f62\u9009\u533a':s.kind==='polygon'?'\u591a\u8fb9\u5f62 \u00b7 '+s.vertices.length+' \u4e2a\u9876\u70b9':'\u5706\u5f62 R '+(s.radiusMeters/1000).toLocaleString('zh-CN',{maximumFractionDigits:2})+' km';
}
// Camera viewport must never change the regional analysis context.
export function mapContextKey(q:Omit<MapQuery,'bbox'>):string {
  return JSON.stringify([q.regionId,q.cityId,q.countyId,q.operator,q.hour,q.search.trim(),q.selection??null,q.topic??null]);
}
