import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const portalCapture = vi.hoisted(() => ({ children: undefined as ReactNode }));

vi.mock("./status-button", () => ({
  AssignmentStatusButton: ({ kind }: { kind: string }) => <button role="menuitem">{kind}</button>,
}));

vi.mock("../../../components/portal-popup", () => ({
  PortalPopup: ({ children, open }: { children: ReactNode; open: boolean }) => {
    portalCapture.children = open ? children : undefined;
    return null;
  },
  popupContainsTarget: () => false,
}));

import { AssignmentActionsMenu, menuKeyAction } from "./assignment-actions-menu";

describe("AssignmentActionsMenu", () => {
  it("renders the trigger closed and exposes the full open menu", () => {
    const closed = renderToStaticMarkup(
      <AssignmentActionsMenu assignmentId="assignment-a" assignmentTitle="Test Assignment A" />,
    );
    const openHost = renderToStaticMarkup(
      <div data-overflow="hidden">
        <AssignmentActionsMenu assignmentId="assignment-a" assignmentTitle="Test Assignment A" initiallyOpen />
      </div>,
    );
    const portal = renderToStaticMarkup(
      <div data-portal-target="document.body" role="menu">{portalCapture.children}</div>,
    );

    expect(closed).toContain('aria-haspopup="menu"');
    expect(closed).toContain('aria-expanded="false"');
    expect(closed).not.toContain('role="menu"');
    expect(openHost).toContain('aria-expanded="true"');
    expect(openHost).not.toContain('role="menu"');
    expect(portal).toContain('data-portal-target="document.body"');
    expect(portal).toContain('role="menu"');
    expect(portal).toContain("Edit");
    expect(portal).toContain("done");
    expect(portal).toContain("drop");
  });

  it("closes on Escape or Tab and supports every menu navigation key", () => {
    expect(menuKeyAction("Escape", 1, 3)).toEqual({ close: true, focusIndex: null, returnFocus: true });
    expect(menuKeyAction("Tab", 1, 3)).toEqual({ close: true, focusIndex: null, returnFocus: false });
    expect(menuKeyAction("ArrowDown", 2, 3)).toEqual({ close: false, focusIndex: 0, returnFocus: false });
    expect(menuKeyAction("ArrowUp", 0, 3)).toEqual({ close: false, focusIndex: 2, returnFocus: false });
    expect(menuKeyAction("Home", 2, 3)).toEqual({ close: false, focusIndex: 0, returnFocus: false });
    expect(menuKeyAction("End", 0, 3)).toEqual({ close: false, focusIndex: 2, returnFocus: false });
  });
});
