"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Drawer, Icon, ShellIconButton, ShellIconGroup, ShellThemeToggle, useTheme } from "@vxture/design-system";
import UpdateMessages from "./update-messages";

// Console shell composition; product order is theme, messages, help, settings.
export default function ProductHeaderTools({ authenticated = false, loginEnabled = false, management = false }: { authenticated?: boolean; loginEnabled?: boolean; management?: boolean }) {
  const { theme, setMode } = useTheme();
  const [messagesOpen, setMessagesOpen] = useState(false);
  const buttonClass = "size-control-xl";
  const linkClass = buttonClass + " text-muted-foreground hover:text-foreground";
  return <>
    <ShellIconGroup label={"\u64cd\u4f5c\u5de5\u5177"}>
      <ShellThemeToggle currentTheme={theme} onThemeChange={setMode} className={buttonClass}
        lightLabel={"\u4e3b\u9898\uff1a\u5207\u6362\u6d45\u8272"} darkLabel={"\u4e3b\u9898\uff1a\u5207\u6362\u6df1\u8272"} />
      <ShellIconButton icon="bell" label={"\u6d88\u606f"} active={messagesOpen} className={buttonClass}
        aria-haspopup="dialog" aria-expanded={messagesOpen} onClick={() => setMessagesOpen(true)} />
      <Button asChild variant="ghost" size="icon-md" className={linkClass}>
        <a href="https://docs.vxture.com" target="_blank" rel="noopener noreferrer" aria-label={"\u5e2e\u52a9"} title={"\u5e2e\u52a9"}><Icon name="help" size="sm" /></a>
      </Button>
      <Button asChild variant="ghost" size="icon-md" className={linkClass + (management ? " bg-accent text-foreground" : "")}>
        <Link href="/settings" target={management ? undefined : "_blank"} rel={management ? undefined : "noopener noreferrer"}
          aria-current={management ? "location" : undefined} aria-label={"\u914d\u7f6e\u7ba1\u7406"} title={"\u914d\u7f6e\u7ba1\u7406"}><Icon name="settings" size="sm" /></Link>
      </Button>
    </ShellIconGroup>
    <Drawer open={messagesOpen} onClose={() => setMessagesOpen(false)} side="right" width="sm" className="max-w-full"
      title={"\u6d88\u606f"} closeLabel={"\u5173\u95ed\u6d88\u606f"}>
      {messagesOpen && <UpdateMessages enabled={authenticated && loginEnabled} loginEnabled={loginEnabled} />}
    </Drawer>
  </>;
}
