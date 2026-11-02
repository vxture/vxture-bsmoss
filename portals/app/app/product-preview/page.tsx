import { notFound } from "next/navigation";
import { initialWorkbench } from "../domains/map-demo/service.ts";
import Workbench from "./workbench/workbench.tsx";
export const dynamic = "force-dynamic";
export default function Page() {
  if (process.env.BSMOSS_PRODUCT_PREVIEW !== "on") notFound();
  const initial=initialWorkbench();
  return <Workbench scenes={initial.scenes} region={initial.region} initialSnapshot={initial.snapshot}/>;
}
