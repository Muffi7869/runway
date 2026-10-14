import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SignedOutShell } from "./signed-out-shell";

describe("SignedOutShell", () => {
  it("marks its invented product preview as decorative", () => {
    const markup = renderToStaticMarkup(
      <SignedOutShell action={<a href="/login">Continue with Google</a>} />,
    );

    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("Writing Studio");
    expect(markup).not.toMatch(/\b[A-Z]{2,5}\s?\d{1,3}\b/);
  });
});
