import DictionaryWorkspace from "./workspace";
import { dictionaryView } from "./model";
export const dynamic = "force-dynamic";
export default async function DictionariesPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const query=await searchParams;
 return <DictionaryWorkspace key={dictionaryView(query.view)} view={dictionaryView(query.view)}/>;
}
