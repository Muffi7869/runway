"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Moon } from "lucide-react";

import {
  roughDayAction,
  undoRoughDayAction,
  type RoughDayActionResult,
} from "@/app/(app)/week/rough-day-actions";
import { Button } from "@/components/ui/button";
import { PortalPopup } from "@/components/portal-popup";

export function RoughDayControls({
  initiallyActive,
}: {
  initiallyActive: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [active, setActive] = useState(initiallyActive);
  const [result, setResult] = useState<RoughDayActionResult>();
  const controlRef = useRef<HTMLElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);

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
    <section aria-label="Rough day" className="week-control" ref={controlRef}>
      <Button
        disabled={isPending}
        onClick={() =>
          run(active ? undoRoughDayAction : roughDayAction, !active)
        }
        type="button"
        variant="ghost"
      >
        <Moon aria-hidden="true" size={18} strokeWidth={1.6} />
        {isPending
          ? active
            ? "Undoing..."
            : "Planning around it..."
          : active
            ? "Undo rough day"
            : "Rough day"}
      </Button>

      <PortalPopup
        anchorRef={controlRef}
        className={`week-control__message ${result?.error ? "text-[var(--danger)]" : ""}`}
        open={Boolean(result)}
        popupRef={messageRef}
        role="status"
      >
        {result?.error ?? null}
        {result?.ok ? (
          <>
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
          </>
        ) : null}
      </PortalPopup>
    </section>
  );
}
