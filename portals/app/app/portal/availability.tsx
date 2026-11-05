import PageHeading from "./page-heading";
import { Button, PanelCard, ShellPageContainer } from "@vxture/design-system";

// Shared page composition for closed or unauthenticated workspaces.
// Keep the same page inset and heading hierarchy as the available workspace.
export default function WorkspaceAvailability({ title, description, stateTitle, message, loginHref }: {
  title: string; description?: string; stateTitle?: string; message?: string; loginHref?: string;
}) {
  return <ShellPageContainer className="product-page-inset gap-lg">
    <PageHeading title={title} description={description} />
    <PanelCard title={stateTitle ?? (loginHref ? "\u9700\u8981\u767b\u5f55" : "\u63a5\u5165\u72b6\u6001")} icon="shield-check">
      <div className="flex flex-col items-start gap-lg">
        {message && <p className="text-body text-muted-foreground">{message}</p>}
        {loginHref && <Button asChild><a href={loginHref}>{"\u4f7f\u7528\u5e73\u53f0\u8d26\u53f7\u767b\u5f55"}</a></Button>}
      </div>
    </PanelCard>
  </ShellPageContainer>;
}
