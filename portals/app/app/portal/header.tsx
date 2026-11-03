import type { ReactNode } from "react";
import ProductChrome from "./chrome";
import type { PortalPage } from "./navigation";

export default function ProductFrame({ active, children, preview = process.env.BSMOSS_PRODUCT_PREVIEW === "on" }: {
  active: PortalPage; children: ReactNode; preview?: boolean;
}) {
  return <ProductChrome active={active} preview={preview}>{children}</ProductChrome>;
}
