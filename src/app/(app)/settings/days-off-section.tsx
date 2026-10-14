"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";

import { DAY_OFF_REASONS } from "@/lib/settings/day-off";

import {
  addDayOffAction,
  removeDayOffAction,
  type DayOffActionState,
} from "./days-off-actions";
import styles from "./settings.module.css";

export type DayOffItem = {
  id: string;
  date: string;
  reason: string;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function displayDate(date: string): string {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`));
}

function displayReason(reason: string): string {
  return reason === "rough day"
    ? "Rough day"
    : `${reason.slice(0, 1).toUpperCase()}${reason.slice(1)}`;
}

export function DaysOffSection({
  days,
  today,
}: {
  days: DayOffItem[];
  today: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("other");
  const [addState, addAction, isAdding] = useActionState(
    async (previous: DayOffActionState, formData: FormData) => {
      const result = await addDayOffAction(previous, formData);
      if (result.ok) {
        setDate("");
        setReason("other");
        router.refresh();
      }
      return result;
    },
    {},
  );
  const [removeState, removeAction, isRemoving] = useActionState(
    async (previous: DayOffActionState, formData: FormData) => {
      const result = await removeDayOffAction(previous, formData);
      if (result.ok) {
        router.refresh();
      }
      return result;
    },
    {},
  );

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}><div><h2>Days off</h2><p>Keep rest days clear of planned work.</p></div></div>
      <form action={addAction} className={styles.dayForm}>
        <label className={styles.field}>
          <span>Date</span>
          <input
            className={styles.input}
            min={today}
            name="date"
            onChange={(event) => setDate(event.target.value)}
            type="date"
            value={date}
          />
          {addState.errors?.date ? <span className={`${styles.message} ${styles.error}`}>{addState.errors.date}</span> : null}
        </label>
        <label className={styles.field}>
          <span>Reason</span>
          <select
            className={styles.input}
            name="reason"
            onChange={(event) => setReason(event.target.value)}
            value={reason}
          >
            {DAY_OFF_REASONS.map((option) => (
              <option key={option} value={option}>
                {displayReason(option)}
              </option>
            ))}
          </select>
          {addState.errors?.reason ? <span className={`${styles.message} ${styles.error}`}>{addState.errors.reason}</span> : null}
        </label>
        <button
          className="ui-button ui-button--primary"
          disabled={isAdding}
          type="submit"
        >
          {isAdding ? "Adding…" : "Add day off"}
        </button>
      </form>
      {addState.error ? <p className={`${styles.message} ${styles.error}`}>{addState.error}</p> : null}
      {addState.ok ? <p className={`${styles.message} ${styles.success}`}>Day off saved.</p> : null}
      {addState.note ? <p className={styles.message}>{addState.note}</p> : null}

      <div className={styles.daysList}>
        {days.length === 0 ? <p>No upcoming days off.</p> : null}
        {days.map((day) => (
          <div className={styles.dayRow} key={day.id}>
            <p>
              <strong>{displayDate(day.date)}</strong>
              {` · ${displayReason(day.reason)}`}
            </p>
            <form action={removeAction}>
              <input name="id" type="hidden" value={day.id} />
              <button
                className="ui-button ui-button--small"
                disabled={isRemoving}
                type="submit"
              >
                {isRemoving ? "Removing…" : "Remove"}
              </button>
            </form>
          </div>
        ))}
      </div>
      {removeState.error ? <p className={`${styles.message} ${styles.error}`}>{removeState.error}</p> : null}
      {removeState.ok ? <p className={`${styles.message} ${styles.success}`}>Day off removed.</p> : null}
      {removeState.note ? <p className={styles.message}>{removeState.note}</p> : null}
    </section>
  );
}
