import {verificationParameterRead,verificationParameterWrite} from "../../../domains/usage-verification/parameter-http";
export const dynamic="force-dynamic";
export async function GET(){return verificationParameterRead(true);}
export async function PATCH(request:Request){return verificationParameterWrite(request);}
