import { redirect } from "next/navigation";

export default function LegacyReportJobsPage() {
  redirect("/settings/operations/reports");
}
