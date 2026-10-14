import { cn } from "../../lib/utils";

export function ProgressBar({
  className,
  color = "blue",
  label,
  value,
}: {
  className?: string;
  color?: string;
  label: string;
  value: number;
}) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={safeValue}
      className={cn("ui-progress", className)}
      role="progressbar"
    >
      <span
        className="ui-progress__fill"
        data-class-color={color}
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}
