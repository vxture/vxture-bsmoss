import { demoDataEnabled } from "../lib/demo-mode";
import ConfigurationPage from "./configuration";

export const dynamic = "force-dynamic";
export default function SettingsPage() {
  return <><ConfigurationPage preview={demoDataEnabled()} /></>;
}
