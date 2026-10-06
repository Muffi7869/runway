import { requireSettingsComplete } from "@/lib/settings/server";

export default async function WeekPage() {
  await requireSettingsComplete();

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Week</h1>
      <p>Coming in Phase 2</p>
    </main>
  );
}
