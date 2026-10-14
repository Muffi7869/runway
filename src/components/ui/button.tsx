import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "../../lib/utils";

export type ButtonVariant = "default" | "primary" | "ghost" | "small" | "icon";

export function buttonClassName(variant: ButtonVariant = "default") {
  return cn("ui-button", `ui-button--${variant}`);
}

export function Button({
  children,
  className,
  variant = "default",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
}) {
  return (
    <button className={cn(buttonClassName(variant), className)} {...props}>
      {children}
    </button>
  );
}
