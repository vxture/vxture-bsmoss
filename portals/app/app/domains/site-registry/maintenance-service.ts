import {maintenanceCommand} from "./maintenance-rules";
import {hasAsset} from "./asset-model";
import type {FileRegistryMaintenanceStore} from "./maintenance-store";
export function registryMaintenanceService(store:FileRegistryMaintenanceStore,authorize:()=>Promise<void>){
  return {
    async read(){await authorize();const catalog=await store.read();await authorize();return catalog;},
    async update(raw:unknown){await authorize();const command=maintenanceCommand(raw);if(!hasAsset(command.kind,command.id))throw Error("asset_not_found");return store.update(command,"local-preview",authorize);},
  };
}
