"use client";

import {
  useActionState,
  useState,
  useTransition,
} from "react";

import { describeSkipped } from "@/lib/canvas/skipped";
import {
  freshRowAvailability,
  type CanvasPreview,
  type CanvasPreviewChangedRow,
} from "@/lib/canvas/preview";

import {
  importCanvasAction,
  previewCanvasAction,
  updateCanvasDueDateAction,
  type CanvasImportSummary,
  type CanvasUpdateActionState,
} from "../canvas-actions";
import styles from "./canvas-import.module.css";

type RowChoice = {
  classId: string;
  time: string;
  checked: boolean;
};

function importSummaryText(summary: CanvasImportSummary): string {
  const parts = [
    `Imported ${summary.imported}.`,
    `${summary.alreadyThere} already there.`,
  ];

  if (summary.failed.length) {
    parts.push(
      `${summary.failed.length} failed: ${summary.failed
        .map((failure) => failure.message)
        .join(" ")}`,
    );
  }

  return parts.join(" ");
}

function ChangedRow({
  row,
  refreshPreview,
}: {
  row: CanvasPreviewChangedRow;
  refreshPreview: () => Promise<void>;
}) {
  const [state, formAction, isPending] = useActionState(
    async (previousState: CanvasUpdateActionState, formData: FormData) => {
      const result = await updateCanvasDueDateAction(previousState, formData);

      if (result.ok) {
        await refreshPreview();
      }

      return result;
    },
    {},
  );

  return (
    <article className={styles.row}>
      <div className={styles.rowContent}>
        <h3>{row.title}</h3>
        <p>Old due: {row.oldDeadlineLabel}</p>
        <p>New due: {row.newLabel}</p>
      </div>
      <form action={formAction} className={styles.rowAction}>
        <input name="uid" type="hidden" value={row.uid} />
        <button disabled={isPending} type="submit">
          {isPending ? "Updating..." : "Update"}
        </button>
        {state.error ? <p className={styles.error}>{state.error}</p> : null}
      </form>
    </article>
  );
}

export function CanvasImport() {
  const [preview, setPreview] = useState<CanvasPreview>();
  const [choices, setChoices] = useState<Record<string, RowChoice>>({});
  const [previewError, setPreviewError] = useState<string>();
  const [importError, setImportError] = useState<string>();
  const [summary, setSummary] = useState<CanvasImportSummary>();
  const [isFetching, startFetchTransition] = useTransition();
  const [isImporting, startImportTransition] = useTransition();

  async function refreshPreview() {
    const result = await previewCanvasAction();

    if (!result.ok) {
      setPreviewError(result.error);
      return;
    }

    const now = new Date();
    const nextChoices: Record<string, RowChoice> = {};

    for (const row of result.preview.fresh) {
      const classId = row.preselectedClassId ?? "";
      const time = row.defaultTime ?? "00:00";
      nextChoices[row.uid] = {
        classId,
        time,
        checked: freshRowAvailability(row, classId, time, now).importable,
      };
    }

    setPreview(result.preview);
    setChoices(nextChoices);
    setPreviewError(undefined);
  }

  function fetchPreview() {
    setSummary(undefined);
    setImportError(undefined);
    startFetchTransition(async () => {
      await refreshPreview();
    });
  }

  function updateChoice(uid: string, update: Partial<RowChoice>) {
    setChoices((current) => ({
      ...current,
      [uid]: { ...current[uid], ...update },
    }));
  }

  const selectedRows =
    preview?.fresh.flatMap((row) => {
      const choice = choices[row.uid];

      if (!choice?.checked) {
        return [];
      }

      const availability = freshRowAvailability(
        row,
        choice.classId,
        choice.time,
        new Date(),
      );

      return availability.importable
        ? [{ uid: row.uid, classId: choice.classId, time: choice.time }]
        : [];
    }) ?? [];

  function importSelected() {
    const formData = new FormData();
    formData.set("rows", JSON.stringify(selectedRows));
    setImportError(undefined);
    startImportTransition(async () => {
      const result = await importCanvasAction({}, formData);

      if (result.error) {
        setImportError(result.error);
        return;
      }

      if (result.summary) {
        setSummary(result.summary);
        await refreshPreview();
      }
    });
  }

  const skippedLine = preview ? describeSkipped(preview.skipped) : null;

  return (
    <div className={styles.flow}>
      <button
        className={styles.primaryButton}
        disabled={isFetching}
        onClick={fetchPreview}
        type="button"
      >
        {isFetching ? "Fetching..." : "Fetch from Canvas"}
      </button>
      {previewError ? <p className={styles.error}>{previewError}</p> : null}

      {preview ? (
        <>
          <p className={styles.counts}>
            New: {preview.fresh.length}. Due date changed: {preview.changed.length}.
            Already imported: {preview.already.length}.
          </p>
          {skippedLine ? <p className={styles.skipped}>{skippedLine}</p> : null}

          <section className={styles.section}>
            <h2>New ({preview.fresh.length})</h2>
            {preview.fresh.length ? (
              <div className={styles.list}>
                {preview.fresh.map((row) => {
                  const choice = choices[row.uid] ?? {
                    classId: "",
                    time: row.defaultTime ?? "00:00",
                    checked: false,
                  };
                  const availability = freshRowAvailability(
                    row,
                    choice.classId,
                    choice.time,
                    new Date(),
                  );

                  return (
                    <article className={styles.row} key={row.uid}>
                      <label className={styles.checkboxLabel}>
                        <input
                          checked={choice.checked && availability.importable}
                          disabled={!availability.importable}
                          onChange={(event) =>
                            updateChoice(row.uid, {
                              checked: event.target.checked,
                            })
                          }
                          type="checkbox"
                        />
                        <span>Select</span>
                      </label>
                      <div className={styles.rowContent}>
                        <div className={styles.titleLine}>
                          <h3>{row.title}</h3>
                          <span className={styles.tag}>Needs spec</span>
                        </div>
                        <label className={styles.field}>
                          <span>Class</span>
                          <select
                            onChange={(event) => {
                              const classId = event.target.value;
                              const canImport = freshRowAvailability(
                                row,
                                classId,
                                choice.time,
                                new Date(),
                              ).importable;
                              updateChoice(row.uid, {
                                classId,
                                checked: canImport,
                              });
                            }}
                            value={choice.classId}
                          >
                            <option value="">Choose class</option>
                            {preview.classes.map((classRow) => (
                              <option key={classRow.id} value={classRow.id}>
                                {classRow.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        {row.isDateOnly ? (
                          <div className={styles.dueFields}>
                            <span>Due {row.dueLabel}</span>
                            <span className={styles.tag}>Time not in feed</span>
                            <label className={styles.field}>
                              <span>Due time</span>
                              <input
                                onChange={(event) => {
                                  const time = event.target.value;
                                  const canImport = freshRowAvailability(
                                    row,
                                    choice.classId,
                                    time,
                                    new Date(),
                                  ).importable;
                                  updateChoice(row.uid, {
                                    time,
                                    checked: choice.checked && canImport,
                                  });
                                }}
                                type="time"
                                value={choice.time}
                              />
                            </label>
                          </div>
                        ) : (
                          <p>Due {row.dueLabel}</p>
                        )}
                        {!availability.importable ? (
                          <p className={styles.note}>{availability.message}</p>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p>No new assignments.</p>
            )}
            <button
              className={styles.primaryButton}
              disabled={selectedRows.length === 0 || isImporting}
              onClick={importSelected}
              type="button"
            >
              {isImporting
                ? "Importing..."
                : `Import selected (${selectedRows.length})`}
            </button>
            {importError ? <p className={styles.error}>{importError}</p> : null}
            {summary ? (
              <p className={styles.success}>{importSummaryText(summary)}</p>
            ) : null}
          </section>

          <section className={styles.section}>
            <h2>Due date changed ({preview.changed.length})</h2>
            {preview.changed.length ? (
              <div className={styles.list}>
                {preview.changed.map((row) => (
                  <ChangedRow
                    key={row.uid}
                    refreshPreview={refreshPreview}
                    row={row}
                  />
                ))}
              </div>
            ) : (
              <p>No due-date changes.</p>
            )}
          </section>

          <details className={styles.details}>
            <summary>Already imported ({preview.already.length})</summary>
            {preview.already.length ? (
              <div className={styles.list}>
                {preview.already.map((row, index) => (
                  <article className={styles.row} key={`${row.title}-${index}`}>
                    <div className={styles.rowContent}>
                      <h3>{row.title}</h3>
                      <p>Status: {row.status}</p>
                      <p>Due {row.label}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p>No previously imported assignments.</p>
            )}
          </details>
        </>
      ) : null}
    </div>
  );
}
