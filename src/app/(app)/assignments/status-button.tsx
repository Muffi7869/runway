"use client";

import { useActionState, type Ref } from "react";

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
  buttonRef,
  kind,
  menuItem = false,
}: {
  assignmentId: string;
  buttonRef?: Ref<HTMLButtonElement>;
  kind: StatusActionKind;
  menuItem?: boolean;
}) {
  const [state, formAction, isPending] = useActionState<
    AssignmentStatusActionState,
    FormData
  >(statusActions[kind], {});

  return (
    <form action={formAction} className={menuItem ? styles.menuStatusForm : styles.statusForm}>
      <input name="assignmentId" type="hidden" value={assignmentId} />
      <button
        className={menuItem ? styles.menuItem : styles.statusButton}
        disabled={isPending}
        ref={buttonRef}
        role={menuItem ? "menuitem" : undefined}
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
