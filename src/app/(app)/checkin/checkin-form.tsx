"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  clampMinutes,
  percentChoices,
  type CheckinGroup,
} from "@/lib/checkin/view";
import { CLASS_COLOR_PALETTE } from "@/lib/classes/palette";

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
}: {
  initialGroups: CheckinGroup[];
  otherGroups: CheckinGroup[];
  initialAllDone: Array<{ assignmentId: string; title: string }>;
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
        <p>
          Nothing scheduled for today. Use Log other work if you did something
          anyway.
        </p>
      ) : null}

      <div className={styles.otherWork}>
        <label htmlFor="other-assignment">Log other work</label>
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
          <button
            disabled={!selectedOther}
            onClick={addOtherWork}
            type="button"
          >
            Add
          </button>
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
          {groups.map((group, groupIndex) => {
            const paletteColor = CLASS_COLOR_PALETTE.find(
              (color) => color.key === group.classColor,
            );

            return (
              <section className={styles.group} key={group.assignmentId}>
                <div className={styles.groupHeading}>
                  <span
                    aria-hidden="true"
                    className={styles.swatch}
                    style={{
                      backgroundColor:
                        paletteColor?.value ?? "var(--ink-3)",
                    }}
                  />
                  <h2>
                    {group.className} · {group.title}
                  </h2>
                </div>
                {group.alreadyCheckedIn ? (
                  <p className={styles.note}>Already checked in today.</p>
                ) : null}
                <label className={styles.minutesField}>
                  <span>Minutes worked</span>
                  <input
                    max={720}
                    min={0}
                    onChange={(event) => {
                      const value = event.target.value;
                      setGroups((current) =>
                        current.map((candidate, index) =>
                          index === groupIndex
                            ? { ...candidate, minutes: value }
                            : candidate,
                        ),
                      );
                    }}
                    step={1}
                    type="number"
                    value={group.minutes}
                  />
                </label>
                <div className={styles.steps}>
                  {group.steps.length ? (
                    group.steps.map((step) => (
                      <label className={styles.step} key={step.stepId}>
                        <span>
                          {step.name}
                          {step.plannedToday ? (
                            <small> Planned today</small>
                          ) : null}
                        </span>
                        <select
                          aria-label={`${step.name} percent complete`}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            setGroups((current) =>
                              current.map((candidate, index) =>
                                index === groupIndex
                                  ? {
                                      ...candidate,
                                      percents: {
                                        ...candidate.percents,
                                        [step.stepId]: value,
                                      },
                                    }
                                  : candidate,
                              ),
                            );
                          }}
                          value={group.percents[step.stepId]}
                        >
                          {percentChoices(step.storedPercent).map((choice) => (
                            <option
                              disabled={choice.disabled}
                              key={choice.value}
                              value={choice.value}
                            >
                              {choice.value}%
                            </option>
                          ))}
                        </select>
                      </label>
                    ))
                  ) : (
                    <p className={styles.note}>No unfinished steps.</p>
                  )}
                </div>
              </section>
            );
          })}
          <button className={styles.saveButton} disabled={isPending} type="submit">
            {isPending ? "Saving…" : "Save check-in"}
          </button>
          {state.error ? <p className={styles.error}>{state.error}</p> : null}
          {state.ok ? <p className={styles.success}>Check-in saved.</p> : null}
          {state.paceFailed ? (
            <p className={styles.note}>Pace will update on a later check-in.</p>
          ) : null}
          {state.replanFailed ? (
            <p className={styles.note}>Saved, but replanning needs another try.</p>
          ) : null}
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
