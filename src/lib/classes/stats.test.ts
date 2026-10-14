import { describe, expect, it } from "vitest";
import { classRowStats } from "./stats";

describe("classRowStats", () => {
  it("counts active work, logged minutes, and the next active deadline", () => {
    const stats = classRowStats({
      assignments: [
        { id: "a", class_id: "writing", deadline: "2026-11-02T18:00:00Z", status: "active" },
        { id: "b", class_id: "writing", deadline: "2026-10-20T18:00:00Z", status: "active" },
        { id: "c", class_id: "writing", deadline: "2026-10-10T18:00:00Z", status: "done" },
      ],
      sessions: [{ assignment_id: "a", actual_minutes: 35 }, { assignment_id: "c", actual_minutes: 25 }],
    });
    expect(stats.get("writing")).toEqual({ activeAssignments: 2, loggedMinutes: 60, nextDeadline: "2026-10-20T18:00:00Z" });
  });
});
