import type { HTMLAttributes } from "react";

import { CircleCheck, TriangleAlert } from "lucide-react";

import { cn } from "../../lib/utils";

export function Banner({
  children,
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant: "warn" | "ok" }) {
  const Icon = variant === "warn" ? TriangleAlert : CircleCheck;
  return (
    <div
      className={cn("ui-banner", `ui-banner--${variant}`, className)}
      role="status"
      {...props}
    >
      <Icon aria-hidden="true" size={18} strokeWidth={1.6} />
      <div>{children}</div>
    </div>
  );
}
