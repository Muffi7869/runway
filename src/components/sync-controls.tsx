"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { syncNowAction } from "@/app/(app)/week/actions";
import type { SyncFixedEventsResult } from "@/lib/google/sync-service";
import { formatLastSynced } from "@/lib/week/view";

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
}: {
  lastSyncedAt: string | null;
  now: string;
}) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState<string>();

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
    <section className="mt-6 space-y-3" aria-label="Calendar sync">
      <p>Last synced: {formatLastSynced(lastSyncedAt, new Date(now))}</p>
      <button
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        disabled={isRunning}
        onClick={syncNow}
        type="button"
      >
        {isRunning ? "Syncing…" : "Sync now"}
      </button>
      {message ? <p>{message}</p> : null}
    </section>
  );
}

export function AutoSync() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return;
    }

    started.current = true;

    void (async () => {
      try {
        await syncNowAction();
      } catch {
        // SyncControls provides the manual retry path and its status messages.
      } finally {
        router.refresh();
      }
    })();
  }, [router]);

  return null;
}
