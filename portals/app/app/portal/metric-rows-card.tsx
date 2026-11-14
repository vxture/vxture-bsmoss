import type { ComponentProps, ReactNode } from "react";
import { LabeledValue, PanelCard, PanelItem, PanelList } from "@vxture/design-system";

// Business composition of published DS components. Full values and units remain
// readable when a summary card has too little room for horizontal metrics.
export default function MetricRowsCard({ title, icon, description, metrics }: {
  title: string;
  icon: ComponentProps<typeof PanelCard>["icon"];
  description?: string;
  metrics: readonly { key: string; label: string; value: ReactNode }[];
}) {
  return <PanelCard title={title} icon={icon} description={description} className="min-w-0">
    <PanelList>{metrics.map(metric => <PanelItem key={metric.key}
      main={<LabeledValue label={<span className="whitespace-normal">{metric.label}</span>}
        value={<span className="whitespace-normal break-words tabular-nums">{metric.value}</span>} />} />)}
    </PanelList>
  </PanelCard>;
}
