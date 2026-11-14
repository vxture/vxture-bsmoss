import {monitoringParameterRead,monitoringParameterWrite} from "../../../domains/monitoring/parameter-http";
export const dynamic="force-dynamic";
export async function GET(){return monitoringParameterRead(true);}
export async function PATCH(request:Request){return monitoringParameterWrite(request);}
