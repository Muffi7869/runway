import { requireOwner } from "@/lib/auth/server";

export default async function SettingsPage() {
  await requireOwner();

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
    </main>
  );
}
