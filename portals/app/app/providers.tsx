"use client";

import type { ReactNode } from "react";
import { ThemeProvider, FullscreenProvider, ToastProvider, TooltipProvider } from "@vxture/design-system";

export default function Providers({ children }: { children: ReactNode }) {
  return <ThemeProvider defaultMode="light"><FullscreenProvider><ToastProvider><TooltipProvider>{children}</TooltipProvider></ToastProvider></FullscreenProvider></ThemeProvider>;
}
