import { SyncControls, AutoSync } from "@/components/sync-controls";
import { requireOwner } from "@/lib/auth/server";
import { createClient } from "@/lib/db/server";
import { requireSettingsComplete } from "@/lib/settings/server";

export const maxDuration = 30;

export default async function WeekPage() {
  await requireSettingsComplete();
  const user = await requireOwner();
  const supabase = await createClient();
  const { data: connection, error } = await supabase
    .from("google_connection")
    .select("status,fixed_calendar_ids,last_synced_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load calendar sync status.");
  }

  const isConnected = connection?.status === "connected";
  const lastSyncedTime = connection?.last_synced_at
    ? Date.parse(connection.last_synced_at)
    : Number.NaN;
  // The stale check intentionally uses the current server request time.
  // eslint-disable-next-line react-hooks/purity
  const currentTime = Date.now();
  const shouldAutoSync =
    isConnected &&
    connection.fixed_calendar_ids.length > 0 &&
    (!Number.isFinite(lastSyncedTime) ||
      currentTime - lastSyncedTime > 30 * 60 * 1000);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Week</h1>
      <p>Coming in Phase 2</p>
      {isConnected ? (
        <SyncControls lastSyncedAt={connection.last_synced_at} />
      ) : null}
      {shouldAutoSync ? <AutoSync /> : null}
    </main>
  );
}
