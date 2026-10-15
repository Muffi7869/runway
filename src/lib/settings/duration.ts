export type DurationParts = { hours: number; minutes: number };

function wholeNonnegativeNumber(value: unknown): number | null {
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

export function splitMinutes(total: unknown): DurationParts | null {
  const minutes = wholeNonnegativeNumber(total);

  if (minutes === null) {
    return null;
  }

  return {
    hours: Math.floor(minutes / 60),
    minutes: minutes % 60,
  };
}

export function joinMinutes(hours: unknown, minutes: unknown): number | null {
  const hourValue = wholeNonnegativeNumber(hours);
  const minuteValue = wholeNonnegativeNumber(minutes);

  if (hourValue === null || minuteValue === null) {
    return null;
  }

  return hourValue * 60 + minuteValue;
}
