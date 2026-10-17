import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const actionMocks = vi.hoisted(() => ({
  done: vi.fn(async () => ({ ok: true as const })),
  drop: vi.fn(async () => ({ ok: true as const })),
  restore: vi.fn(async () => ({ ok: true as const })),
}));

vi.mock("./actions", () => ({
  markDoneAction: actionMocks.done,
  dropAction: actionMocks.drop,
  restoreAction: actionMocks.restore,
}));

import {
  AssignmentStatusButtonView,
  statusActionForKind,
} from "./status-button";

describe("AssignmentStatusButton", () => {
  it.each([
    ["done", actionMocks.done],
    ["drop", actionMocks.drop],
  ] as const)("keeps the %s menu item wired to its exact action and FormData", async (kind, action) => {
    const assignmentId = "00000000-0000-4000-8000-000000000001";
    const formData = new FormData();
    formData.set("assignmentId", assignmentId);

    const markup = renderToStaticMarkup(
      <AssignmentStatusButtonView
        assignmentId={assignmentId}
        formAction={() => undefined}
        isPending={false}
        kind={kind}
        menuItem
        state={{}}
      />,
    );

    expect(markup).toContain('name="assignmentId"');
    expect(markup).toContain(`value="${assignmentId}"`);
    expect(markup).toContain('role="menuitem"');
    expect(markup).toContain(kind === "done" ? ">Done<" : ">Drop<");

    await statusActionForKind(kind)({}, formData);
    expect(action).toHaveBeenCalledOnce();
    expect(action).toHaveBeenCalledWith({}, formData);
  });
});
