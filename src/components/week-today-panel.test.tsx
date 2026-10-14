import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WeekTodayPanel } from "./week-today-panel";

describe("WeekTodayPanel", () => {
  it("renders made-up blocks, check-in state, and due progress", () => {
    const markup = renderToStaticMarkup(
      <WeekTodayPanel
        checkinTime="11:30 PM"
        completionPercent={25}
        dateLabel="Wed, Oct 14"
        dueSoon={[
          {
            id: "assignment-a",
            label: "Writing Studio · Research outline",
            dueLabel: "Fri, Oct 16",
            progress: 50,
            color: "green",
          },
        ]}
        plannedLabel="2 h"
        plannedToday={[
          {
            id: "block-a",
            label: "Statistics Lab · Practice set · Review notes",
            detail: "2:00 – 3:00 PM",
            color: "purple",
            status: "planned",
          },
        ]}
        uncheckedCount={1}
        upNext={null}
      />,
    );

    expect(markup).toContain('aria-label="Today"');
    expect(markup).toContain("Planned today");
    expect(markup).toContain("1 block needs a quick update.");
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('href="/checkin"');
  });
});
