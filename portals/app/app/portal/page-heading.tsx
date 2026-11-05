import type { ReactNode } from "react";
import { ViewHeader } from "@vxture/design-system";

// Page-level business composition of the official DS header. Keep headings,
// context, actions and filters in stable slots rather than per-page flex rows.
export default function PageHeading({ title, description, secondary, actions, context, navigation, toolbar }: {
  title: ReactNode; description?: ReactNode; secondary?: ReactNode;
  actions?: ReactNode; context?: ReactNode; navigation?: ReactNode;
  toolbar?: ReactNode;
}) {
  return <div className="product-page-heading" data-page-heading>
    {navigation && <div className="product-page-navigation">{navigation}</div>}
    <div className="product-page-title-row">
      <ViewHeader title={title} description={description} secondary={secondary}
        divider={false} className="min-w-0 flex-1 pb-0" />
      {actions && <div className="product-page-actions" role="group" aria-label={"\u9875\u9762\u64cd\u4f5c"}>{actions}</div>}
    </div>
    {context && <div className="product-page-context">{context}</div>}
    {toolbar && <div className="product-page-toolbar">{toolbar}</div>}
  </div>;
}
