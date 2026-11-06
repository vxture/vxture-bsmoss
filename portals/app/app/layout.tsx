import type { ReactNode } from "react";
import { BRAND } from "@bsmoss/shared";
import "./globals.css";
import Providers from "./providers";
export const metadata = {
  title: BRAND.shortName + " \u00b7 \u89c2\u6f9c",
  description: BRAND.fullName,
  icons: { icon: { url: "/assets/brand/guanlan-mark.svg", type: "image/svg+xml" } },
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
