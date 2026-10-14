"use client";

import { useActionState, useState } from "react";

import {
  saveCalendars,
  type CalendarActionState,
} from "./calendar-actions";
import styles from "./settings.module.css";

export type CalendarOption = {
  id: string;
  name: string;
  primary: boolean;
};

export function CalendarPicker({
  calendars,
  initialSelectedIds,
}: {
  calendars: CalendarOption[];
  initialSelectedIds: string[];
}) {
  const [selectedIds, setSelectedIds] = useState(initialSelectedIds);
  const [state, formAction, isPending] = useActionState<
    CalendarActionState,
    FormData
  >(saveCalendars, {});

  function setSelected(calendarId: string, selected: boolean) {
    setSelectedIds((current) =>
      selected
        ? [...current, calendarId]
        : current.filter((id) => id !== calendarId),
    );
  }

  return (
    <form action={formAction} className={styles.form}>
      <fieldset>
        <legend>Calendars</legend>
        <div className={styles.calendarList}>
        {calendars.length ? (
          calendars.map((calendar) => (
            <label className={styles.calendarChoice} key={calendar.id}>
              <input
                checked={selectedIds.includes(calendar.id)}
                name="calendar_ids"
                onChange={(event) =>
                  setSelected(calendar.id, event.target.checked)
                }
                type="checkbox"
                value={calendar.id}
              />
              <span>{calendar.name}</span>
              {calendar.primary ? (
                <small className={styles.hint}>primary</small>
              ) : null}
            </label>
          ))
        ) : (
          <p className={styles.hint}>
            No calendars are available to select.
          </p>
        )}
        </div>
      </fieldset>

      {state.formError ? (
        <p className={`${styles.message} ${styles.error}`}>{state.formError}</p>
      ) : null}
      {state.successMessage ? (
        <p className={`${styles.message} ${styles.success}`}>{state.successMessage}</p>
      ) : null}

      <button
        className="ui-button ui-button--primary"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Saving…" : "Save calendars"}
      </button>
    </form>
  );
}
