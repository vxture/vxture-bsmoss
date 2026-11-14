import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {getOidcConfig} from '../../auth/lib/config';
import {getAuthUser} from '../../auth/lib/session';
import {SIGNED_OUT_COOKIE} from '../../auth/lib/signed-out-marker';
import {readEntryState} from '../../entry/service';
export const dynamic='force-dynamic';
export async function GET(){
 const cfg=getOidcConfig(),jar=await cookies();
 const result=await readEntryState({enabled:cfg.enabled,sessionId:jar.get(cfg.cookieName)?.value,signedOut:jar.get(SIGNED_OUT_COOKIE)?.value==='1',readUser:sid=>getAuthUser(cfg,sid,{activity:true})});
 return NextResponse.json(result,{headers:{'cache-control':'private, no-store','vary':'Cookie'}});
}
