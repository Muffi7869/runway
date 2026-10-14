"use client";

import { useActionState, useState, type FormEvent } from "react";

import {
  removeCanvasUrlAction,
  saveCanvasUrlAction,
  type CanvasUrlActionState,
} from "./canvas-actions";
import styles from "./settings.module.css";

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
    <section className={styles.card}>
      <div className={styles.cardHeader}><div><h2>Canvas calendar link</h2><p>Import assignment deadlines without showing the saved link.</p></div></div>
      {isSaved && !replacing ? (
        <div className={styles.savedRow}>
          <span className={styles.savedPill}>Saved ••••</span>
          <button
            className="ui-button"
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
              className="ui-button"
              disabled={isRemoving}
              type="submit"
            >
              {isRemoving ? "Removing…" : "Remove"}
            </button>
          </form>
        </div>
      ) : null}

      {showInput ? (
        <form action={saveAction} className={styles.form}>
          <label className={styles.field}>
            <span>Canvas calendar feed link</span>
            <input
              autoComplete="off"
              className={styles.input}
              name="canvasUrl"
              onChange={(event) => setCanvasUrl(event.target.value)}
              type="password"
              value={canvasUrl}
            />
          </label>
          <p className={styles.hint}>
            Copy it from Canvas under Calendar, Calendar Feed.
          </p>
          <button
            className="ui-button ui-button--primary"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </form>
      ) : null}

      {saveState.error ? (
        <p className={`${styles.message} ${styles.error}`}>{saveState.error}</p>
      ) : null}
      {removeState.error ? (
        <p className={`${styles.message} ${styles.error}`}>{removeState.error}</p>
      ) : null}
      {saveState.ok ? (
        <p className={`${styles.message} ${styles.success}`}>Canvas link saved.</p>
      ) : null}
      {removeState.ok ? (
        <p className={`${styles.message} ${styles.success}`}>Canvas link removed.</p>
      ) : null}
    </section>
  );
}
