"use client";

import { useRef } from "react";
import { ShellUserMenu } from "@vxture/design-system";
import ProductPreferences from "./preferences";

// Display-only projection. Neither roles nor credentials are sent to the chrome.
export interface HeaderIdentity {
  displayName: string;
  uniqueLine: string | null;
  picture: string | null;
  organization: string | null;
  workspace: string | null;
}

export default function ProductAccount({ identity, loginEnabled, consoleHref }: {
  identity: HeaderIdentity | null; loginEnabled: boolean; consoleHref?: string;
}) {
  const logout = useRef<HTMLFormElement>(null);
  const login = (switchAccount = false) => {
    const returnTo = window.location.pathname + window.location.search;
    window.location.assign("/auth/login?returnTo=" + encodeURIComponent(returnTo) + (switchAccount ? "&switch=1" : ""));
  };
  return <>
    <ShellUserMenu openLabel={"\u7528\u6237\u9762\u677f"} online={identity !== null} triggerClassName="size-control-xl"
      user={identity ? {
        displayName: identity.displayName, uniqueLine: identity.uniqueLine ?? undefined,
        avatarSrc: identity.picture ?? undefined, avatarAlt: identity.displayName,
        meta: [identity.workspace, identity.organization].filter(Boolean).join(" \u00b7 "),
        statusTag: { label: "\u5df2\u767b\u5f55" },
      } : {
        displayName: "\u8bbf\u5ba2",
        meta: "\u89c2\u6f9c \u00b7 BS-MOSS", statusTag: { label: "\u672a\u767b\u5f55" },
      }}
      links={identity && consoleHref ? [{ key: "account", label: "\u8d26\u6237\u4e2d\u5fc3", icon: "user-circle", href: consoleHref, newTab: true }] : []}
      settings={<ProductPreferences />}
      actions={identity ? [
        { key: "switch", label: "\u5207\u6362\u8d26\u53f7", icon: "user-switch", onClick: () => login(true) },
        { key: "logout", label: "\u9000\u51fa\u767b\u5f55", icon: "sign-out", danger: true, onClick: () => logout.current?.requestSubmit() },
      ] : loginEnabled ? [{ key: "login", label: "\u767b\u5f55\u5e73\u53f0\u8d26\u53f7", icon: "sign-in", onClick: () => login() }] : []} />
    {identity ? <form ref={logout} method="post" action="/auth/logout" hidden /> : null}
  </>;
}
