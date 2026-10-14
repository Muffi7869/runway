"use client";

import { Button } from "./button";

export function Stepper({
  ariaLabel,
  disabled = false,
  max = 600,
  min = 0,
  onChange,
  step = 5,
  value,
}: {
  ariaLabel: string;
  disabled?: boolean;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  return (
    <div aria-label={ariaLabel} className="ui-stepper" role="group">
      <Button
        aria-label={`Decrease ${ariaLabel}`}
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
        type="button"
        variant="icon"
      >
        −
      </Button>
      <output aria-live="polite" className="num">
        {value}m
      </output>
      <Button
        aria-label={`Increase ${ariaLabel}`}
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
        type="button"
        variant="icon"
      >
        +
      </Button>
    </div>
  );
}
