import {cookies} from "next/headers";
import {getOidcConfig} from "../../auth/lib/config";
import {configurationView} from "../configuration-sections";
import ConfigurationUnavailable from "../configuration-unavailable";
import {JurisdictionWorkspace,MembersWorkspace} from "../management-workspace";
export const dynamic="force-dynamic";
export default async function AccessPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const view=configurationView("access",(await searchParams).view),config=getOidcConfig(),session=(await cookies()).get(config.cookieName)?.value;
  if(!config.enabled||!session)return <ConfigurationUnavailable area="access" view={view} enabled={config.enabled}/>;
  return view==="members"?<MembersWorkspace/>:<JurisdictionWorkspace/>;
}
