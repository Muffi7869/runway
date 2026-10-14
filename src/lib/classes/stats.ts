export type ClassStats = { activeAssignments: number; loggedMinutes: number; nextDeadline: string | null };

export function classRowStats({ assignments, sessions }: {
  assignments: ReadonlyArray<{ id: string; class_id: string; deadline: string; status: string }>;
  sessions: ReadonlyArray<{ assignment_id: string; actual_minutes: number }>;
}): Map<string, ClassStats> {
  const stats = new Map<string, ClassStats>();
  const classByAssignment = new Map<string, string>();
  for (const assignment of assignments) {
    classByAssignment.set(assignment.id, assignment.class_id);
    const current = stats.get(assignment.class_id) ?? { activeAssignments: 0, loggedMinutes: 0, nextDeadline: null };
    if (assignment.status === "active") {
      current.activeAssignments += 1;
      if (current.nextDeadline === null || new Date(assignment.deadline) < new Date(current.nextDeadline)) current.nextDeadline = assignment.deadline;
    }
    stats.set(assignment.class_id, current);
  }
  for (const session of sessions) {
    const classId = classByAssignment.get(session.assignment_id);
    if (!classId) continue;
    const current = stats.get(classId) ?? { activeAssignments: 0, loggedMinutes: 0, nextDeadline: null };
    current.loggedMinutes += session.actual_minutes;
    stats.set(classId, current);
  }
  return stats;
}
