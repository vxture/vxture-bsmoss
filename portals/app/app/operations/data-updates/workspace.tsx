"use client";
import SourceAvailability from './source-availability';
import Link from "next/link";

import {Button} from "@vxture/design-system";
import PageHeading from "../../portal/page-heading";
import type {assetSource} from "../../domains/site-registry/asset-model";
import AssetSyncStatus from "./source-status";
import TaskList from "./task-list";
import "../../site-analysis/site-analysis.css";
export default function UpdateTasksWorkspace({source,availability}:{source:ReturnType<typeof assetSource>|null;availability:import("../../domains/data-updates/rules").DataAvailability[]}) {
 return <div className="site-analysis-page product-page-inset flex min-w-0 flex-col gap-lg">
  <PageHeading title={"\u6570\u636e\u66f4\u65b0"} icon="database" actions={<Button asChild variant="outline"><Link href="/tower-service/sync">{"\u5feb\u7167\u540c\u6b65\u5e95\u5ea7"}</Link></Button>} description={"\u7edf\u4e00\u67e5\u770b\u4e3b\u6570\u636e\u540c\u6b65\u4e0e\u6307\u6807\u5904\u7406\u4efb\u52a1"}/>
  <AssetSyncStatus source={source}/>{source&&<SourceAvailability availability={availability}/>}<TaskList/>
 </div>;
}
