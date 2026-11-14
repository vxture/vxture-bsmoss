import {identityRead} from "../../domains/operator-identities/http";
export const dynamic="force-dynamic";
export async function GET(){return identityRead();}
