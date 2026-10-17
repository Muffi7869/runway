"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { replanAction } from "@/app/(app)/week/actions";
import { formatLastSynced } from "@/lib/week/view";
import { Button } from "@/components/ui/button";
import { PortalPopup } from "@/components/portal-popup";

export function ReplanControls({
  lastPlannedAt,
  now,
  showStatus = true,
}: {
  lastPlannedAt: string | null;
  now: string;
  showStatus?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const controlRef = useRef<HTMLElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);

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
    <section className="week-control" aria-label="Study plan" ref={controlRef}>
      <Button
        disabled={isPending}
        onClick={runReplan}
        type="button"
        variant="default"
      >
        <RefreshCw aria-hidden="true" size={18} strokeWidth={1.6} />
        {isPending ? "Replanning..." : "Replan"}
      </Button>
      {showStatus ? <p className="week-control__status">
        {lastPlannedAt
          ? `Updated ${formatLastSynced(lastPlannedAt, new Date(now))}`
          : "Not planned yet"}
      </p> : null}
      <PortalPopup
        anchorRef={controlRef}
        className="week-control__message"
        open={Boolean(message)}
        popupRef={messageRef}
        role="status"
      >
        {message}
      </PortalPopup>
    </section>
  );
}
