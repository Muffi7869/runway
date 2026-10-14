"use client";

import { useActionState, useState } from "react";

import {
  CLASS_COLOR_PALETTE,
  type ClassColor,
} from "@/lib/classes/palette";
import { describePace } from "@/lib/pace/compute";

import {
  addClass,
  updateClass,
  type ClassActionState,
} from "./actions";

type ClassRow = {
  id: string;
  name: string;
  color: string;
  pace_ratio: number;
};

function ColorPicker({
  name,
  selectedColor,
  onChange,
}: {
  name: string;
  selectedColor: string;
  onChange: (color: ClassColor) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend>Color</legend>
      <div className="flex flex-wrap gap-3">
        {CLASS_COLOR_PALETTE.map((color) => (
          <label className="cursor-pointer" key={color.key}>
            <input
              aria-label={color.label}
              checked={selectedColor === color.key}
              className="sr-only"
              name={name}
              onChange={() => onChange(color.key)}
              type="radio"
              value={color.key}
            />
            <span
              aria-hidden="true"
              className={`block size-8 rounded-full border-2 ${
                selectedColor === color.key
                  ? "border-[var(--accent)] ring-2 ring-[var(--accent)] ring-offset-2"
                  : "border-transparent"
              }`}
              style={{ backgroundColor: color.value }}
            />
            <span className="sr-only">{color.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ActionMessage({ state }: { state: ClassActionState }) {
  if (state.error) {
    return <p className="text-sm text-[var(--danger)]">{state.error}</p>;
  }

  if (state.successMessage) {
    return <p className="text-sm text-[var(--ok)]">{state.successMessage}</p>;
  }

  return null;
}

function AddClassForm() {
  const [name, setName] = useState("");
  const [color, setColor] = useState<ClassColor | "">("");
  const [state, formAction, isPending] = useActionState(
    async (previousState: ClassActionState, formData: FormData) => {
      const nextState = await addClass(previousState, formData);

      if (nextState.successMessage) {
        setName("");
        setColor("");
      }

      return nextState;
    },
    {},
  );

  return (
    <form action={formAction} className="mt-6 space-y-4 rounded border p-4">
      <h2 className="text-lg font-semibold">Add class</h2>
      <label className="grid gap-1">
        <span>Name</span>
        <input
          className="rounded border px-3 py-2"
          name="name"
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
      </label>
      <ColorPicker name="color" onChange={setColor} selectedColor={color} />
      <ActionMessage state={state} />
      <button
        className="ui-button ui-button--primary"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Adding…" : "Add class"}
      </button>
    </form>
  );
}

function ExistingClassForm({ classRow }: { classRow: ClassRow }) {
  const [name, setName] = useState(classRow.name);
  const [color, setColor] = useState(classRow.color);
  const [state, formAction, isPending] = useActionState(updateClass, {});
  const displayedColor = CLASS_COLOR_PALETTE.find(
    (paletteColor) => paletteColor.key === classRow.color,
  );

  return (
    <form action={formAction} className="space-y-4 rounded border p-4">
      <input name="class_id" type="hidden" value={classRow.id} />
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="block size-5 rounded-full"
          style={{
            backgroundColor: displayedColor?.value ?? "var(--ink-3)",
          }}
        />
        <div>
          <p className="font-medium">{classRow.name}</p>
          <p className="text-sm">
            {describePace(Number(classRow.pace_ratio))}
          </p>
        </div>
      </div>
      <label className="grid gap-1">
        <span>Name</span>
        <input
          className="rounded border px-3 py-2"
          name="name"
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
      </label>
      <ColorPicker
        name="color"
        onChange={setColor}
        selectedColor={color}
      />
      <ActionMessage state={state} />
      <button
        className="rounded border px-4 py-2 disabled:opacity-50"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

export function ClassesManager({ classes }: { classes: ClassRow[] }) {
  return (
    <>
      <AddClassForm />
      <section className="mt-8 space-y-4" aria-labelledby="saved-classes">
        <h2 className="text-lg font-semibold" id="saved-classes">
          Saved classes
        </h2>
        {classes.length ? (
          classes.map((classRow) => (
            <ExistingClassForm classRow={classRow} key={classRow.id} />
          ))
        ) : (
          <p>No classes added yet.</p>
        )}
      </section>
    </>
  );
}
