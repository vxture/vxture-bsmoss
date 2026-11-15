import { demoDataEnabled } from "../../lib/demo-mode";
import {cookies} from "next/headers";
import {getOidcConfig} from "../../auth/lib/config";
import {configurationView} from "../configuration-sections";
import ConfigurationUnavailable from "../configuration-unavailable";
import PreviewConfigurationWorkspace from "../preview-configuration";
import {previewConfigurationCatalog} from "../preview-catalog";
import SourceWorkspace from "../source-workspace";
import MappingWorkspace from "../mapping-workspace";
export const dynamic="force-dynamic";
export default async function DataAccessPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const view=configurationView("data",(await searchParams).view);
  if(demoDataEnabled()&&(view==="sources"||view==="mappings"))return <PreviewConfigurationWorkspace key={view} view={view} {...previewConfigurationCatalog()}/>;
  const config=getOidcConfig(),session=(await cookies()).get(config.cookieName)?.value;
  if(!config.enabled||!session)return <ConfigurationUnavailable area="data" view={view} enabled={config.enabled}/>;
  return view==="mappings"?<MappingWorkspace/>:<SourceWorkspace key={view} audit={view==="versions"}/>;
}
