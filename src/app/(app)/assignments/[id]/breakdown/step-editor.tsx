"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from "react";

import {
  addStep,
  fromDraft,
  hasProgress,
  moveStep,
  nudgeMinutes,
  removeStep,
  renameStep,
  setMinutes,
  sumMinutes,
  toSavePayload,
  validateEditorSteps,
  type EditorStep,
  type EditorValidationResult,
} from "@/lib/steps/editor";
import { MAX_EDITOR_STEPS, STEP_LOGGED_WORK_MESSAGE } from "@/lib/steps/limits";
import { describeTotals } from "@/lib/steps/totals";

import {
  generateBreakdownAction,
  type BreakdownActionState,
} from "../../breakdown-actions";
import {
  saveStepsAction,
  type SaveStepsActionState,
} from "../../steps-actions";
import styles from "./breakdown.module.css";

const emptyBreakdownState: BreakdownActionState = {};
const emptySaveState: SaveStepsActionState = {};

export function StepEditor({
  assignmentId,
  initialAiTotal,
  initialSteps,
}: {
  assignmentId: string;
  initialAiTotal: number | null;
  initialSteps: EditorStep[];
}) {
  const initialPayload = useMemo(
    () => JSON.stringify(toSavePayload(initialSteps)),
    [initialSteps],
  );
  const regenerationLocked = useMemo(
    () => hasProgress(initialSteps),
    [initialSteps],
  );
  const [steps, setSteps] = useState(initialSteps);
  const [validation, setValidation] = useState<EditorValidationResult | null>(
    null,
  );
  const [editorError, setEditorError] = useState<string>();
  const [breakdownError, setBreakdownError] = useState<string>();
  const [specWasCut, setSpecWasCut] = useState(false);
  const [aiDraftTotal, setAiDraftTotal] = useState<number | null>(null);
  const [isGenerating, startGeneration] = useTransition();
  const [saveState, saveAction, isSaving] = useActionState<
    SaveStepsActionState,
    FormData
  >(saveStepsAction, emptySaveState);
  const dirty =
    JSON.stringify(toSavePayload(steps)) !== initialPayload ||
    aiDraftTotal !== null;
  const isBusy = isGenerating || isSaving;
  const fieldErrors = validation && !validation.ok ? validation.stepErrors : {};
  const listError = validation && !validation.ok ? validation.listError : undefined;

  useEffect(() => {
    if (!dirty) {
      return;
    }

    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [dirty]);

  function updateSteps(nextSteps: EditorStep[]) {
    setSteps(nextSteps);
    setEditorError(undefined);

    if (validation) {
      setValidation(validateEditorSteps(nextSteps));
    }
  }

  function handleDelete(key: string) {
    const result = removeStep(steps, key);

    if (!result.ok) {
      setEditorError(result.error);
      return;
    }

    updateSteps(result.steps);
  }

  function handleGenerate() {
    if (
      (dirty || initialSteps.length > 0) &&
      !window.confirm("Replace the current steps with a new AI draft?")
    ) {
      return;
    }

    const formData = new FormData();
    formData.set("assignmentId", assignmentId);
    setBreakdownError(undefined);

    startGeneration(async () => {
      const result = await generateBreakdownAction(
        emptyBreakdownState,
        formData,
      );

      if (!result.ok) {
        setBreakdownError(result.error);
        return;
      }

      setSteps(fromDraft(result.steps));
      setAiDraftTotal(result.aiTotalMinutes);
      setSpecWasCut(result.specWasCut);
      setValidation(null);
      setEditorError(undefined);
    });
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    const result = validateEditorSteps(steps);
    setValidation(result);

    if (!result.ok) {
      event.preventDefault();
    }
  }

  return (
    <section className={styles.editor} aria-labelledby="steps-heading">
      <div className={styles.editorHeadingRow}>
        <h2 className={styles.subheading} id="steps-heading">
          Steps
        </h2>
        {dirty ? <span className={styles.unsaved}>Unsaved changes</span> : null}
      </div>

      {steps.length > 0 ? (
        <ol className={styles.stepList}>
          {steps.map((step, index) => (
            <li className={styles.stepCard} key={step.key}>
              <div className={styles.field}>
                <label htmlFor={`step-name-${step.key}`}>
                  Step {index + 1}
                </label>
                <input
                  className={styles.textInput}
                  disabled={isBusy}
                  id={`step-name-${step.key}`}
                  onChange={(event) =>
                    updateSteps(renameStep(steps, step.key, event.target.value))
                  }
                  type="text"
                  value={step.name}
                />
                {fieldErrors[step.key]?.name ? (
                  <p className={styles.error}>{fieldErrors[step.key].name}</p>
                ) : null}
              </div>

              <div className={styles.minutesField}>
                <label htmlFor={`step-minutes-${step.key}`}>Minutes</label>
                <div className={styles.minutesControls}>
                  <button
                    className={styles.smallButton}
                    disabled={isBusy}
                    onClick={() =>
                      updateSteps(nudgeMinutes(steps, step.key, -1))
                    }
                    type="button"
                  >
                    −
                  </button>
                  <input
                    className={styles.numberInput}
                    disabled={isBusy}
                    id={`step-minutes-${step.key}`}
                    max={600}
                    min={15}
                    onChange={(event) =>
                      updateSteps(
                        setMinutes(steps, step.key, event.target.valueAsNumber),
                      )
                    }
                    step={5}
                    type="number"
                    value={Number.isFinite(step.minutes) ? step.minutes : ""}
                  />
                  <button
                    className={styles.smallButton}
                    disabled={isBusy}
                    onClick={() =>
                      updateSteps(nudgeMinutes(steps, step.key, 1))
                    }
                    type="button"
                  >
                    +
                  </button>
                </div>
                {fieldErrors[step.key]?.minutes ? (
                  <p className={styles.error}>{fieldErrors[step.key].minutes}</p>
                ) : null}
              </div>

              <div className={styles.rowActions}>
                <button
                  className={styles.smallButton}
                  disabled={isBusy || index === 0}
                  onClick={() =>
                    updateSteps(moveStep(steps, step.key, "up"))
                  }
                  type="button"
                >
                  Up
                </button>
                <button
                  className={styles.smallButton}
                  disabled={isBusy || index === steps.length - 1}
                  onClick={() =>
                    updateSteps(moveStep(steps, step.key, "down"))
                  }
                  type="button"
                >
                  Down
                </button>
                <button
                  className={styles.smallButton}
                  disabled={isBusy || step.hasLoggedWork}
                  onClick={() => handleDelete(step.key)}
                  type="button"
                >
                  Delete
                </button>
              </div>

              {step.percentDone > 0 ? (
                <p className={styles.readOnly}>Progress: {step.percentDone}%</p>
              ) : null}
              {step.hasLoggedWork ? (
                <p className={styles.readOnly}>{STEP_LOGGED_WORK_MESSAGE}</p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p>No steps yet.</p>
      )}

      {listError ? <p className={styles.error}>{listError}</p> : null}
      {editorError ? <p className={styles.error}>{editorError}</p> : null}

      <p className={styles.total}>
        {describeTotals({
          aiTotal: aiDraftTotal ?? initialAiTotal,
          currentTotal: sumMinutes(steps),
        })}
      </p>

      <div className={styles.controls}>
        {steps.length === 0 ? (
          <button
            className={styles.secondaryButton}
            disabled={isBusy}
            onClick={() => updateSteps(addStep(steps))}
            type="button"
          >
            Add steps by hand
          </button>
        ) : (
          <button
            className={styles.secondaryButton}
            disabled={isBusy || steps.length >= MAX_EDITOR_STEPS}
            onClick={() => updateSteps(addStep(steps))}
            type="button"
          >
            Add step
          </button>
        )}

        <button
          className={styles.secondaryButton}
          disabled={isBusy || regenerationLocked}
          onClick={handleGenerate}
          type="button"
        >
          {isGenerating
            ? "Breaking it down..."
            : steps.length > 0
              ? "Regenerate"
              : "Break it down"}
        </button>
      </div>

      {regenerationLocked ? (
        <p className={styles.readOnly}>
          This breakdown has progress, so it can&apos;t be regenerated.
        </p>
      ) : null}
      {breakdownError ? (
        <p className={styles.error} role="alert">
          {breakdownError}
        </p>
      ) : null}
      {specWasCut ? (
        <p>Only the first 30,000 characters of the spec were used.</p>
      ) : null}

      <form action={saveAction} className={styles.saveForm} onSubmit={handleSave}>
        <input name="assignmentId" type="hidden" value={assignmentId} />
        <input
          name="steps"
          type="hidden"
          value={JSON.stringify(toSavePayload(steps))}
        />
        <input
          name="aiTotal"
          type="hidden"
          value={aiDraftTotal === null ? "" : String(aiDraftTotal)}
        />
        <button className={styles.primaryButton} disabled={isBusy} type="submit">
          {isSaving ? "Saving..." : "Save"}
        </button>
        <Link className={styles.cancelLink} href="/assignments">
          Cancel
        </Link>
      </form>

      {saveState.error ? (
        <p className={styles.error} role="alert">
          {saveState.error}
        </p>
      ) : null}
    </section>
  );
}
