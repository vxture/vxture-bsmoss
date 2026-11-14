import type { ReactNode } from "react";
import {towerBrand} from "./portal/tower-navigation";
import "./globals.css";
import Providers from "./providers";
export const metadata = {
  title: towerBrand.name,
  description: towerBrand.fullName,
  icons: {
    icon: [
      { url: "/favicon.ico?v=2", type: "image/x-icon", sizes: "16x16 32x32 48x48" },
      { url: "/assets/brand/guanlan-favicon-v2.svg", type: "image/svg+xml", sizes: "any" },
    ],
    apple: { url: "/assets/brand/guanlan-apple-touch-v2.png", sizes: "180x180", type: "image/png" },
  },
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
