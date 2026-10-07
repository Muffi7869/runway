import Link from "next/link";

import { requireOwner } from "@/lib/auth/server";
import { DEFAULT_DEADLINE_TIME } from "@/lib/assignments/helpers";
import { createClient } from "@/lib/db/server";
import { requireSettingsComplete } from "@/lib/settings/server";

import { AssignmentForm } from "../assignment-form";

export default async function NewAssignmentPage() {
  await requireSettingsComplete();
  const user = await requireOwner();
  const supabase = await createClient();
  const { data: classes, error } = await supabase
    .from("classes")
    .select("id,name,color")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  if (error) {
    throw new Error("Unable to load classes.");
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Add assignment</h1>
      {classes.length === 0 ? (
        <p className="mt-6">
          Add a class first.{" "}
          <Link className="underline" href="/classes">
            Go to Classes
          </Link>
        </p>
      ) : (
        <AssignmentForm
          classes={classes}
          initialValues={{
            classId: "",
            title: "",
            deadlineDate: "",
            deadlineTime: DEFAULT_DEADLINE_TIME,
            weight: "medium",
            specText: "",
          }}
          mode="create"
        />
      )}
    </main>
  );
}
