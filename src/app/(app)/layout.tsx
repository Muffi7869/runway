import type { ReactNode } from "react";

import { AppSidebar, type SidebarSyncState } from "@/components/app-sidebar";
import { requireOwner } from "@/lib/auth/server";
import { createClient } from "@/lib/db/server";
import { countCheckinBadge } from "@/lib/shell/checkin-badge";
import {
  addDays,
  APP_TIMEZONE,
  zonedParts,
  zonedTimeToUtc,
} from "@/lib/time/zoned";
import { formatLastSynced } from "@/lib/week/view";

function dayKey(day: { year: number; month: number; day: number }) {
  return `${day.year}-${String(day.month).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireOwner();
  const supabase = await createClient();
  const now = new Date();
  const todayParts = zonedParts(now, APP_TIMEZONE);
  const today = { year: todayParts.year, month: todayParts.month, day: todayParts.day };
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);
  let checkinBadge: number | undefined;
  let sync: SidebarSyncState | undefined;

  try {
    const [blocksResult, connectionResult] = await Promise.all([
      supabase
        .from("blocks")
        .select("start,status")
        .eq("user_id", user.id)
        .in("status", ["planned", "missed"])
        .gte(
          "start",
          zonedTimeToUtc({ ...yesterday, hour: 0, minute: 0 }, APP_TIMEZONE).toISOString(),
        )
        .lt(
          "start",
          zonedTimeToUtc({ ...tomorrow, hour: 0, minute: 0 }, APP_TIMEZONE).toISOString(),
        ),
      supabase
        .from("google_connection")
        .select("status,last_synced_at")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (!blocksResult.error) {
      checkinBadge = countCheckinBadge(
        blocksResult.data,
        dayKey(today),
        dayKey(yesterday),
      );
    }

    if (!connectionResult.error) {
      const connection = connectionResult.data;
      sync = connection
        ? connection.status === "needs_reconnect"
          ? { state: "needs_reconnect", label: "Google Calendar needs reconnecting" }
          : {
              state: "connected",
              label: `Google Calendar synced ${formatLastSynced(connection.last_synced_at, now)}`,
            }
        : { state: "none", label: "Google Calendar not connected" };
    }
  } catch {
    // The shell remains usable when its optional status reads fail.
  }

  const metadataName = user.user_metadata.full_name;
  const userName =
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim()
      : "Owner";

  return (
    <div className="app-shell">
      <AppSidebar checkinBadge={checkinBadge} sync={sync} userName={userName} />
      <div className="app-content">{children}</div>
    </div>
  );
}
