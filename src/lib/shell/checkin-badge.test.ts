import { describe, expect, it } from "vitest";

import { countCheckinBadge } from "./checkin-badge";

describe("countCheckinBadge", () => {
  it("counts planned and missed blocks from today and yesterday in Los Angeles", () => {
    expect(
      countCheckinBadge(
        [
          { start: "2026-10-14T17:00:00.000Z", status: "planned" },
          { start: "2026-10-13T07:30:00.000Z", status: "missed" },
          { start: "2026-10-14T18:00:00.000Z", status: "checked_in" },
          { start: "2026-10-12T18:00:00.000Z", status: "planned" },
        ],
        "2026-10-14",
        "2026-10-13",
      ),
    ).toBe(2);
  });

  it("uses the Los Angeles date at the UTC boundary", () => {
    expect(
      countCheckinBadge(
        [{ start: "2026-10-14T06:30:00.000Z", status: "planned" }],
        "2026-10-14",
        "2026-10-13",
      ),
    ).toBe(1);
  });

  it("ignores malformed timestamps", () => {
    expect(
      countCheckinBadge(
        [{ start: "not-a-date", status: "planned" }],
        "2026-10-14",
        "2026-10-13",
      ),
    ).toBe(0);
  });
});
