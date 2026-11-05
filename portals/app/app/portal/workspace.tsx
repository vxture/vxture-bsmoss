import type { ReactNode } from "react";

// The outer safety inset belongs to navigation and content together.
// Page roots own the independent reading inset and scroll-end safety space.
export default function ProductWorkspace({ children, navigation, className }: {
  children: ReactNode; navigation?: ReactNode; className?: string;
}) {
  return <div className={"product-workspace " + (className ?? "")}>
    {navigation}
    <div className="product-workspace-content">{children}</div>
  </div>;
}
