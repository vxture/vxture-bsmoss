import {pageMetadata} from '../portal/page-metadata';
export const metadata=pageMetadata('/settings');
import type { ReactNode } from "react";
import ProductFrame from "../portal/header";

// Keep the shared shell mounted while only the settings page changes.
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <ProductFrame active="settings">{children}</ProductFrame>;
}
