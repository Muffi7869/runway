import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CheckinCard } from "./checkin-card";

describe("CheckinCard", () => {
  it("renders progress choices without changing the form field contract", () => {
    const markup = renderToStaticMarkup(
      <CheckinCard
        color="teal"
        dueLabel="Due Fri, Oct 16"
        fromYesterday
        group={{
          assignmentId: "assignment-a",
          className: "Writing Studio",
          classColor: "teal",
          title: "Research outline",
          minutesDefault: 45,
          blockIds: ["block-a"],
          steps: [
            {
              stepId: "step-a",
              name: "Organize notes",
              order: 1,
              storedPercent: 25,
              plannedToday: true,
            },
          ],
          alreadyCheckedIn: false,
        }}
        minutes="45"
        onMinutesChange={() => undefined}
        onPercentChange={() => undefined}
        percents={{ "step-a": 50 }}
        plannedMinutesByStep={{ "step-a": 45 }}
      />,
    );

    expect(markup).toContain("From yesterday");
    expect(markup).toContain('aria-label="Organize notes percent complete"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('id="minutes-assignment-a"');
  });
});
