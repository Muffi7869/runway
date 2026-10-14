import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppearanceSection } from "./appearance-section";

describe("AppearanceSection", () => {
  it("renders System, Light, and Dark theme choices", () => {
    const markup = renderToStaticMarkup(<AppearanceSection />);
    expect(markup).toContain("Appearance");
    expect(markup).toContain("System");
    expect(markup).toContain("Light");
    expect(markup).toContain("Dark");
  });
});
