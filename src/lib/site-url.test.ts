import { afterEach, describe, expect, it } from "vitest";

import { absoluteUrl, siteUrl } from "./site-url";

const original = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = original;
});

describe("site URL", () => {
  it("uses the configured URL and removes trailing slashes", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com///";
    expect(siteUrl()).toBe("https://example.com");
  });

  it("uses a request origin when the setting is absent", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(siteUrl("https://preview.example.com/path")).toBe("https://preview.example.com");
  });

  it("uses localhost when unset outside production", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(siteUrl()).toBe("http://localhost:3000");
  });

  it("builds absolute paths with or without a leading slash", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
    expect(absoluteUrl("privacy")).toBe("https://example.com/privacy");
    expect(absoluteUrl("/checkin")).toBe("https://example.com/checkin");
  });
});
