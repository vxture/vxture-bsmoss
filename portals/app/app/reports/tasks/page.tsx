import {redirect} from "next/navigation";
import {legacyTasksHref} from "../centre-links";
export const dynamic="force-dynamic";
export default async function ReportTasksPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){redirect(legacyTasksHref(await searchParams));}
