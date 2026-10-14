"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { CheckinCard } from "@/components/checkin-card";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatEstimate } from "@/lib/assignments/helpers";
import {
  clampMinutes,
  type CheckinGroup,
} from "@/lib/checkin/view";
import { CLASS_COLOR_PALETTE, type ClassColor } from "@/lib/classes/palette";
import { describePace } from "@/lib/pace/compute";

import {
  markDoneAction,
  type AssignmentStatusActionState,
} from "../assignments/actions";
import {
  saveCheckinAction,
  type CheckinActionState,
} from "./actions";
import styles from "./checkin.module.css";

type EditableGroup = CheckinGroup & {
  minutes: string;
  percents: Record<string, number>;
};

export type CheckinPresentation = {
  assignmentId: string;
  dueLabel: string;
  fromYesterday: boolean;
  plannedMinutesByStep: Record<string, number>;
};

type ClassPace = {
  id: string;
  name: string;
  color: string;
  paceRatio: number;
};

function classColor(value: string): ClassColor {
  return CLASS_COLOR_PALETTE.some((color) => color.key === value)
    ? (value as ClassColor)
    : "blue";
}

function editableGroup(group: CheckinGroup): EditableGroup {
  return {
    ...group,
    minutes: String(group.minutesDefault),
    percents: Object.fromEntries(
      group.steps.map((step) => [step.stepId, step.storedPercent]),
    ),
  };
}

function MarkDonePrompt({
  assignment,
}: {
  assignment: { assignmentId: string; title: string };
}) {
  const router = useRouter();
  const [state, action, isPending] = useActionState<
    AssignmentStatusActionState,
    FormData
  >(async (previousState, formData) => {
    const nextState = await markDoneAction(previousState, formData);

    if (nextState.ok) {
      router.refresh();
    }

    return nextState;
  }, {});

  if (state.ok) {
    return null;
  }

  return (
    <form action={action} className={styles.donePrompt}>
      <input
        name="assignmentId"
        type="hidden"
        value={assignment.assignmentId}
      />
      <p>
        <strong>{assignment.title}</strong>: All steps done. Mark assignment
        done?
      </p>
      <button disabled={isPending} type="submit">
        {isPending ? "Marking done…" : "Mark done"}
      </button>
      {state.error ? <p className={styles.error}>{state.error}</p> : null}
    </form>
  );
}

export function CheckinForm({
  initialGroups,
  otherGroups,
  initialAllDone,
  presentations,
  classPaces,
}: {
  initialGroups: CheckinGroup[];
  otherGroups: CheckinGroup[];
  initialAllDone: Array<{ assignmentId: string; title: string }>;
  presentations: CheckinPresentation[];
  classPaces: ClassPace[];
}) {
  const router = useRouter();
  const [groups, setGroups] = useState<EditableGroup[]>(() =>
    initialGroups.map(editableGroup),
  );
  const [selectedOther, setSelectedOther] = useState("");
  const [state, formAction, isPending] = useActionState<
    CheckinActionState,
    FormData
  >(async (previousState, formData) => {
    const nextState = await saveCheckinAction(previousState, formData);

    if (nextState.ok) {
      router.refresh();
    }

    return nextState;
  }, {});
  const availableOtherGroups = otherGroups.filter(
    (candidate) =>
      !groups.some((group) => group.assignmentId === candidate.assignmentId),
  );
  const entries = useMemo(
    () =>
      groups.map((group) => ({
        assignment_id: group.assignmentId,
        actual_minutes: clampMinutes(Number(group.minutes)),
        steps: group.steps.map((step) => ({
          step_id: step.stepId,
          percent_after: group.percents[step.stepId] ?? step.storedPercent,
        })),
      })),
    [groups],
  );
  const blockIds = useMemo(
    () => [...new Set(groups.flatMap((group) => group.blockIds))],
    [groups],
  );
  const allDone = [
    ...initialAllDone,
    ...(state.allDone ?? []),
  ].filter(
    (assignment, index, values) =>
      values.findIndex(
        (candidate) => candidate.assignmentId === assignment.assignmentId,
      ) === index,
  );
  const presentationByAssignment = new Map(
    presentations.map((presentation) => [
      presentation.assignmentId,
      presentation,
    ]),
  );
  const totalMinutes = groups.reduce(
    (sum, group) => sum + clampMinutes(Number(group.minutes)),
    0,
  );
  const movedSteps = groups.reduce(
    (sum, group) =>
      sum +
      group.steps.filter(
        (step) =>
          (group.percents[step.stepId] ?? step.storedPercent) >
          step.storedPercent,
      ).length,
    0,
  );
  const plannedMinutes = groups.reduce((sum, group) => {
    const presentation = presentationByAssignment.get(group.assignmentId);
    return (
      sum +
      Object.values(presentation?.plannedMinutesByStep ?? {}).reduce(
        (subtotal, minutes) => subtotal + minutes,
        0,
      )
    );
  }, 0);

  function addOtherWork() {
    const group = otherGroups.find(
      (candidate) => candidate.assignmentId === selectedOther,
    );

    if (!group) {
      return;
    }

    setGroups((current) => [...current, editableGroup(group)]);
    setSelectedOther("");
  }

  return (
    <>
      {groups.length === 0 ? (
        <p className={styles.empty}>
          Nothing scheduled for today. Use Log other work if you did something
          anyway.
        </p>
      ) : null}

      <div className={styles.otherWork}>
        <label htmlFor="other-assignment">Log work on something else</label>
        <div className={styles.otherWorkControls}>
          <select
            id="other-assignment"
            onChange={(event) => setSelectedOther(event.target.value)}
            value={selectedOther}
          >
            <option value="">Choose an assignment</option>
            {availableOtherGroups.map((group) => (
              <option key={group.assignmentId} value={group.assignmentId}>
                {group.className} · {group.title}
              </option>
            ))}
          </select>
          <Button
            disabled={!selectedOther}
            onClick={addOtherWork}
            type="button"
            variant="ghost"
          >
            Add
          </Button>
        </div>
      </div>

      {groups.length > 0 ? (
        <form action={formAction} className={styles.form}>
          <input name="entries" type="hidden" value={JSON.stringify(entries)} />
          <input
            name="blockIds"
            type="hidden"
            value={JSON.stringify(blockIds)}
          />
          <div className={styles.assignmentColumn}>
            {groups.map((group, groupIndex) => {
              const presentation = presentationByAssignment.get(
                group.assignmentId,
              );

              return (
                <CheckinCard
                  color={classColor(group.classColor)}
                  dueLabel={presentation?.dueLabel ?? ""}
                  fromYesterday={presentation?.fromYesterday ?? false}
                  group={group}
                  key={group.assignmentId}
                  minutes={group.minutes}
                  onMinutesChange={(value) => {
                    setGroups((current) =>
                      current.map((candidate, index) =>
                        index === groupIndex
                          ? { ...candidate, minutes: value }
                          : candidate,
                      ),
                    );
                  }}
                  onPercentChange={(stepId, value) => {
                    setGroups((current) =>
                      current.map((candidate, index) =>
                        index === groupIndex
                          ? {
                              ...candidate,
                              percents: {
                                ...candidate.percents,
                                [stepId]: value,
                              },
                            }
                          : candidate,
                      ),
                    );
                  }}
                  percents={group.percents}
                  plannedMinutesByStep={
                    presentation?.plannedMinutesByStep ?? {}
                  }
                />
              );
            })}
          </div>

          <aside aria-label="Summary" className={styles.summaryColumn}>
            <Card className={styles.summaryCard}>
              <p className={styles.label}>Tonight</p>
              <dl>
                <div>
                  <dt>Time worked</dt>
                  <dd className="num">{formatEstimate(totalMinutes)}</dd>
                </div>
                <div>
                  <dt>Steps moved forward</dt>
                  <dd className="num">{movedSteps}</dd>
                </div>
                <div>
                  <dt>Planned today</dt>
                  <dd className="num">{formatEstimate(plannedMinutes)}</dd>
                </div>
              </dl>
              <Button disabled={isPending} type="submit" variant="primary">
                {isPending ? "Saving…" : "Save check-in"}
              </Button>
              {state.error ? <p className={styles.error}>{state.error}</p> : null}
              {state.ok ? (
                <Banner variant="ok">
                  <span>
                    Saved. Your week was replanned. <Link href="/week">See the new plan</Link>
                  </span>
                </Banner>
              ) : null}
              {state.paceFailed ? (
                <p className={styles.note}>Pace will update on a later check-in.</p>
              ) : null}
              {state.replanFailed ? (
                <p className={styles.note}>Saved, but replanning needs another try.</p>
              ) : null}
            </Card>

            <Card className={styles.paceCard}>
              <p className={styles.label}>Your pace</p>
              <ul>
                {classPaces.map((classRow) => (
                  <li data-class-color={classColor(classRow.color)} key={classRow.id}>
                    <span aria-hidden="true" className={styles.paceDot} />
                    <span className={styles.paceText}>
                      <strong>{classRow.name}</strong>
                      <small>{describePace(classRow.paceRatio)}</small>
                    </span>
                    <strong className="num">{classRow.paceRatio.toFixed(2)}×</strong>
                  </li>
                ))}
              </ul>
            </Card>
          </aside>
        </form>
      ) : null}

      {allDone.length > 0 ? (
        <section className={styles.doneSection}>
          {allDone.map((assignment) => (
            <MarkDonePrompt assignment={assignment} key={assignment.assignmentId} />
          ))}
        </section>
      ) : null}
    </>
  );
}
