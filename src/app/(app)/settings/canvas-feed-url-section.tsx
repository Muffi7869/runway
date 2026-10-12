"use client";

import { useActionState, useState, type FormEvent } from "react";

import {
  removeCanvasUrlAction,
  saveCanvasUrlAction,
  type CanvasUrlActionState,
} from "./canvas-actions";

export function CanvasFeedUrlSection({
  hasSavedUrl,
}: {
  hasSavedUrl: boolean;
}) {
  const [canvasUrl, setCanvasUrl] = useState("");
  const [replacing, setReplacing] = useState(false);
  const [savedLocally, setSavedLocally] = useState(false);
  const [removedLocally, setRemovedLocally] = useState(false);
  const [saveState, saveAction, isSaving] = useActionState(
    async (previousState: CanvasUrlActionState, formData: FormData) => {
      const result = await saveCanvasUrlAction(previousState, formData);

      if (result.ok) {
        setCanvasUrl("");
        setReplacing(false);
        setSavedLocally(true);
        setRemovedLocally(false);
      }

      return result;
    },
    {},
  );
  const [removeState, removeAction, isRemoving] = useActionState(
    async (previousState: CanvasUrlActionState, formData: FormData) => {
      const result = await removeCanvasUrlAction(previousState, formData);

      if (result.ok) {
        setCanvasUrl("");
        setReplacing(false);
        setSavedLocally(false);
        setRemovedLocally(true);
      }

      return result;
    },
    {},
  );
  const isSaved = (hasSavedUrl || savedLocally) && !removedLocally;
  const showInput = !isSaved || replacing;

  function confirmRemoval(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm("Remove the saved Canvas calendar link?")) {
      event.preventDefault();
    }
  }

  return (
    <section className="mt-10 border-t pt-6">
      <h2 className="text-xl font-semibold">Canvas calendar link</h2>
      {isSaved && !replacing ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span>Saved ••••</span>
          <button
            className="rounded border px-3 py-2"
            onClick={() => {
              setCanvasUrl("");
              setReplacing(true);
            }}
            type="button"
          >
            Replace
          </button>
          <form action={removeAction} onSubmit={confirmRemoval}>
            <button
              className="rounded border px-3 py-2 disabled:opacity-50"
              disabled={isRemoving}
              type="submit"
            >
              {isRemoving ? "Removing…" : "Remove"}
            </button>
          </form>
        </div>
      ) : null}

      {showInput ? (
        <form action={saveAction} className="mt-3 space-y-3">
          <label className="grid gap-1">
            <span>Canvas calendar feed link</span>
            <input
              autoComplete="off"
              className="w-full rounded border px-3 py-2"
              name="canvasUrl"
              onChange={(event) => setCanvasUrl(event.target.value)}
              type="password"
              value={canvasUrl}
            />
          </label>
          <p className="text-sm text-neutral-600">
            Copy it from Canvas under Calendar, Calendar Feed.
          </p>
          <button
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </form>
      ) : null}

      {saveState.error ? (
        <p className="mt-3 text-sm text-red-700">{saveState.error}</p>
      ) : null}
      {removeState.error ? (
        <p className="mt-3 text-sm text-red-700">{removeState.error}</p>
      ) : null}
      {saveState.ok ? (
        <p className="mt-3 text-sm text-green-700">Canvas link saved.</p>
      ) : null}
      {removeState.ok ? (
        <p className="mt-3 text-sm text-green-700">Canvas link removed.</p>
      ) : null}
    </section>
  );
}
