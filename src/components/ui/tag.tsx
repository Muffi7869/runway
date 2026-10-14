import type { HTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export function Tag({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "warn" }) {
  return (
    <span
      className={cn("ui-tag", variant === "warn" && "ui-tag--warn", className)}
      {...props}
    />
  );
}
