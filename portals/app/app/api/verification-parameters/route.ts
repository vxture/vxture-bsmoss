import {verificationParameterRead} from "../../domains/usage-verification/parameter-http";
export const dynamic="force-dynamic";
export async function GET(){return verificationParameterRead(false);}
