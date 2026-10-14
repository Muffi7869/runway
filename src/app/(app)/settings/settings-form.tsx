"use client";

import { useActionState, useState, type FormEvent } from "react";

import {
  hoursAndMinutesToTotalMinutes,
  parseTimeOfDay,
  settingsSchema,
  type SettingsInput,
} from "@/lib/settings/schema";

import { saveSettings, type SettingsActionState } from "./actions";
import styles from "./settings.module.css";

export type SettingsFormValues = {
  study_window_start: string;
  study_window_end: string;
  max_study_hours: string;
  max_study_minutes: string;
  min_block_hours: string;
  min_block_minutes: string;
  max_block_hours: string;
  max_block_minutes: string;
  buffer_days: string;
  check_in_time: string;
};

type FieldErrors = Partial<Record<keyof SettingsInput, string[]>>;

type SettingsFormProps = {
  initialValues: SettingsFormValues;
};

function numericValue(value: string) {
  if (value.trim() === "") {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function durationValue(hours: string, minutes: string) {
  const parsedHours = numericValue(hours);
  const parsedMinutes = numericValue(minutes);

  if (parsedHours === null || parsedMinutes === null) {
    return null;
  }

  return hoursAndMinutesToTotalMinutes(parsedHours, parsedMinutes);
}

function ErrorMessage({ errors }: { errors?: string[] }) {
  if (!errors?.length) {
    return null;
  }

  return <p className={`${styles.message} ${styles.error}`}>{errors[0]}</p>;
}

export function SettingsForm({ initialValues }: SettingsFormProps) {
  const initialState: SettingsActionState = {};
  const [values, setValues] = useState(initialValues);
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const [state, formAction, isPending] = useActionState(
    saveSettings,
    initialState,
  );
  const errors = Object.keys(clientErrors).length ? clientErrors : state.errors;

  function updateValue(name: keyof SettingsFormValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function validateBeforeSubmit(event: FormEvent<HTMLFormElement>) {
    const result = settingsSchema.safeParse({
      study_window_start: parseTimeOfDay(values.study_window_start),
      study_window_end: parseTimeOfDay(values.study_window_end),
      max_study_minutes_per_day: durationValue(
        values.max_study_hours,
        values.max_study_minutes,
      ),
      min_block_minutes: durationValue(
        values.min_block_hours,
        values.min_block_minutes,
      ),
      max_block_minutes: durationValue(
        values.max_block_hours,
        values.max_block_minutes,
      ),
      buffer_days: numericValue(values.buffer_days),
      timezone: "America/Los_Angeles",
      check_in_time: parseTimeOfDay(values.check_in_time),
    });

    if (!result.success) {
      event.preventDefault();
      setClientErrors(result.error.flatten().fieldErrors);
      return;
    }

    setClientErrors({});
  }

  return (
    <form
      action={formAction}
      className={styles.form}
      noValidate
      onSubmit={validateBeforeSubmit}
    >
      <div className={styles.twoColumns}>
        <label className={styles.field}>
          <span>Study window start</span>
          <input
            className={styles.input}
            name="study_window_start"
            onChange={(event) =>
              updateValue("study_window_start", event.target.value)
            }
            type="time"
            value={values.study_window_start}
          />
        </label>
        <label className={styles.field}>
          <span>Study window end</span>
          <input
            className={styles.input}
            name="study_window_end"
            onChange={(event) =>
              updateValue("study_window_end", event.target.value)
            }
            type="time"
            value={values.study_window_end}
          />
        </label>
      </div>
      <ErrorMessage errors={errors?.study_window_start} />
      <ErrorMessage errors={errors?.study_window_end} />

      <fieldset className={styles.field}>
        <legend>Maximum study time per day</legend>
        <div className={styles.duration}>
          <label className={styles.field}>
            <span>Hours</span>
            <input
              className={styles.input}
              min="0"
              name="max_study_hours"
              onChange={(event) =>
                updateValue("max_study_hours", event.target.value)
              }
              step="1"
              type="number"
              value={values.max_study_hours}
            />
          </label>
          <label className={styles.field}>
            <span>Minutes</span>
            <input
              className={styles.input}
              min="0"
              name="max_study_minutes"
              onChange={(event) =>
                updateValue("max_study_minutes", event.target.value)
              }
              step="1"
              type="number"
              value={values.max_study_minutes}
            />
          </label>
        </div>
        <ErrorMessage errors={errors?.max_study_minutes_per_day} />
      </fieldset>

      <fieldset className={styles.field}>
        <legend>Minimum block length</legend>
        <div className={styles.duration}>
          <label className={styles.field}>
            <span>Hours</span>
            <input
              className={styles.input}
              min="0"
              name="min_block_hours"
              onChange={(event) =>
                updateValue("min_block_hours", event.target.value)
              }
              step="1"
              type="number"
              value={values.min_block_hours}
            />
          </label>
          <label className={styles.field}>
            <span>Minutes</span>
            <input
              className={styles.input}
              min="0"
              name="min_block_minutes"
              onChange={(event) =>
                updateValue("min_block_minutes", event.target.value)
              }
              step="1"
              type="number"
              value={values.min_block_minutes}
            />
          </label>
        </div>
        <ErrorMessage errors={errors?.min_block_minutes} />
      </fieldset>

      <fieldset className={styles.field}>
        <legend>Maximum block length</legend>
        <div className={styles.duration}>
          <label className={styles.field}>
            <span>Hours</span>
            <input
              className={styles.input}
              min="0"
              name="max_block_hours"
              onChange={(event) =>
                updateValue("max_block_hours", event.target.value)
              }
              step="1"
              type="number"
              value={values.max_block_hours}
            />
          </label>
          <label className={styles.field}>
            <span>Minutes</span>
            <input
              className={styles.input}
              min="0"
              name="max_block_minutes"
              onChange={(event) =>
                updateValue("max_block_minutes", event.target.value)
              }
              step="1"
              type="number"
              value={values.max_block_minutes}
            />
          </label>
        </div>
        <ErrorMessage errors={errors?.max_block_minutes} />
      </fieldset>

      <div className={styles.twoColumns}><label className={styles.field}>
        <span>Buffer days before deadline</span>
        <input
          className={styles.input}
          max="7"
          min="0"
          name="buffer_days"
          onChange={(event) => updateValue("buffer_days", event.target.value)}
          step="1"
          type="number"
          value={values.buffer_days}
        />
        <ErrorMessage errors={errors?.buffer_days} />
      </label>

      <label className={styles.field}>
        <span>Check-in time</span>
        <input
          className={styles.input}
          name="check_in_time"
          onChange={(event) =>
            updateValue("check_in_time", event.target.value)
          }
          type="time"
          value={values.check_in_time}
        />
        <ErrorMessage errors={errors?.check_in_time} />
      </label></div>

      <div className={styles.field}>
        <span>Timezone</span>
        <p className={styles.readOnly}>
          America/Los_Angeles
        </p>
      </div>

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
        {isPending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
