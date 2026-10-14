import type { HTMLAttributes } from "react";

import type { ClassColor } from "../../lib/classes/palette";
import { cn } from "../../lib/utils";

export function ClassChip({
  color,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { color: ClassColor }) {
  return (
    <span
      className={cn("ui-class-chip", className)}
      data-class-color={color}
      {...props}
    />
  );
}
