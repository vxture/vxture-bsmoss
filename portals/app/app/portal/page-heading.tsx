import type { ReactNode } from "react";
import { ViewHeader } from "@vxture/design-system";
import type { DataAvailability } from "../domains/data-updates/rules";
import { DataUpdateProvider, DataUpdateButton, DataUpdateTime } from "./data-update";

// Official DS header composition: scope beside title, time above global actions,
// and an optional content toolbar after the title's dashed divider.
export default function PageHeading({ title, description, secondary, region, actions, context, navigation, toolbar, dataUpdate }: {
  title: ReactNode; description?: ReactNode; secondary?: ReactNode; region?: ReactNode;
  actions?: ReactNode; context?: ReactNode; navigation?: ReactNode;
  toolbar?: ReactNode;
  dataUpdate?: DataAvailability;
}) {
  const heading = <div className="product-page-heading" data-page-heading>
    {navigation && <div className="product-page-navigation">{navigation}</div>}
    <div className="product-page-title-row">
      <ViewHeader title={title} description={description}
        secondary={<>{region && <div className="product-page-region">{region}</div>}{secondary}</>}
        divider={false} className="min-w-0 pb-0" />
      {(context || actions || dataUpdate) && <div className="product-page-utilities">
        {(context || dataUpdate) && <div className="product-page-context">{dataUpdate ? <DataUpdateTime /> : context}</div>}
        {(actions || dataUpdate) && <div className="product-page-actions" role="group" aria-label={"\u9875\u9762\u64cd\u4f5c"}>{dataUpdate && <DataUpdateButton />}{actions}</div>}
      </div>}
    </div>
    {toolbar && <div className="product-page-toolbar">{toolbar}</div>}
  </div>;
  return dataUpdate ? <DataUpdateProvider availability={dataUpdate}>{heading}</DataUpdateProvider> : heading;
}
