"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { replanAction } from "@/app/(app)/week/actions";
import { formatLastSynced } from "@/lib/week/view";
import { Button } from "@/components/ui/button";

export function ReplanControls({
  lastPlannedAt,
  now,
}: {
  lastPlannedAt: string | null;
  now: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();

  function runReplan() {
    setMessage(undefined);
    startTransition(async () => {
      try {
        const result = await replanAction();

        if (!result.ok) {
          setMessage(result.error);
          return;
        }

        if (result.mirrorFailed) {
          setMessage(
            "Couldn't update Google Calendar, will retry on next replan.",
          );
        } else if (result.mirrorNeedsReconnect) {
          setMessage("Reconnect Google Calendar in Settings.");
        } else {
          setMessage(
            result.syncFailed
              ? "Plan updated using saved calendar events. Calendar sync needs attention."
              : "Plan updated.",
          );
        }
        router.refresh();
      } catch {
        setMessage("Couldn't update the plan. Try again.");
      }
    });
  }

  return (
    <section className="space-y-3" aria-label="Study plan">
      <p>
        Last planned: {lastPlannedAt ? formatLastSynced(lastPlannedAt, new Date(now)) : "Never planned"}
      </p>
      <Button
        disabled={isPending}
        onClick={runReplan}
        type="button"
        variant="default"
      >
        {isPending ? "Replanning..." : "Replan"}
      </Button>
      {message ? <p>{message}</p> : null}
    </section>
  );
}
