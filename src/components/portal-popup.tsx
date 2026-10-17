"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEventHandler,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import { computeMenuPosition } from "../lib/ui/popup-position";

function subscribeToMount(): () => void {
  return () => undefined;
}

function mountedInBrowser(): boolean {
  return true;
}

function mountedOnServer(): boolean {
  return false;
}

export function popupContainsTarget(
  target: Node,
  trigger: Pick<Node, "contains"> | null,
  popup: Pick<Node, "contains"> | null,
): boolean {
  return Boolean(trigger?.contains(target) || popup?.contains(target));
}

export function PortalPopup({
  anchorRef,
  ariaLabel,
  children,
  className,
  gap,
  id,
  onKeyDown,
  onReady,
  open,
  popupRef,
  role,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  ariaLabel?: string;
  children: ReactNode;
  className: string;
  gap?: number;
  id?: string;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  onReady?: () => void;
  open: boolean;
  popupRef: RefObject<HTMLDivElement | null>;
  role?: string;
}) {
  const mounted = useSyncExternalStore(
    subscribeToMount,
    mountedInBrowser,
    mountedOnServer,
  );

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const popup = popupRef.current;

    if (!anchor || !popup) return;

    const position = computeMenuPosition({
      trigger: anchor.getBoundingClientRect(),
      menu: popup.getBoundingClientRect(),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      gap,
    });

    popup.style.left = `${position.left}px`;
    popup.style.top = `${position.top}px`;
    popup.style.visibility = "visible";
    popup.dataset.placement = position.placement;
  }, [anchorRef, gap, popupRef]);

  useLayoutEffect(() => {
    if (!mounted || !open) return;

    updatePosition();
  });

  useLayoutEffect(() => {
    if (!mounted || !open) return;

    onReady?.();
  }, [mounted, onReady, open]);

  useEffect(() => {
    if (!mounted || !open) return;

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [mounted, open, updatePosition]);

  if (!mounted || !open) return null;

  const style: CSSProperties = {
    left: 0,
    position: "fixed",
    top: 0,
    visibility: "hidden",
  };

  return createPortal(
    <div
      aria-label={ariaLabel}
      className={className}
      id={id}
      onKeyDown={onKeyDown}
      ref={popupRef}
      role={role}
      style={style}
    >
      {children}
    </div>,
    document.body,
  );
}
