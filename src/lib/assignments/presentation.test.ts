import { describe, expect, it } from "vitest";

import { groupByWeek } from "./presentation";

const item = (id: string, deadline: string) => ({ id, deadline });

describe("groupByWeek", () => {
  it("groups Monday-through-Sunday Los Angeles weeks and keeps overdue work this week", () => {
    const groups = groupByWeek(
      [
        item("overdue", "2026-10-04T19:00:00Z"),
        item("sunday", "2026-10-12T06:59:00Z"),
        item("next-monday", "2026-10-12T07:00:00Z"),
        item("later", "2026-10-19T07:00:00Z"),
      ],
      new Date("2026-10-07T19:00:00Z"),
    );

    expect(groups.thisWeek.map(({ id }) => id)).toEqual(["overdue", "sunday"]);
    expect(groups.nextWeek.map(({ id }) => id)).toEqual(["next-monday"]);
    expect(groups.later.map(({ id }) => id)).toEqual(["later"]);
  });

  it("uses the correct boundary across the November 2026 fall-back week", () => {
    const groups = groupByWeek(
      [
        item("sunday", "2026-11-02T07:59:00Z"),
        item("monday", "2026-11-02T08:00:00Z"),
      ],
      new Date("2026-10-28T19:00:00Z"),
    );
    expect(groups.thisWeek.map(({ id }) => id)).toEqual(["sunday"]);
    expect(groups.nextWeek.map(({ id }) => id)).toEqual(["monday"]);
  });

  it("uses the correct boundary across the March 2027 spring-forward week", () => {
    const groups = groupByWeek(
      [
        item("sunday", "2027-03-15T06:59:00Z"),
        item("monday", "2027-03-15T07:00:00Z"),
      ],
      new Date("2027-03-10T20:00:00Z"),
    );
    expect(groups.thisWeek.map(({ id }) => id)).toEqual(["sunday"]);
    expect(groups.nextWeek.map(({ id }) => id)).toEqual(["monday"]);
  });

  it("returns empty groups for no assignments", () => {
    expect(groupByWeek([], new Date("2026-10-07T19:00:00Z"))).toEqual({
      thisWeek: [],
      nextWeek: [],
      later: [],
    });
  });
});
