import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./status-button", () => ({ AssignmentStatusButton: () => null }));

import { AssignmentRowDisplay, AssignmentsView, type AssignmentListItem } from "./assignments-view";

const active: AssignmentListItem = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "Research outline",
  className: "Writing Studio",
  classColor: "purple",
  deadlineLabel: "Tue, Oct 20 at 2:00 PM",
  weight: "medium",
  status: "active",
  progress: 25,
  currentTotal: "2h",
  aiTotal: "2h 30m",
  needsSpec: true,
  overdue: true,
  weekGroup: "thisWeek",
  hasSteps: true,
};

describe("assignment presentation", () => {
  it("shows active-only tags and the optional AI estimate", () => {
    const activeMarkup = renderToStaticMarkup(<AssignmentRowDisplay assignment={active} showActions={false} />);
    const doneMarkup = renderToStaticMarkup(<AssignmentRowDisplay assignment={{ ...active, status: "done" }} showActions={false} />);
    const noAiMarkup = renderToStaticMarkup(<AssignmentRowDisplay assignment={{ ...active, aiTotal: undefined }} showActions={false} />);
    expect(activeMarkup).toContain("Needs spec");
    expect(activeMarkup).toContain("Overdue");
    expect(activeMarkup).toContain("AI guessed 2h 30m");
    expect(doneMarkup).not.toContain("Needs spec");
    expect(doneMarkup).not.toContain("Overdue");
    expect(noAiMarkup).not.toContain("AI guessed");
  });

  it("renders segmented tab counts", () => {
    const markup = renderToStaticMarkup(<AssignmentsView activeGroups={{ thisWeek: [active], nextWeek: [], later: [] }} done={[]} dropped={[]} />);
    expect(markup).toContain("Active 1");
    expect(markup).toContain("Done 0");
    expect(markup).toContain("Dropped 0");
    expect(markup).toContain("This week");
    expect(markup).not.toContain("Next week");
    expect(markup).not.toContain("Later");
  });
});
