import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ addClass: async () => ({}), updateClass: async () => ({}) }));

import { ColorPopover, shouldCloseColorPopover } from "./classes-manager";

describe("ColorPopover", () => {
  it("renders all eight choices when open", () => {
    const markup = renderToStaticMarkup(<ColorPopover initialOpen name="color" onChange={() => undefined} selectedColor="blue" />);
    expect((markup.match(/role="radio"/g) ?? [])).toHaveLength(8);
    expect(markup).toContain('aria-expanded="true"');
  });

  it("recognizes Escape as the close key", () => {
    expect(shouldCloseColorPopover("Escape")).toBe(true);
    expect(shouldCloseColorPopover("Enter")).toBe(false);
  });
});
