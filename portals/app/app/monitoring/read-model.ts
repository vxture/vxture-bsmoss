import {readDemoArtifact} from '../domains/tower-service/demo-artifact';
import {gunzipSync} from "node:zlib";
import {previewRoot} from "../domains/tower-service/preview";
import {defaultMonitoringConfiguration,type MonitoringConfiguration} from "../domains/monitoring/parameters";
import {monitoringModel,monitoringPage,type MonitoringPage} from "./model";

export const monitoringModelDirectory=()=>previewRoot()+"/demo-history/monitoring-v1";
const defaults=JSON.stringify(defaultMonitoringConfiguration());
export async function readMonitoringPage(input:Record<string,string|string[]|undefined>,configuration:MonitoringConfiguration){
 const city=input.city??"all",county=input.county??"all";
 if(Object.keys(input).every(key=>key==="city"||key==="county") && typeof city==="string" && typeof county==="string" &&
    [city,county].every(value=>/^(all|\d{6})$/.test(value)) && JSON.stringify(configuration)===defaults){
  try{return JSON.parse(gunzipSync(await readDemoArtifact(`${monitoringModelDirectory()}/${city}-${county}.json.gz`,previewRoot()+"/demo-history")).toString("utf8")) as MonitoringPage;}
  catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
 }
 return monitoringPage(monitoringModel(input,configuration));
}
