import {identityRead,identityWrite} from "../../../domains/operator-identities/http";
export const dynamic="force-dynamic";
export async function GET(){return identityRead(true);}
export async function PATCH(request:Request){return identityWrite(request);}
