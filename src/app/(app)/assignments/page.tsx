import { requireSettingsComplete } from "@/lib/settings/server";

export default async function AssignmentsPage() {
  await requireSettingsComplete();

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Assignments</h1>
      <p>Coming in Phase 3</p>
    </main>
  );
}
