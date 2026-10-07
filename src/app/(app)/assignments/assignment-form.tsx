"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  createAssignmentAction,
  updateAssignmentAction,
  type AssignmentActionState,
  type AssignmentFormValues,
} from "./actions";

type AssignmentClass = {
  id: string;
  name: string;
  color: string;
};

type AssignmentFormProps = {
  classes: AssignmentClass[];
  initialValues: AssignmentFormValues;
  mode: "create" | "edit";
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-red-700">{message}</p>;
}

export function AssignmentForm({
  classes,
  initialValues,
  mode,
}: AssignmentFormProps) {
  const [values, setValues] = useState(initialValues);
  const serverAction =
    mode === "create" ? createAssignmentAction : updateAssignmentAction;
  const [state, formAction, isPending] = useActionState(
    async (previousState: AssignmentActionState, formData: FormData) => {
      const nextState = await serverAction(previousState, formData);

      if (nextState.values) {
        setValues(nextState.values);
      }

      return nextState;
    },
    { values: initialValues },
  );

  function updateValue(name: keyof AssignmentFormValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  return (
    <form action={formAction} className="mt-6 space-y-5" noValidate>
      {mode === "edit" && values.assignmentId ? (
        <input name="assignmentId" type="hidden" value={values.assignmentId} />
      ) : null}

      <label className="grid gap-1">
        <span>Class</span>
        <select
          className="rounded border px-3 py-2"
          name="classId"
          onChange={(event) => updateValue("classId", event.target.value)}
          value={values.classId}
        >
          <option value="">Choose a class</option>
          {classes.map((classRow) => (
            <option key={classRow.id} value={classRow.id}>
              {classRow.name}
            </option>
          ))}
        </select>
        <FieldError message={state.fieldErrors?.classId} />
      </label>

      <label className="grid gap-1">
        <span>Title</span>
        <input
          className="rounded border px-3 py-2"
          name="title"
          onChange={(event) => updateValue("title", event.target.value)}
          type="text"
          value={values.title}
        />
        <FieldError message={state.fieldErrors?.title} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1">
          <span>Due date</span>
          <input
            className="rounded border px-3 py-2"
            name="deadlineDate"
            onChange={(event) =>
              updateValue("deadlineDate", event.target.value)
            }
            type="date"
            value={values.deadlineDate}
          />
          <FieldError message={state.fieldErrors?.deadlineDate} />
        </label>

        <label className="grid gap-1">
          <span>Due time</span>
          <input
            className="rounded border px-3 py-2"
            name="deadlineTime"
            onChange={(event) =>
              updateValue("deadlineTime", event.target.value)
            }
            type="time"
            value={values.deadlineTime}
          />
          <FieldError message={state.fieldErrors?.deadlineTime} />
        </label>
      </div>

      <label className="grid gap-1">
        <span>Weight</span>
        <select
          className="rounded border px-3 py-2"
          name="weight"
          onChange={(event) => updateValue("weight", event.target.value)}
          value={values.weight}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <FieldError message={state.fieldErrors?.weight} />
      </label>

      <label className="grid gap-1">
        <span>Spec text</span>
        <textarea
          className="min-h-40 rounded border px-3 py-2"
          name="specText"
          onChange={(event) => updateValue("specText", event.target.value)}
          value={values.specText}
        />
        <span className="text-sm text-gray-600">
          Optional. Paste the assignment text.
        </span>
        <FieldError message={state.fieldErrors?.specText} />
      </label>

      {state.formError ? (
        <p className="text-sm text-red-700">{state.formError}</p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <Link className="rounded border px-4 py-2" href="/assignments">
          Cancel
        </Link>
      </div>
    </form>
  );
}
