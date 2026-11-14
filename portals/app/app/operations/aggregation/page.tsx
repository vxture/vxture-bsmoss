import {redirect} from "next/navigation";
import {legacyAggregationHref} from "../data-updates/links";
export const dynamic="force-dynamic";
export default async function AggregationPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 redirect(legacyAggregationHref(await searchParams));
}
