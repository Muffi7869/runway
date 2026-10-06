import { requireSettingsComplete } from "@/lib/settings/server";

export default async function ClassesPage() {
  await requireSettingsComplete();

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Classes</h1>
    </main>
  );
}
