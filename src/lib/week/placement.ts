export function eventPlacement({
  startMinute,
  endMinute,
  startHour,
  rowHeightPx,
  minHeightPx,
}: {
  startMinute: number;
  endMinute: number;
  startHour: number;
  rowHeightPx: number;
  minHeightPx: number;
}): { topPx: number; heightPx: number } {
  const topPx = Math.max(
    0,
    ((startMinute - startHour * 60) / 60) * rowHeightPx,
  );
  const durationHeight =
    ((endMinute - startMinute) / 60) * rowHeightPx;

  return {
    topPx,
    heightPx: Math.max(minHeightPx, durationHeight),
  };
}
