"use client";

import { useActionState } from "react";

import { formatEstimate } from "@/lib/assignments/helpers";

import {
  generateBreakdownAction,
  type BreakdownActionState,
} from "../../breakdown-actions";
import styles from "./breakdown.module.css";

export function BreakdownButton({ assignmentId }: { assignmentId: string }) {
  const [state, formAction, isPending] = useActionState<
    BreakdownActionState,
    FormData
  >(generateBreakdownAction, {});

  if (state.ok) {
    const totalMinutes = state.steps.reduce(
      (total, step) => total + step.estimatedMinutes,
      0,
    );

    return (
      <section aria-labelledby="draft-steps" className={styles.results}>
        <h2 className={styles.subheading} id="draft-steps">
          Draft steps
        </h2>
        <ol className={styles.stepList}>
          {state.steps.map((step, index) => (
            <li className={styles.step} key={`${index}-${step.name}`}>
              <span>{step.name}</span>
              <span className={styles.minutes}>
                {formatEstimate(step.estimatedMinutes)}
              </span>
            </li>
          ))}
        </ol>
        <p className={styles.total}>Total: {formatEstimate(totalMinutes)}</p>
        <p>Draft only. Nothing is saved yet.</p>
        {state.specWasCut ? (
          <p>Only the first 30,000 characters of the spec were used.</p>
        ) : null}
      </section>
    );
  }

  return (
    <form action={formAction} className={styles.actionForm}>
      <input name="assignmentId" type="hidden" value={assignmentId} />
      <button
        className={styles.button}
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Breaking it down..." : "Break it down"}
      </button>
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
