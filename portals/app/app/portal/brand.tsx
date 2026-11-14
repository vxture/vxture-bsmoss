import { ShellHeaderMark } from "@vxture/design-system";

// CSS follows the active DS theme before hydration, independently of OS mode.
// The shell's 24px mark uses the approved optical-size variants.
export default function ProductBrandMark() {
  return <>
    <ShellHeaderMark src="/assets/brand/guanlan-mark-light-24-v2.svg" className="dark:hidden" />
    <ShellHeaderMark src="/assets/brand/guanlan-mark-dark-24-v2.svg" className="hidden dark:inline-flex" />
  </>;
}
