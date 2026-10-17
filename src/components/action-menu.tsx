"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import styles from "./action-menu.module.css";

export function menuKeyAction(
  key: string,
  currentIndex: number,
  itemCount: number,
): { close: boolean; focusIndex: number | null; returnFocus: boolean } {
  if (key === "Escape") return { close: true, focusIndex: null, returnFocus: true };
  if (key === "ArrowDown") return { close: false, focusIndex: (currentIndex + 1) % itemCount, returnFocus: false };
  if (key === "ArrowUp") return { close: false, focusIndex: (currentIndex - 1 + itemCount) % itemCount, returnFocus: false };
  return { close: false, focusIndex: null, returnFocus: false };
}

export function ActionMenu({
  label,
  children,
  initiallyOpen = false,
}: {
  label: string;
  children: ReactNode;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function items(): HTMLElement[] {
    return Array.from(containerRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? []);
  }

  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const menuItems = items();
    const currentIndex = menuItems.findIndex((item) => item === document.activeElement);
    const action = menuKeyAction(event.key, Math.max(0, currentIndex), menuItems.length);
    if (action.close || action.focusIndex !== null) event.preventDefault();
    if (action.close) {
      setOpen(false);
      if (action.returnFocus) triggerRef.current?.focus();
    } else if (action.focusIndex !== null) {
      menuItems[action.focusIndex]?.focus();
    }
  }

  return (
    <div className={styles.menu} ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className={styles.trigger}
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open ? (
        <div className={styles.popover} onKeyDown={handleMenuKeyDown} role="menu">
          {children}
        </div>
      ) : null}
    </div>
  );
}
