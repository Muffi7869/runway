import type { CheckinGroup } from "../lib/checkin/view";
import { percentChoices } from "../lib/checkin/view";
import type { ClassColor } from "../lib/classes/palette";

import { ClassChip } from "./ui/class-chip";
import { Tag } from "./ui/tag";
import styles from "./checkin-card.module.css";

export function CheckinCard({
  group,
  color,
  dueLabel,
  fromYesterday,
  minutes,
  percents,
  plannedMinutesByStep,
  onMinutesChange,
  onPercentChange,
}: {
  group: CheckinGroup;
  color: ClassColor;
  dueLabel: string;
  fromYesterday: boolean;
  minutes: string;
  percents: Record<string, number>;
  plannedMinutesByStep: Record<string, number>;
  onMinutesChange: (value: string) => void;
  onPercentChange: (stepId: string, value: number) => void;
}) {
  return (
    <section className={styles.card}>
      <header className={styles.heading}>
        <ClassChip color={color}>{group.className}</ClassChip>
        <h2>{group.title}</h2>
        <span className={styles.due}>{dueLabel}</span>
        {fromYesterday ? <Tag variant="warn">From yesterday</Tag> : null}
      </header>

      {group.alreadyCheckedIn ? (
        <p className={styles.note}>Already checked in today. Saving updates it.</p>
      ) : null}

      <div className={styles.steps}>
        {group.steps.length ? (
          group.steps.map((step) => (
            <div className={styles.step} key={step.stepId}>
              <div className={styles.stepText}>
                <strong>{step.name}</strong>
                <span className="num">
                  {plannedMinutesByStep[step.stepId] ?? 0} min planned
                  {step.storedPercent > 0 ? ` · was ${step.storedPercent}%` : ""}
                </span>
              </div>
              <div
                aria-label={`${step.name} percent complete`}
                className={styles.percentPicker}
                role="group"
              >
                {percentChoices(step.storedPercent).map((choice) => {
                  const selected = percents[step.stepId] === choice.value;
                  return (
                    <button
                      aria-pressed={selected}
                      className={selected ? styles.selectedPercent : undefined}
                      disabled={choice.disabled}
                      key={choice.value}
                      onClick={() => onPercentChange(step.stepId, choice.value)}
                      type="button"
                    >
                      {choice.value}%
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <p className={styles.note}>No unfinished steps.</p>
        )}
      </div>

      <div className={styles.minutesRow}>
        <label htmlFor={`minutes-${group.assignmentId}`}>
          Minutes actually worked
        </label>
        <input
          className="num"
          id={`minutes-${group.assignmentId}`}
          max={720}
          min={0}
          onChange={(event) => onMinutesChange(event.target.value)}
          step={1}
          type="number"
          value={minutes}
        />
        <span>Pre-filled from the plan. Change it if needed.</span>
      </div>
    </section>
  );
}
