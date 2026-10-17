"use client";

import Link from "next/link";
import { ActionMenu, menuKeyAction } from "../../../components/action-menu";

import styles from "./assignments.module.css";
import { AssignmentStatusButton } from "./status-button";

export { menuKeyAction };

export function AssignmentActionsMenu({
  assignmentId,
  assignmentTitle,
  initiallyOpen = false,
}: {
  assignmentId: string;
  assignmentTitle: string;
  initiallyOpen?: boolean;
}) {
  return (
    <ActionMenu label={`More actions for ${assignmentTitle}`} initiallyOpen={initiallyOpen}>
          <Link
            className={styles.menuItem}
            href={`/assignments/${assignmentId}/edit`}
            role="menuitem"
            tabIndex={0}
          >Edit</Link>
          <AssignmentStatusButton assignmentId={assignmentId} kind="done" menuItem />
          <AssignmentStatusButton assignmentId={assignmentId} kind="drop" menuItem />
    </ActionMenu>
  );
}
