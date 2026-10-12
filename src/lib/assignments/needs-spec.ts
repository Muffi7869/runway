export function shouldShowNeedsSpec(
  assignment: { id: string; status: "active" | "done" | "dropped" },
  needsSpecIds: ReadonlySet<string>,
): boolean {
  return assignment.status === "active" && needsSpecIds.has(assignment.id);
}
