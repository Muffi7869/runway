import { requireOwner } from "@/lib/auth/server";
import {
  buildCheckinView,
  type CheckinGroup,
  type CheckinStepInput,
} from "@/lib/checkin/view";
import { createClient } from "@/lib/db/server";
import { requireSettingsComplete } from "@/lib/settings/server";
import {
  addDays,
  APP_TIMEZONE,
  zonedParts,
  zonedTimeToUtc,
} from "@/lib/time/zoned";

import { CheckinForm } from "./checkin-form";
import styles from "./checkin.module.css";

function dateKey(date: { year: number; month: number; day: number }): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

export default async function CheckinPage() {
  await requireSettingsComplete();
  const user = await requireOwner();
  const supabase = await createClient();
  const now = new Date();
  const todayParts = zonedParts(now, APP_TIMEZONE);
  const today = {
    year: todayParts.year,
    month: todayParts.month,
    day: todayParts.day,
  };
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);
  const todayLa = dateKey(today);
  const yesterdayLa = dateKey(yesterday);
  const rangeStart = zonedTimeToUtc(
    { ...yesterday, hour: 0, minute: 0 },
    APP_TIMEZONE,
  );
  const rangeEnd = zonedTimeToUtc(
    { ...tomorrow, hour: 0, minute: 0 },
    APP_TIMEZONE,
  );
  const [assignmentsResult, classesResult] = await Promise.all([
    supabase
      .from("assignments")
      .select("id,class_id,title,status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("deadline", { ascending: true }),
    supabase
      .from("classes")
      .select("id,name,color")
      .eq("user_id", user.id),
  ]);

  if (assignmentsResult.error || classesResult.error) {
    throw new Error("Unable to load check-in assignments.");
  }

  const assignmentIds = assignmentsResult.data.map(
    (assignment) => assignment.id,
  );
  const [stepsResult, sessionsResult] = await Promise.all([
    assignmentIds.length
      ? supabase
          .from("steps")
          .select("id,assignment_id,name,order,percent_done")
          .eq("user_id", user.id)
          .in("assignment_id", assignmentIds)
          .order("order", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    assignmentIds.length
      ? supabase
          .from("sessions")
          .select("assignment_id,actual_minutes")
          .eq("user_id", user.id)
          .eq("date", todayLa)
          .in("assignment_id", assignmentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (stepsResult.error || sessionsResult.error) {
    throw new Error("Unable to load check-in details.");
  }

  const stepIds = stepsResult.data.map((step) => step.id);
  const blocksResult = stepIds.length
    ? await supabase
        .from("blocks")
        .select("id,step_id,start,planned_minutes,status")
        .eq("user_id", user.id)
        .in("step_id", stepIds)
        .in("status", ["planned", "missed", "checked_in"])
        .gte("start", rangeStart.toISOString())
        .lt("start", rangeEnd.toISOString())
    : { data: [], error: null };

  if (blocksResult.error) {
    throw new Error("Unable to load check-in blocks.");
  }

  const assignmentById = new Map(
    assignmentsResult.data.map((assignment) => [assignment.id, assignment]),
  );
  const classById = new Map(
    classesResult.data.map((classRow) => [classRow.id, classRow]),
  );
  const steps: CheckinStepInput[] = stepsResult.data.flatMap((step) => {
    const assignment = assignmentById.get(step.assignment_id);
    const classRow = assignment
      ? classById.get(assignment.class_id)
      : undefined;

    return assignment && classRow
      ? [
          {
            id: step.id,
            assignmentId: assignment.id,
            assignmentStatus: assignment.status,
            assignmentTitle: assignment.title,
            className: classRow.name,
            classColor: classRow.color,
            name: step.name,
            order: step.order,
            percentDone: step.percent_done,
          },
        ]
      : [];
  });
  const groups = buildCheckinView({
    blocks: blocksResult.data.map((block) => ({
      id: block.id,
      stepId: block.step_id,
      start: block.start,
      plannedMinutes: block.planned_minutes,
      status: block.status,
    })),
    steps,
    sessionsToday: sessionsResult.data.map((session) => ({
      assignmentId: session.assignment_id,
      actualMinutes: session.actual_minutes,
    })),
    todayLa,
    yesterdayLa,
  });
  const groupedAssignmentIds = new Set(
    groups.map((group) => group.assignmentId),
  );
  const sessionByAssignment = new Map(
    sessionsResult.data.map((session) => [session.assignment_id, session]),
  );
  const stepsByAssignment = new Map<string, CheckinStepInput[]>();

  for (const step of steps) {
    const assignmentSteps = stepsByAssignment.get(step.assignmentId) ?? [];
    assignmentSteps.push(step);
    stepsByAssignment.set(step.assignmentId, assignmentSteps);
  }

  const otherGroups: CheckinGroup[] = assignmentsResult.data.flatMap(
    (assignment) => {
      if (groupedAssignmentIds.has(assignment.id)) {
        return [];
      }

      const classRow = classById.get(assignment.class_id);
      const existingSession = sessionByAssignment.get(assignment.id);
      const assignmentSteps = (stepsByAssignment.get(assignment.id) ?? [])
        .filter((step) => step.percentDone < 100)
        .sort(
          (first, second) =>
            first.order - second.order || first.id.localeCompare(second.id),
        );

      if (!classRow) {
        return [];
      }

      return [
        {
          assignmentId: assignment.id,
          className: classRow.name,
          classColor: classRow.color,
          title: assignment.title,
          minutesDefault: existingSession?.actual_minutes ?? 0,
          blockIds: [],
          steps: assignmentSteps.map((step) => ({
            stepId: step.id,
            name: step.name,
            order: step.order,
            storedPercent: step.percentDone,
            plannedToday: false,
          })),
          alreadyCheckedIn: Boolean(existingSession),
        },
      ];
    },
  );
  const initialAllDone = assignmentsResult.data.flatMap((assignment) => {
    const assignmentSteps = stepsByAssignment.get(assignment.id) ?? [];
    return assignmentSteps.length > 0 &&
      assignmentSteps.every((step) => step.percentDone === 100)
      ? [{ assignmentId: assignment.id, title: assignment.title }]
      : [];
  });

  return (
    <main className={styles.page}>
      <h1>Check in</h1>
      <CheckinForm
        initialAllDone={initialAllDone}
        initialGroups={groups}
        otherGroups={otherGroups}
      />
    </main>
  );
}
