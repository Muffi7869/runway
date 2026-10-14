import { formatDeadline, formatEstimate } from "@/lib/assignments/helpers";
import { requireOwner } from "@/lib/auth/server";
import { classRowStats } from "@/lib/classes/stats";
import { createClient } from "@/lib/db/server";
import { requireSettingsComplete } from "@/lib/settings/server";

import styles from "./classes.module.css";
import { ClassesManager } from "./classes-manager";

export default async function ClassesPage() {
  await requireSettingsComplete();
  const user = await requireOwner();
  const supabase = await createClient();
  const [classesResult, assignmentsResult, sessionsResult] = await Promise.all([
    supabase.from("classes").select("id,name,color,pace_ratio").eq("user_id", user.id).order("created_at", { ascending: true }),
    supabase.from("assignments").select("id,class_id,deadline,status").eq("user_id", user.id),
    supabase.from("sessions").select("assignment_id,actual_minutes").eq("user_id", user.id),
  ]);
  if (classesResult.error || assignmentsResult.error || sessionsResult.error) throw new Error("Unable to load classes.");
  const stats = classRowStats({ assignments: assignmentsResult.data, sessions: sessionsResult.data });
  const now = new Date();
  const classes = classesResult.data.map((row) => {
    const summary = stats.get(row.id) ?? { activeAssignments: 0, loggedMinutes: 0, nextDeadline: null };
    return {
      ...row,
      stats: {
        activeAssignments: summary.activeAssignments,
        loggedTime: summary.loggedMinutes ? formatEstimate(summary.loggedMinutes) : "None",
        nextDue: summary.nextDeadline ? formatDeadline(summary.nextDeadline, now) : "None",
      },
    };
  });

  return <main className={styles.page}>
    <header className={styles.header}><h1 className={styles.heading}>Classes</h1><p>Keep names, colors, and planning pace easy to scan.</p></header>
    <ClassesManager classes={classes} />
  </main>;
}
