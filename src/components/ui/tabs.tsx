"use client";

import { SegmentedControl } from "./segmented-control";

export type TabOption<T extends string> = {
  value: T;
  label: string;
  count?: number;
  disabled?: boolean;
};

export function Tabs<T extends string>({
  ariaLabel,
  defaultValue,
  onValueChange,
  options,
  value,
}: {
  ariaLabel: string;
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  options: readonly TabOption<T>[];
  value?: T;
}) {
  return (
    <SegmentedControl
      ariaLabel={ariaLabel}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      options={options.map((option) => ({
        ...option,
        label:
          option.count === undefined
            ? option.label
            : `${option.label} ${option.count}`,
      }))}
      role="tablist"
      value={value}
    />
  );
}
