import { formatEstimate } from "../assignments/helpers";

export function currentTotalsByAssignment(
  rows: { assignment_id: string; estimated_minutes: number }[],
): Map<string, number> {
  const totals = new Map<string, number>();

  for (const row of rows) {
    totals.set(
      row.assignment_id,
      (totals.get(row.assignment_id) ?? 0) + row.estimated_minutes,
    );
  }

  return totals;
}

export function describeTotals({
  aiTotal,
  currentTotal,
}: {
  aiTotal: number | null;
  currentTotal: number;
}): string {
  const { aiText, currentText } = describeTotalParts({ aiTotal, currentTotal });

  return `AI estimate: ${aiText ?? "none"} · Your plan: ${currentText}`;
}

export function describeTotalParts({ aiTotal, currentTotal }: { aiTotal: number | null; currentTotal: number | null }): { aiText: string | null; currentText: string } {
  return {
    aiText: aiTotal === null ? null : formatEstimate(aiTotal),
    currentText: currentTotal === null || currentTotal === 0 ? "not set yet" : formatEstimate(currentTotal),
  };
}
