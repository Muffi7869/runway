"use client";

import { useActionState, useState } from "react";

import {
  saveCalendars,
  type CalendarActionState,
} from "./calendar-actions";

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
    <form action={formAction} className="mt-6 space-y-4">
      <fieldset className="space-y-3">
        <legend className="font-medium">Calendars</legend>
        {calendars.length ? (
          calendars.map((calendar) => (
            <label className="flex items-center gap-2" key={calendar.id}>
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
                <small className="text-[var(--ink-3)]">primary</small>
              ) : null}
            </label>
          ))
        ) : (
          <p className="text-sm text-[var(--ink-3)]">
            No calendars are available to select.
          </p>
        )}
      </fieldset>

      {state.formError ? (
        <p className="text-sm text-[var(--danger)]">{state.formError}</p>
      ) : null}
      {state.successMessage ? (
        <p className="text-sm text-[var(--ok)]">{state.successMessage}</p>
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
