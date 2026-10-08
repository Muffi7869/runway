export function describeSkipped({
  outsideWindow,
  notAssignment,
  unsupportedTime,
  unreadable,
}: {
  outsideWindow: number;
  notAssignment: number;
  unsupportedTime: number;
  unreadable: number;
}): string | null {
  const parts: string[] = [];

  if (outsideWindow) {
    parts.push(`${outsideWindow} outside the date window`);
  }
  if (unsupportedTime) {
    parts.push(`${unsupportedTime} with an unsupported time format`);
  }
  if (unreadable) {
    parts.push(`${unreadable} that couldn't be read`);
  }
  if (notAssignment) {
    parts.push(`${notAssignment} not assignments`);
  }

  return parts.length ? `Not shown: ${parts.join(", ")}.` : null;
}
