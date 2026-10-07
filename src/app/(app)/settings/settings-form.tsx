"use client";

import { useActionState, useState, type FormEvent } from "react";

import {
  hoursAndMinutesToTotalMinutes,
  parseTimeOfDay,
  settingsSchema,
  type SettingsInput,
} from "@/lib/settings/schema";

import { saveSettings, type SettingsActionState } from "./actions";

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
  hasSavedCanvasUrl: boolean;
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

  return <p className="text-sm text-red-700">{errors[0]}</p>;
}

export function SettingsForm({
  initialValues,
  hasSavedCanvasUrl,
}: SettingsFormProps) {
  const initialState: SettingsActionState = { hasSavedCanvasUrl };
  const [values, setValues] = useState(initialValues);
  const [canvasFeedUrl, setCanvasFeedUrl] = useState("");
  const [replacingCanvasUrl, setReplacingCanvasUrl] = useState(false);
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const [state, formAction, isPending] = useActionState(
    async (previousState: SettingsActionState, formData: FormData) => {
      const nextState = await saveSettings(previousState, formData);

      if (nextState.successMessage) {
        setCanvasFeedUrl("");
        setReplacingCanvasUrl(false);
      }

      return nextState;
    },
    initialState,
  );
  const canvasUrlIsSaved = state.hasSavedCanvasUrl;
  const showCanvasInput = !canvasUrlIsSaved || replacingCanvasUrl;
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
      canvas_feed_url: canvasFeedUrl.trim(),
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
      className="mt-6 space-y-6"
      noValidate
      onSubmit={validateBeforeSubmit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1">
          <span>Study window start</span>
          <input
            className="rounded border px-3 py-2"
            name="study_window_start"
            onChange={(event) =>
              updateValue("study_window_start", event.target.value)
            }
            type="time"
            value={values.study_window_start}
          />
        </label>
        <label className="grid gap-1">
          <span>Study window end</span>
          <input
            className="rounded border px-3 py-2"
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

      <fieldset className="space-y-2">
        <legend>Maximum study time per day</legend>
        <div className="grid grid-cols-2 gap-4">
          <label className="grid gap-1">
            <span>Hours</span>
            <input
              className="rounded border px-3 py-2"
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
          <label className="grid gap-1">
            <span>Minutes</span>
            <input
              className="rounded border px-3 py-2"
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

      <fieldset className="space-y-2">
        <legend>Minimum block length</legend>
        <div className="grid grid-cols-2 gap-4">
          <label className="grid gap-1">
            <span>Hours</span>
            <input
              className="rounded border px-3 py-2"
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
          <label className="grid gap-1">
            <span>Minutes</span>
            <input
              className="rounded border px-3 py-2"
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

      <fieldset className="space-y-2">
        <legend>Maximum block length</legend>
        <div className="grid grid-cols-2 gap-4">
          <label className="grid gap-1">
            <span>Hours</span>
            <input
              className="rounded border px-3 py-2"
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
          <label className="grid gap-1">
            <span>Minutes</span>
            <input
              className="rounded border px-3 py-2"
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

      <label className="grid gap-1">
        <span>Buffer days before deadline</span>
        <input
          className="rounded border px-3 py-2"
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

      <label className="grid gap-1">
        <span>Check-in time</span>
        <input
          className="rounded border px-3 py-2"
          name="check_in_time"
          onChange={(event) =>
            updateValue("check_in_time", event.target.value)
          }
          type="time"
          value={values.check_in_time}
        />
        <ErrorMessage errors={errors?.check_in_time} />
      </label>

      <div className="grid gap-1">
        <span>Timezone</span>
        <p className="rounded border bg-neutral-50 px-3 py-2">
          America/Los_Angeles
        </p>
      </div>

      <div className="space-y-2">
        <span className="block">Canvas feed URL</span>
        {canvasUrlIsSaved && !replacingCanvasUrl ? (
          <div className="flex items-center gap-3">
            <span>Saved ••••</span>
            <button
              className="rounded border px-3 py-2"
              onClick={() => {
                setCanvasFeedUrl("");
                setReplacingCanvasUrl(true);
              }}
              type="button"
            >
              Replace
            </button>
          </div>
        ) : null}
        {showCanvasInput ? (
          <input
            autoComplete="off"
            className="w-full rounded border px-3 py-2"
            name="canvas_feed_url"
            onChange={(event) => setCanvasFeedUrl(event.target.value)}
            type="url"
            value={canvasFeedUrl}
          />
        ) : null}
        <ErrorMessage errors={errors?.canvas_feed_url} />
      </div>

      {state.formError ? (
        <p className="text-sm text-red-700">{state.formError}</p>
      ) : null}
      {state.successMessage ? (
        <p className="text-sm text-green-700">{state.successMessage}</p>
      ) : null}

      <button
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
