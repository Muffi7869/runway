import { describe, expect, it } from "vitest";

import { importWindowEnd, isInImportWindow, resolveDueIso } from "./window";

describe("resolveDueIso", () => {
  it("uses 11:59 PM Los Angeles time for PDT and PST dates", () => {
    expect(resolveDueIso({ kind: "date", date: "2026-07-15" })).toEqual({
      ok: true,
      iso: "2026-07-16T06:59:00.000Z",
    });
    expect(resolveDueIso({ kind: "date", date: "2026-12-15" })).toEqual({
      ok: true,
      iso: "2026-12-16T07:59:00.000Z",
    });
  });

  it("uses a supplied time override", () => {
    expect(
      resolveDueIso({ kind: "date", date: "2026-07-15" }, "10:30"),
    ).toEqual({ ok: true, iso: "2026-07-15T17:30:00.000Z" });
  });

  it("rejects a nonexistent spring-forward time", () => {
    expect(
      resolveDueIso({ kind: "date", date: "2027-03-14" }, "02:30"),
    ).toMatchObject({ ok: false });
  });

  it("returns a timed due value unchanged", () => {
    const iso = "2026-10-20T19:00:00.000Z";
    expect(resolveDueIso({ kind: "datetime", iso })).toEqual({ ok: true, iso });
  });
});

describe("the import window", () => {
  const now = new Date("2026-10-01T19:00:00.000Z");

  it("includes exactly now but not an instant just before now", () => {
    expect(isInImportWindow("2026-10-01T18:59:59.999Z", now)).toBe(false);
    expect(isInImportWindow(now.toISOString(), now)).toBe(true);
  });

  it("includes the last minute of day 70 and excludes day 71", () => {
    expect(isInImportWindow("2026-12-11T07:59:00.000Z", now)).toBe(true);
    expect(isInImportWindow("2026-12-11T08:00:00.000Z", now)).toBe(false);
  });

  it("uses a Los Angeles midnight across the fall daylight-saving change", () => {
    expect(importWindowEnd(now).toISOString()).toBe(
      "2026-12-11T08:00:00.000Z",
    );
  });
});
