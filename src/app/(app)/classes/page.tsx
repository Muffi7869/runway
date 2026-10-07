import { createClient } from "@/lib/db/server";
import { requireSettingsComplete } from "@/lib/settings/server";

import { ClassesManager } from "./classes-manager";

export default async function ClassesPage() {
  await requireSettingsComplete();
  const supabase = await createClient();
  const { data: classes, error } = await supabase
    .from("classes")
    .select("id,name,color,pace_ratio")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Unable to load classes.");
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Classes</h1>
      <ClassesManager classes={classes} />
    </main>
  );
}
