"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ThemeProvider, FullscreenProvider, ToastProvider, TooltipProvider } from "@vxture/design-system";

export default function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Recreate the preference context in the browser so restored CSS and tools agree.
  return <ThemeProvider key={mounted ? "browser" : "server"} defaultMode="light"><FullscreenProvider><ToastProvider><TooltipProvider>{children}</TooltipProvider></ToastProvider></FullscreenProvider></ThemeProvider>;
}
