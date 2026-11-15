import { demoDataEnabled } from "../../../lib/demo-mode";
import {businessReportArtifact} from '../../../reports/business-service';
import {boundedText} from '../../../lib/http';
import {operatorIdentityStore} from '../../../domains/operator-identities/runtime-store';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(!demoDataEnabled())return new Response(null,{status:404,headers});
 if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return Response.json({error:'invalid_report_request'},{status:415,headers});
 try{const input=JSON.parse(await boundedText(request,4096));if(!input||typeof input!=='object'||Array.isArray(input))throw Error('invalid_report_request');
 const catalog=await operatorIdentityStore('preview').read();
 return Response.json(businessReportArtifact(input,Object.fromEntries(catalog.items.map(row=>[row.code,row.shortName]))),{headers});
 }catch(error){const message=error instanceof Error?error.message:'';if(message==='body_too_large')return Response.json({error:'request_too_large'},{status:413,headers});if(/^(invalid_|outside_history|query_too_large|report_file_too_large)/.test(message)||error instanceof SyntaxError)return Response.json({error:'invalid_report_request'},{status:400,headers});throw error;}
}
