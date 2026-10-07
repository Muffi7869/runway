"use client";

import { useActionState } from "react";

import {
  dropAction,
  markDoneAction,
  restoreAction,
  type AssignmentStatusActionState,
} from "./actions";
import styles from "./assignments.module.css";

type StatusActionKind = "done" | "drop" | "restore";

const statusActions = {
  done: markDoneAction,
  drop: dropAction,
  restore: restoreAction,
};

const labels = {
  done: "Done",
  drop: "Drop",
  restore: "Restore",
};

export function AssignmentStatusButton({
  assignmentId,
  kind,
}: {
  assignmentId: string;
  kind: StatusActionKind;
}) {
  const [state, formAction, isPending] = useActionState<
    AssignmentStatusActionState,
    FormData
  >(statusActions[kind], {});

  return (
    <form action={formAction} className={styles.statusForm}>
      <input name="assignmentId" type="hidden" value={assignmentId} />
      <button
        className={styles.statusButton}
        disabled={isPending}
        type="submit"
      >
        {isPending ? `${labels[kind]}…` : labels[kind]}
      </button>
      {state.error ? (
        <span className={styles.actionError}>{state.error}</span>
      ) : null}
    </form>
  );
}
