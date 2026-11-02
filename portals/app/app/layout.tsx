import type { ReactNode } from "react";
import { BRAND } from "@bsmoss/shared";
import "./globals.css";
export const metadata = {
  title: BRAND.shortName + " \u00b7 \u89c2\u6f9c",
  description: BRAND.fullName,
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
