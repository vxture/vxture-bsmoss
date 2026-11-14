import {capacityParameterRead,capacityParameterWrite} from "../../../domains/capacity/parameter-http";
export const dynamic="force-dynamic";
export async function GET(){return capacityParameterRead(true);}
export async function PATCH(request:Request){return capacityParameterWrite(request);}
