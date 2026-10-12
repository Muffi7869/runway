import { describe, expect, it } from "vitest";

import { shouldShowNeedsSpec } from "./needs-spec";

describe("shouldShowNeedsSpec", () => {
  const needsSpecIds = new Set(["assignment-a", "assignment-b"]);

  it("tags an active assignment whose spec is missing", () => {
    expect(
      shouldShowNeedsSpec(
        { id: "assignment-a", status: "active" },
        needsSpecIds,
      ),
    ).toBe(true);
  });

  it.each(["done", "dropped"] as const)(
    "does not tag a %s assignment",
    (status) => {
      expect(
        shouldShowNeedsSpec({ id: "assignment-b", status }, needsSpecIds),
      ).toBe(false);
    },
  );

  it("does not tag an active assignment with a spec", () => {
    expect(
      shouldShowNeedsSpec(
        { id: "assignment-c", status: "active" },
        needsSpecIds,
      ),
    ).toBe(false);
  });
});
