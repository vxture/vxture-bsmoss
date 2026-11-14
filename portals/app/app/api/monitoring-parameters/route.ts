import {monitoringParameterRead} from "../../domains/monitoring/parameter-http";
export const dynamic="force-dynamic";
export async function GET(){return monitoringParameterRead(false);}
