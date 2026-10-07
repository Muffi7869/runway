import { notFound } from "next/navigation";
import { z } from "zod";

import { deadlineToFormValues } from "@/lib/assignments/helpers";
import { requireOwner } from "@/lib/auth/server";
import { createClient } from "@/lib/db/server";
import { requireSettingsComplete } from "@/lib/settings/server";

import { AssignmentForm } from "../../assignment-form";

const assignmentIdSchema = z.string().uuid();
const assignmentWeights = ["low", "medium", "high"] as const;

export default async function EditAssignmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSettingsComplete();
  const user = await requireOwner();
  const { id } = await params;

  if (!assignmentIdSchema.safeParse(id).success) {
    notFound();
  }

  const supabase = await createClient();
  const [assignmentResult, classesResult] = await Promise.all([
    supabase
      .from("assignments")
      .select("id,class_id,title,deadline,weight,status,spec_text")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("classes")
      .select("id,name,color")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),
  ]);

  if (assignmentResult.error || classesResult.error) {
    throw new Error("Unable to load the assignment.");
  }

  const assignment = assignmentResult.data;

  if (!assignment || assignment.status !== "active") {
    notFound();
  }

  if (
    !assignmentWeights.includes(
      assignment.weight as (typeof assignmentWeights)[number],
    )
  ) {
    notFound();
  }

  const deadline = deadlineToFormValues(assignment.deadline);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Edit assignment</h1>
      <AssignmentForm
        classes={classesResult.data}
        initialValues={{
          assignmentId: assignment.id,
          classId: assignment.class_id,
          title: assignment.title,
          deadlineDate: deadline.date,
          deadlineTime: deadline.time,
          weight: assignment.weight,
          specText: assignment.spec_text ?? "",
        }}
        mode="edit"
      />
    </main>
  );
}
