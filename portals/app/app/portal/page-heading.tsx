import type { ReactNode } from "react";
import { ViewHeader, type IconName } from "@vxture/design-system";
import type { DataAvailability } from "../domains/data-updates/rules";
import { DataUpdateProvider, DataUpdateTime } from "./data-update";
import ModuleFunctionMenu from './module-function-menu';

// Metadata occupies the subtitle; secondary destinations and actions share one
// bottom-aligned group. Pages without metadata retain their descriptive subtitle.
export default function PageHeading({ title, icon, iconVisual, description, secondary, region, actions, context, navigation, toolbar, dataUpdate }: {
  icon?: IconName;
  iconVisual?: ReactNode;
  title: ReactNode; description?: ReactNode; secondary?: ReactNode; region?: ReactNode;
  actions?: ReactNode; context?: ReactNode; navigation?: ReactNode;
  toolbar?: ReactNode;
  dataUpdate?: DataAvailability;
}) {
  const subtitle = dataUpdate ? <DataUpdateTime /> : context;
  const header = <ViewHeader title={title} icon={iconVisual ? undefined : icon} iconSize="2xl" description={subtitle ? <span className="product-page-context">{subtitle}</span> : description}
    secondary={<>{region && <div className="product-page-region">{region}</div>}{secondary}</>}
    divider={false} className={iconVisual ? "min-w-0 flex-1 gap-lg pb-0" : "min-w-0 gap-lg pb-0"} />;
  const heading = <div className="product-page-heading" data-page-heading>
    {navigation && <div className="product-page-navigation">{navigation}</div>}
    <div className="product-page-title-row">
      <div className="product-page-identity">{iconVisual ? <div className="flex min-w-0 items-start gap-lg">
        <span className="mt-2xs shrink-0 text-primary-text" aria-hidden="true">{iconVisual}</span>
        {header}
      </div> : header}</div>
      <div className="product-page-utilities">
        <div className="product-page-actions" role="group" aria-label={"\u9875\u9762\u64cd\u4f5c"}>{actions}<ModuleFunctionMenu/></div>
      </div>
    </div>
    {toolbar && <div className="product-page-toolbar">{toolbar}</div>}
  </div>;
  return dataUpdate ? <DataUpdateProvider availability={dataUpdate}>{heading}</DataUpdateProvider> : heading;
}
