import BusinessPage from "../business-analysis/page-view";
export const dynamic = "force-dynamic";
export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <BusinessPage kind="capacity" searchParams={props.searchParams} />;
}
