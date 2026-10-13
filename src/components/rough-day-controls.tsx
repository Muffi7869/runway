"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  roughDayAction,
  undoRoughDayAction,
  type RoughDayActionResult,
} from "@/app/(app)/week/rough-day-actions";

export function RoughDayControls({
  initiallyActive,
}: {
  initiallyActive: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [active, setActive] = useState(initiallyActive);
  const [result, setResult] = useState<RoughDayActionResult>();

  function run(action: () => Promise<RoughDayActionResult>, next: boolean) {
    setResult(undefined);
    startTransition(async () => {
      try {
        const response = await action();
        setResult(response);

        if (response.ok) {
          setActive(next);
          router.refresh();
        }
      } catch {
        setResult({ error: "Couldn't update the day. Try again." });
      }
    });
  }

  return (
    <section aria-label="Rough day" className="space-y-3">
      <button
        className="rounded border border-black px-4 py-2 disabled:opacity-50"
        disabled={isPending}
        onClick={() =>
          run(active ? undoRoughDayAction : roughDayAction, !active)
        }
        type="button"
      >
        {isPending
          ? active
            ? "Undoing..."
            : "Planning around it..."
          : active
            ? "Undo rough day"
            : "Rough day"}
      </button>

      {result?.error ? <p className="text-sm text-red-700">{result.error}</p> : null}
      {result?.ok ? (
        <div className="space-y-1 text-sm" role="status">
          {result.text ? <p>{result.text}</p> : null}
          {result.warnings?.map((warning) => <p key={warning}>{warning}</p>)}
          {result.note ? <p>{result.note}</p> : null}
          <div className="flex flex-wrap gap-3">
            {active ? (
              <button
                className="underline disabled:opacity-50"
                disabled={isPending}
                onClick={() => run(undoRoughDayAction, false)}
                type="button"
              >
                Undo
              </button>
            ) : null}
            <button
              className="underline"
              onClick={() => setResult(undefined)}
              type="button"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
