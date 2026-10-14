"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";

import { DAY_OFF_REASONS } from "@/lib/settings/day-off";

import {
  addDayOffAction,
  removeDayOffAction,
  type DayOffActionState,
} from "./days-off-actions";

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
    <section className="mt-10 border-t pt-6">
      <h2 className="text-xl font-semibold">Days off</h2>
      <form action={addAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="grid gap-1">
          <span>Date</span>
          <input
            className="rounded border px-3 py-2"
            min={today}
            name="date"
            onChange={(event) => setDate(event.target.value)}
            type="date"
            value={date}
          />
          {addState.errors?.date ? <span className="text-sm text-[var(--danger)]">{addState.errors.date}</span> : null}
        </label>
        <label className="grid gap-1">
          <span>Reason</span>
          <select
            className="rounded border px-3 py-2"
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
          {addState.errors?.reason ? <span className="text-sm text-[var(--danger)]">{addState.errors.reason}</span> : null}
        </label>
        <button
          className="ui-button ui-button--primary"
          disabled={isAdding}
          type="submit"
        >
          {isAdding ? "Adding…" : "Add day off"}
        </button>
      </form>
      {addState.error ? <p className="mt-3 text-sm text-[var(--danger)]">{addState.error}</p> : null}
      {addState.ok ? <p className="mt-3 text-sm text-[var(--ok)]">Day off saved.</p> : null}
      {addState.note ? <p className="mt-1 text-sm">{addState.note}</p> : null}

      <div className="mt-5 space-y-3">
        {days.length === 0 ? <p>No upcoming days off.</p> : null}
        {days.map((day) => (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded border p-3" key={day.id}>
            <p>
              <span className="font-medium">{displayDate(day.date)}</span>
              {` · ${displayReason(day.reason)}`}
            </p>
            <form action={removeAction}>
              <input name="id" type="hidden" value={day.id} />
              <button
                className="rounded border px-3 py-2 disabled:opacity-50"
                disabled={isRemoving}
                type="submit"
              >
                {isRemoving ? "Removing…" : "Remove"}
              </button>
            </form>
          </div>
        ))}
      </div>
      {removeState.error ? <p className="mt-3 text-sm text-[var(--danger)]">{removeState.error}</p> : null}
      {removeState.ok ? <p className="mt-3 text-sm text-[var(--ok)]">Day off removed.</p> : null}
      {removeState.note ? <p className="mt-1 text-sm">{removeState.note}</p> : null}
    </section>
  );
}
