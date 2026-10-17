import { describe, expect, it } from "vitest";

import { computeMenuPosition } from "./popup-position";

const menu = { width: 180, height: 120 };
const viewport = { width: 800, height: 600 };

describe("computeMenuPosition", () => {
  it("opens below and right-aligns when it fits", () => {
    expect(computeMenuPosition({
      trigger: { top: 100, right: 500, bottom: 140, left: 460 },
      menu,
      viewport,
    })).toEqual({ top: 144, left: 320, placement: "below" });
  });

  it("flips above near the bottom", () => {
    expect(computeMenuPosition({
      trigger: { top: 540, right: 500, bottom: 580, left: 460 },
      menu,
      viewport,
    })).toEqual({ top: 416, left: 320, placement: "above" });
  });

  it("clamps at the left edge", () => {
    expect(computeMenuPosition({
      trigger: { top: 100, right: 60, bottom: 140, left: 20 },
      menu,
      viewport,
    }).left).toBe(8);
  });

  it("clamps at the right edge", () => {
    expect(computeMenuPosition({
      trigger: { top: 100, right: 900, bottom: 140, left: 860 },
      menu,
      viewport,
    }).left).toBe(612);
  });

  it("chooses the larger side and clamps when it fits on neither side", () => {
    expect(computeMenuPosition({
      trigger: { top: 200, right: 500, bottom: 240, left: 460 },
      menu: { width: 180, height: 300 },
      viewport: { width: 800, height: 400 },
    })).toEqual({ top: 8, left: 320, placement: "above" });
  });

  it("keeps the top-left corner inside a tiny viewport", () => {
    expect(computeMenuPosition({
      trigger: { top: 6, right: 22, bottom: 18, left: 10 },
      menu: { width: 120, height: 100 },
      viewport: { width: 80, height: 70 },
    })).toEqual({ top: 8, left: 8, placement: "below" });
  });
});
