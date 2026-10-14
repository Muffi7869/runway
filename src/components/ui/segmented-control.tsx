"use client";

import {
  useId,
  useState,
  type KeyboardEvent,
} from "react";

import { cn } from "../../lib/utils";

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export function SegmentedControl<T extends string>({
  ariaLabel,
  className,
  defaultValue,
  onValueChange,
  options,
  role = "radiogroup",
  value,
}: {
  ariaLabel: string;
  className?: string;
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  options: readonly SegmentOption<T>[];
  role?: "radiogroup" | "tablist";
  value?: T;
}) {
  const name = useId();
  const [internalValue, setInternalValue] = useState(
    defaultValue ?? options.find((option) => !option.disabled)?.value,
  );
  const selected = value ?? internalValue;

  function select(next: T) {
    if (value === undefined) {
      setInternalValue(next);
    }
    onValueChange?.(next);
  }

  function move(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    for (let offset = 1; offset <= options.length; offset += 1) {
      const index = (currentIndex + direction * offset + options.length) % options.length;
      const option = options[index];
      if (option && !option.disabled) {
        select(option.value);
        event.currentTarget.parentElement
          ?.querySelectorAll<HTMLButtonElement>('[role="radio"], [role="tab"]')
          [index]?.focus();
        return;
      }
    }
  }

  return (
    <div
      aria-label={ariaLabel}
      className={cn("ui-segmented", className)}
      role={role}
    >
      {options.map((option, index) => (
        <button
          aria-checked={role === "radiogroup" ? selected === option.value : undefined}
          aria-selected={role === "tablist" ? selected === option.value : undefined}
          className="ui-segmented__item"
          disabled={option.disabled}
          key={option.value}
          name={name}
          onClick={() => select(option.value)}
          onKeyDown={(event) => move(event, index)}
          role={role === "tablist" ? "tab" : "radio"}
          tabIndex={selected === option.value ? 0 : -1}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
