"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudDownload } from "lucide-react";

import { syncNowAction } from "@/app/(app)/week/actions";
import type { SyncFixedEventsResult } from "@/lib/google/sync-service";
import { formatLastSynced } from "@/lib/week/view";
import { Button } from "@/components/ui/button";
import { PortalPopup } from "@/components/portal-popup";

function resultMessage(result: SyncFixedEventsResult): string {
  if (result.ok) {
    const summary = `Synced. ${result.inserted} added, ${result.updated} updated, ${result.removed} removed.`;
    return result.unreadable > 0
      ? `${summary} ${result.unreadable} events could not be read.`
      : summary;
  }

  switch (result.reason) {
    case "needs_reconnect":
      return "Reconnect Google Calendar in Settings.";
    case "no_calendars":
      return "Choose your calendars in Settings first.";
    case "calendar_unavailable":
      return "One of your chosen calendars is no longer available. Update your selection in Settings.";
    case "google_unavailable":
      return "Google isn't responding. Try again in a moment.";
    case "write_failed":
      return "Couldn't save the synced events. Try again.";
  }
}

export function SyncControls({
  lastSyncedAt,
  now,
  menuItem = false,
  showStatus = true,
}: {
  lastSyncedAt: string | null;
  now: string;
  menuItem?: boolean;
  showStatus?: boolean;
}) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState<string>();
  const controlRef = useRef<HTMLElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  async function syncNow() {
    setIsRunning(true);

    try {
      setMessage(resultMessage(await syncNowAction()));
      router.refresh();
    } catch {
      setMessage("Couldn't save the synced events. Try again.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <section className="week-control" aria-label="Calendar sync" ref={controlRef}>
      <Button
        role={menuItem ? "menuitem" : undefined}
        disabled={isRunning}
        onClick={syncNow}
        type="button"
        variant="ghost"
      >
        <CloudDownload aria-hidden="true" size={18} strokeWidth={1.6} />
        {isRunning ? "Syncing…" : "Sync now"}
      </Button>
      {showStatus ? <p className="week-control__status">
        Synced {formatLastSynced(lastSyncedAt, new Date(now))}
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
