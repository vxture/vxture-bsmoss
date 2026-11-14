import EntryGate from '../entry/view';
import {legacyNavigationTitle} from './tower-navigation';
import { cookies } from "next/headers";
import { MANAGEMENT_NAV_COOKIE, MANAGEMENT_GROUPS_COOKIE, readManagementGroups } from "./management-preference";
import type { ReactNode } from "react";
import { getOidcConfig } from "../auth/lib/config";
import { getRegionPreference } from "./region-preference";
import type { HeaderIdentity } from "./account";
import ProductChrome from "./chrome";
import type { PortalPage } from "./navigation";

export default async function ProductFrame({ active, children, preview = process.env.BSMOSS_PRODUCT_PREVIEW === "on" }: {
  active: PortalPage; children: ReactNode; preview?: boolean;
}) {
  const cfg = getOidcConfig();
  const jar = await cookies();
  const initialNavCollapsed = jar.get(MANAGEMENT_NAV_COOKIE)?.value === "collapsed";
  const initialClosedGroups = readManagementGroups(jar.get(MANAGEMENT_GROUPS_COOKIE)?.value??encodeURIComponent(JSON.stringify([legacyNavigationTitle])));
  const { user, preference } = await getRegionPreference();
  const identity: HeaderIdentity | null = user?.accountStatus === "active" ? {
    displayName: user.displayName, uniqueLine: user.userNo ?? user.phone ?? user.email,
    picture: user.picture, organization: user.activeOrgName, workspace: user.activeWorkspaceName,
  } : null;
  let consoleHref: string | undefined;
  try {
    const url = new URL(process.env.NEXT_PUBLIC_CONSOLE_URL ?? "");
    if (url.protocol === "https:" && !url.username && !url.password) consoleHref = url.href;
  } catch { /* An unconfigured account centre is not a navigation target. */ }
  const chrome = <ProductChrome active={active} preview={preview} identity={identity} loginEnabled={cfg.enabled} consoleHref={consoleHref} regionPreference={preference} initialNavCollapsed={initialNavCollapsed} initialClosedGroups={initialClosedGroups}>{children}</ProductChrome>;
  return (cfg.enabled || process.env.OIDC_CLIENT_MODE === "third_party") && !preview ? <EntryGate>{chrome}</EntryGate> : chrome;
}
