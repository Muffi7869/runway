"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import styles from "./assignments.module.css";
import { AssignmentStatusButton } from "./status-button";

export function menuKeyAction(
  key: string,
  currentIndex: number,
  itemCount: number,
): { close: boolean; focusIndex: number | null; returnFocus: boolean } {
  if (key === "Escape") {
    return { close: true, focusIndex: null, returnFocus: true };
  }
  if (key === "ArrowDown") {
    return { close: false, focusIndex: (currentIndex + 1) % itemCount, returnFocus: false };
  }
  if (key === "ArrowUp") {
    return { close: false, focusIndex: (currentIndex - 1 + itemCount) % itemCount, returnFocus: false };
  }
  return { close: false, focusIndex: null, returnFocus: false };
}

export function AssignmentActionsMenu({
  assignmentId,
  assignmentTitle,
  initiallyOpen = false,
}: {
  assignmentId: string;
  assignmentTitle: string;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    if (!open) return;

    itemRefs.current[0]?.focus();

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const currentIndex = itemRefs.current.findIndex((item) => item === document.activeElement);
    const action = menuKeyAction(event.key, Math.max(0, currentIndex), itemRefs.current.length);

    if (action.close || action.focusIndex !== null) event.preventDefault();
    if (action.close) {
      setOpen(false);
      if (action.returnFocus) triggerRef.current?.focus();
    } else if (action.focusIndex !== null) {
      itemRefs.current[action.focusIndex]?.focus();
    }
  }

  return (
    <div className={styles.actionsMenu} ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`More actions for ${assignmentTitle}`}
        className={styles.menuTrigger}
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open ? (
        <div className={styles.menuPopover} onKeyDown={handleMenuKeyDown} role="menu">
          <Link
            className={styles.menuItem}
            href={`/assignments/${assignmentId}/edit`}
            ref={(element) => { itemRefs.current[0] = element; }}
            role="menuitem"
            tabIndex={0}
          >Edit</Link>
          <AssignmentStatusButton assignmentId={assignmentId} buttonRef={(element) => { itemRefs.current[1] = element; }} kind="done" menuItem />
          <AssignmentStatusButton assignmentId={assignmentId} buttonRef={(element) => { itemRefs.current[2] = element; }} kind="drop" menuItem />
        </div>
      ) : null}
    </div>
  );
}
