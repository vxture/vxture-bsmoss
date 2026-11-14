import {capacityParameterRead} from "../../domains/capacity/parameter-http";
export const dynamic="force-dynamic";
export async function GET(){return capacityParameterRead(false);}
