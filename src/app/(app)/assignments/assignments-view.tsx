"use client";

import Link from "next/link";
import { useState } from "react";

import { ClassChip } from "../../../components/ui/class-chip";
import { ProgressBar } from "../../../components/ui/progress-bar";
import { Tabs } from "../../../components/ui/tabs";
import { Tag } from "../../../components/ui/tag";
import type { ClassColor } from "../../../lib/classes/palette";

import styles from "./assignments.module.css";
import { AssignmentStatusButton } from "./status-button";

export type AssignmentListItem = {
  id: string;
  title: string;
  className: string;
  classColor: ClassColor;
  deadlineLabel: string;
  weight: "low" | "medium" | "high";
  status: "active" | "done" | "dropped";
  progress: number;
  currentTotal: string;
  aiTotal?: string;
  needsSpec: boolean;
  overdue: boolean;
  weekGroup: "thisWeek" | "nextWeek" | "later";
  hasSteps: boolean;
};

type AssignmentTab = "active" | "done" | "dropped";

export function AssignmentRowDisplay({ assignment, showActions = true }: { assignment: AssignmentListItem; showActions?: boolean }) {
  const active = assignment.status === "active";
  return (
    <article className={styles.row} data-status={assignment.status}>
      <div className={styles.assignmentCell}>
        <ClassChip color={assignment.classColor}>{assignment.className}</ClassChip>
        <div className={styles.titleLine}>
          <h3 className={styles.title}>{assignment.title}</h3>
          <div className={styles.tags}>
            {active && assignment.needsSpec ? <Tag>Needs spec</Tag> : null}
            {active && assignment.overdue ? <Tag variant="warn">Overdue</Tag> : null}
            <Tag>{assignment.weight}</Tag>
          </div>
        </div>
      </div>
      <div className={styles.dueCell}><span className={styles.mobileLabel}>Due</span>{assignment.deadlineLabel}</div>
      <div className={styles.progressCell}>
        <ProgressBar color={assignment.classColor} label={`${assignment.title} progress`} value={assignment.progress} />
        <span className="num">{assignment.progress}%</span>
      </div>
      <div className={styles.timeCell}>
        <strong>{assignment.currentTotal}</strong>
        {assignment.aiTotal ? <span>AI guessed {assignment.aiTotal}</span> : null}
      </div>
      {showActions ? (
        <div className={styles.actions}>
          {active ? (
            <>
              <Link className="ui-button ui-button--small" href={`/assignments/${assignment.id}/breakdown`}>{assignment.hasSteps ? "Plan" : "Break down"}</Link>
              <Link className="ui-button ui-button--small" href={`/assignments/${assignment.id}/edit`}>Edit</Link>
              <AssignmentStatusButton assignmentId={assignment.id} kind="done" />
              <AssignmentStatusButton assignmentId={assignment.id} kind="drop" />
            </>
          ) : <AssignmentStatusButton assignmentId={assignment.id} kind="restore" />}
        </div>
      ) : null}
    </article>
  );
}

const groupLabels = { thisWeek: "This week", nextWeek: "Next week", later: "Later" } as const;

function AssignmentTable({ assignments }: { assignments: AssignmentListItem[] }) {
  return <div className={styles.table}>
    <div aria-hidden="true" className={styles.tableHeader}><span>Assignment</span><span>Due</span><span>Progress</span><span>Plan</span><span>Actions</span></div>
    {assignments.map((assignment) => <AssignmentRowDisplay assignment={assignment} key={assignment.id} />)}
  </div>;
}

export function AssignmentsView({ activeGroups, done, dropped }: {
  activeGroups: Record<"thisWeek" | "nextWeek" | "later", AssignmentListItem[]>;
  done: AssignmentListItem[];
  dropped: AssignmentListItem[];
}) {
  const [tab, setTab] = useState<AssignmentTab>("active");
  const activeCount = activeGroups.thisWeek.length + activeGroups.nextWeek.length + activeGroups.later.length;
  return <>
    <Tabs ariaLabel="Assignment status" onValueChange={setTab} options={[
      { value: "active", label: "Active", count: activeCount },
      { value: "done", label: "Done", count: done.length },
      { value: "dropped", label: "Dropped", count: dropped.length },
    ]} value={tab} />
    <div className={styles.tabPanel} role="tabpanel">
      {tab === "active" ? activeCount ? (Object.keys(groupLabels) as Array<keyof typeof groupLabels>).map((key) => activeGroups[key].length ? (
        <section className={styles.group} key={key}><h2>{groupLabels[key]}</h2><AssignmentTable assignments={activeGroups[key]} /></section>
      ) : null) : <p className={styles.empty}>No active assignments yet.</p> : null}
      {tab === "done" ? done.length ? <AssignmentTable assignments={done} /> : <p className={styles.empty}>No done assignments.</p> : null}
      {tab === "dropped" ? dropped.length ? <AssignmentTable assignments={dropped} /> : <p className={styles.empty}>No dropped assignments.</p> : null}
    </div>
  </>;
}
