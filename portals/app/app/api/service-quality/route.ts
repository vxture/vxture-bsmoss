import {NextResponse} from 'next/server';
import {gunzipSync} from 'node:zlib';
import {authenticatedDemoEnabled} from '../../lib/demo-mode';
import {previewRoot} from '../../domains/tower-service/preview';
import {readDemoArtifact} from '../../domains/tower-service/demo-artifact';
// Demo middleware enforces the real session. No formal-data fallback.
export async function GET(request:Request){
 if(!authenticatedDemoEnabled())return NextResponse.json({error:'NOT_AVAILABLE'},{status:404});
 const query=new URL(request.url).searchParams;
 if([...query.keys()].some(key=>!['site','city','county'].includes(key))||[...query.keys()].some(key=>query.getAll(key).length!==1))return NextResponse.json({error:'INVALID_QUERY'},{status:400});
 const site=query.get('site'),city=query.get('city')??'all',county=query.get('county')??'all';
 if(!site||!/^SX-DEMO-\d{3,4}$/.test(site)||![city,county].every(v=>/^(all|\d{6})$/.test(v)))return NextResponse.json({error:'INVALID_QUERY'},{status:400});
 const root=previewRoot()+'/demo-history';
 const model=JSON.parse(gunzipSync(await readDemoArtifact(root+'/quality/current.json.gz',root)).toString('utf8'));
 const row=model.sites.find((value:{siteId:string;city:string;county:string})=>value.siteId===site&&(city==='all'||value.city===city)&&(county==='all'||value.county===county));
 return NextResponse.json(row?{policy:model.policy,synthetic:true,month:model.month,site:row}:{error:'NOT_FOUND'},
  {status:row?200:404,headers:{'Cache-Control':'private, no-store'}});
}
