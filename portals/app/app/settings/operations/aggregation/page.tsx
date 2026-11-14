import { redirect } from "next/navigation";
import { legacyDestination } from "../../../portal/legacy-destination";

export default async function LegacyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(legacyDestination("aggregation", await searchParams));
}
