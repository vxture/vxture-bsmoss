import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { getOidcConfig } from "../auth/lib/config";
import { getAuthUser } from "../auth/lib/session";
import type { HeaderIdentity } from "./account";
import ProductChrome from "./chrome";
import type { PortalPage } from "./navigation";

export default async function ProductFrame({ active, children, preview = process.env.BSMOSS_PRODUCT_PREVIEW === "on" }: {
  active: PortalPage; children: ReactNode; preview?: boolean;
}) {
  const cfg = getOidcConfig();
  const sid = cfg.enabled ? (await cookies()).get(cfg.cookieName)?.value : undefined;
  const user = sid ? await getAuthUser(cfg, sid).catch(() => null) : null;
  const identity: HeaderIdentity | null = user?.accountStatus === "active" ? {
    displayName: user.displayName, uniqueLine: user.userNo ?? user.phone ?? user.email,
    picture: user.picture, organization: user.activeOrgName, workspace: user.activeWorkspaceName,
  } : null;
  let consoleHref: string | undefined;
  try {
    const url = new URL(process.env.NEXT_PUBLIC_CONSOLE_URL ?? "");
    if (url.protocol === "https:" && !url.username && !url.password) consoleHref = url.href;
  } catch { /* An unconfigured account centre is not a navigation target. */ }
  return <ProductChrome active={active} preview={preview} identity={identity} loginEnabled={cfg.enabled} consoleHref={consoleHref}>{children}</ProductChrome>;
}
