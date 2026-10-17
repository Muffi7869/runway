import { describe, expect, it } from "vitest";

import { mapGoogleEvent } from "./event-mapper";
import { planSync } from "./sync-planner";
import { assignLanes, segmentEventsByDay } from "../week/view";

const timedEvent = (
  id: string,
  start = "2026-10-14T17:00:00-07:00",
  end = "2026-10-14T18:00:00-07:00",
) => ({
  id,
  status: "confirmed",
  summary: "Test Class A",
  start: { dateTime: start },
  end: { dateTime: end },
});

describe("duplicate event investigation", () => {
  it("keeps each expanded recurring instance's Google instance id", () => {
    const first = mapGoogleEvent(timedEvent("recurring-instance-a"), "calendar-a@example.com");
    const second = mapGoogleEvent(timedEvent("recurring-instance-b", "2026-10-21T17:00:00-07:00", "2026-10-21T18:00:00-07:00"), "calendar-a@example.com");
    expect(first.kind === "event" && first.value.google_event_id).toBe("recurring-instance-a");
    expect(second.kind === "event" && second.value.google_event_id).toBe("recurring-instance-b");
  });

  it("treats the same invitation on two selected calendars as two composite keys", () => {
    const first = mapGoogleEvent(timedEvent("shared-invitation"), "calendar-a@example.com");
    const second = mapGoogleEvent(timedEvent("shared-invitation"), "calendar-b@example.com");
    if (first.kind !== "event" || second.kind !== "event") throw new Error("Fixture did not map.");
    expect(planSync({ existing: [], incoming: [first.value, second.value], selectedCalendarIds: ["calendar-a@example.com", "calendar-b@example.com"] }).inserts).toHaveLength(2);
  });

  it("updates a moved instance instead of inserting another row", () => {
    const mapped = mapGoogleEvent(timedEvent("instance-a", "2026-10-14T18:00:00-07:00", "2026-10-14T19:00:00-07:00"), "calendar-a@example.com");
    if (mapped.kind !== "event") throw new Error("Fixture did not map.");
    const plan = planSync({
      existing: [{ id: "row-a", ...mapped.value, start: "2026-10-14T17:00:00.000Z" }],
      incoming: [mapped.value],
      selectedCalendarIds: ["calendar-a@example.com"],
    });
    expect(plan.inserts).toEqual([]);
    expect(plan.updates).toEqual([{ id: "row-a", start: mapped.value.start }]);
  });

  it("skips a cancelled instance so the planner removes its stored row", () => {
    const cancelled = mapGoogleEvent({ ...timedEvent("instance-a"), status: "cancelled" }, "calendar-a@example.com");
    expect(cancelled).toEqual({ kind: "skip", reason: "cancelled" });
    const plan = planSync({
      existing: [{ id: "row-a", google_event_id: "instance-a", source_calendar_id: "calendar-a@example.com", title: "Test Class A", start: "2026-10-15T00:00:00.000Z", end: "2026-10-15T01:00:00.000Z" }],
      incoming: [],
      selectedCalendarIds: ["calendar-a@example.com"],
    });
    expect(plan.deletes).toEqual(["row-a"]);
  });

  it("lane placement returns one layout for each input and never draws one twice", () => {
    const events = [
      { id: "event-a", title: "Test Class A", start: "2026-10-14T17:00:00.000Z", end: "2026-10-14T18:00:00.000Z" },
      { id: "event-b", title: "Test Class B", start: "2026-10-14T17:00:00.000Z", end: "2026-10-14T18:00:00.000Z" },
    ];
    const placed = assignLanes(segmentEventsByDay(events, { year: 2026, month: 10, day: 12 }));
    expect(placed.map((item) => item.id).sort()).toEqual(["event-a", "event-b"]);
  });
});
