"use client";

import type { ReactNode } from "react";
import { ThemeProvider, FullscreenProvider, ToastProvider, TooltipProvider } from "@vxture/design-system";
import {OperatorIdentitiesProvider} from "./portal/operator-identities";

export default function Providers({ children }: { children: ReactNode }) {
  // DS15 restores theme, density and font preferences after hydration. Keep the
  // provider stable so streamed pages are not remounted during that restoration.
  return <ThemeProvider defaultMode="light"><FullscreenProvider><ToastProvider><TooltipProvider><OperatorIdentitiesProvider>{children}</OperatorIdentitiesProvider></TooltipProvider></ToastProvider></FullscreenProvider></ThemeProvider>;
}
