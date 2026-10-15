import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./status-button", () => ({
  AssignmentStatusButton: ({ kind }: { kind: string }) => <button role="menuitem">{kind}</button>,
}));

import { AssignmentActionsMenu, menuKeyAction } from "./assignment-actions-menu";

describe("AssignmentActionsMenu", () => {
  it("renders the trigger closed and exposes the full open menu", () => {
    const closed = renderToStaticMarkup(
      <AssignmentActionsMenu assignmentId="assignment-a" assignmentTitle="Test Assignment A" />,
    );
    const open = renderToStaticMarkup(
      <AssignmentActionsMenu assignmentId="assignment-a" assignmentTitle="Test Assignment A" initiallyOpen />,
    );

    expect(closed).toContain('aria-haspopup="menu"');
    expect(closed).toContain('aria-expanded="false"');
    expect(closed).not.toContain('role="menu"');
    expect(open).toContain('aria-expanded="true"');
    expect(open).toContain('role="menu"');
    expect(open).toContain("Edit");
    expect(open).toContain("done");
    expect(open).toContain("drop");
  });

  it("closes on Escape, returns focus, and navigates with arrows", () => {
    expect(menuKeyAction("Escape", 1, 3)).toEqual({ close: true, focusIndex: null, returnFocus: true });
    expect(menuKeyAction("ArrowDown", 2, 3)).toEqual({ close: false, focusIndex: 0, returnFocus: false });
    expect(menuKeyAction("ArrowUp", 0, 3)).toEqual({ close: false, focusIndex: 2, returnFocus: false });
  });
});
