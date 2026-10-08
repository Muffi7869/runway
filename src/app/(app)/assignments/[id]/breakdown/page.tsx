import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { requireOwner } from "@/lib/auth/server";
import { createClient } from "@/lib/db/server";
import { requireSettingsComplete } from "@/lib/settings/server";

import { BreakdownButton } from "./breakdown-button";
import styles from "./breakdown.module.css";

export const maxDuration = 60;

const assignmentIdSchema = z.string().uuid();

export default async function AssignmentBreakdownPage({
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
  const { data: assignment, error } = await supabase
    .from("assignments")
    .select("id,title,status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load the assignment.");
  }

  if (!assignment || assignment.status !== "active") {
    notFound();
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>{assignment.title}</h1>
      <BreakdownButton assignmentId={assignment.id} />
      <Link className={styles.backLink} href="/assignments">
        Back to assignments
      </Link>
    </main>
  );
}
