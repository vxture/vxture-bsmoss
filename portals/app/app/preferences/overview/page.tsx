import {redirect} from "next/navigation";
import {overviewDisplayHref} from "../../portal/overview-display-links";
export default function LegacyOverviewPreferences() {
  redirect(overviewDisplayHref());
}
