import {getOidcConfig} from "../../auth/lib/config";
export function canMaintainAssets(){return process.env.BSMOSS_PRODUCT_PREVIEW==="on"&&!getOidcConfig().enabled&&["127.0.0.1","localhost"].includes(process.env.HOSTNAME_BIND??"127.0.0.1");}
