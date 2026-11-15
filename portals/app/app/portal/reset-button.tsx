import { Button, Icon } from "@vxture/design-system";
import type { ButtonHTMLAttributes } from "react";
import Link from "next/link";
import "./reset-button.css";

type ResetButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label" | "title"> & {
  href?: string;
  label?: string;
  variant?: "ghost" | "outline" | "secondary";
};

export default function ResetButton({ href, label = "\u91cd\u7f6e\u7b5b\u9009", variant = "ghost", className, ...props }: ResetButtonProps) {
  const icon = <Icon name="refresh" size="sm" />;
  return <Button {...props} type={props.type ?? "button"} asChild={!!href} variant={variant} size="icon-xl" className={["product-reset-button", className].filter(Boolean).join(" ")} data-product-reset="" aria-label={label} title={label}>
    {href ? <Link href={href}>{icon}</Link> : icon}
  </Button>;
}
