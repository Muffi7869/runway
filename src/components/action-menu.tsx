"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { PortalPopup, popupContainsTarget } from "./portal-popup";

import styles from "./action-menu.module.css";

export function menuKeyAction(
  key: string,
  currentIndex: number,
  itemCount: number,
): { close: boolean; focusIndex: number | null; returnFocus: boolean } {
  if (key === "Escape") return { close: true, focusIndex: null, returnFocus: true };
  if (key === "Tab") return { close: true, focusIndex: null, returnFocus: false };
  if (key === "Home") return { close: false, focusIndex: itemCount ? 0 : null, returnFocus: false };
  if (key === "End") return { close: false, focusIndex: itemCount ? itemCount - 1 : null, returnFocus: false };
  if (!itemCount) return { close: false, focusIndex: null, returnFocus: false };
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
  const menuId = useId();
  const popupRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function items(): HTMLElement[] {
    return Array.from(popupRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? [])
      .filter((item) => !(item instanceof HTMLButtonElement && item.disabled) && item.getAttribute("aria-disabled") !== "true");
  }

  const focusFirstItem = useCallback(() => {
    const first = popupRef.current?.querySelector<HTMLElement>("[role='menuitem']:not([disabled]):not([aria-disabled='true'])");
    first?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!popupContainsTarget(event.target as Node, triggerRef.current, popupRef.current)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const menuItems = items();
    const currentIndex = menuItems.findIndex((item) => item === document.activeElement);
    const action = menuKeyAction(event.key, Math.max(0, currentIndex), menuItems.length);
    if (event.key !== "Tab" && (action.close || action.focusIndex !== null)) event.preventDefault();
    if (action.close) {
      setOpen(false);
      if (action.returnFocus) triggerRef.current?.focus();
    } else if (action.focusIndex !== null) {
      menuItems[action.focusIndex]?.focus();
    }
  }

  return (
    <div className={styles.menu}>
      <button
        aria-controls={menuId}
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
      <PortalPopup
        anchorRef={triggerRef}
        className={styles.popover}
        id={menuId}
        onKeyDown={handleMenuKeyDown}
        onReady={focusFirstItem}
        open={open}
        popupRef={popupRef}
        role="menu"
      >
        {children}
      </PortalPopup>
    </div>
  );
}
