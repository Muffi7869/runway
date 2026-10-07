import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  getRouteAction,
  isPublicPath,
  skipsOwnerCheck,
} from "./routing";

const publicPaths = ["/", "/privacy", "/login", "/auth/callback", "/private"];

const protectedPaths = [
  "/week",
  "/assignments",
  "/classes",
  "/settings",
  "/api/google/connect",
  "/api/google/callback",
  "/privacy/extra",
  "/privacyx",
  "/privacy-policy",
];

describe("route access decisions", () => {
  it.each(publicPaths)("matches the public path exactly: %s", (pathname) => {
    expect(isPublicPath(pathname)).toBe(true);
  });

  it.each(protectedPaths)("keeps the path protected: %s", (pathname) => {
    expect(isPublicPath(pathname)).toBe(false);
    expect(getRouteAction(pathname, "anonymous")).toBe("redirect_login");
  });

  it("signs out a non-owner and sends them away from the landing page", () => {
    expect(getRouteAction("/", "not_owner")).toBe(
      "sign_out_and_redirect_private",
    );
  });

  it.each(protectedPaths)(
    "signs out a non-owner on a protected path: %s",
    (pathname) => {
      expect(getRouteAction(pathname, "not_owner")).toBe(
        "sign_out_and_redirect_private",
      );
    },
  );

  it("leaves a non-owner alone on the privacy page", () => {
    expect(skipsOwnerCheck("/privacy")).toBe(true);
    expect(getRouteAction("/privacy", "not_owner")).toBe("pass");
  });

  it("lets the owner reach the landing route", () => {
    expect(getRouteAction("/", "owner")).toBe("pass");
  });

  it("sends the owner away from the sign-in page", () => {
    expect(getRouteAction("/login", "owner")).toBe("redirect_root");
  });

  it("preserves the old public-path behavior", () => {
    expect(getRouteAction("/login", "anonymous")).toBe("pass");
    expect(getRouteAction("/auth/callback", "anonymous")).toBe("pass");
    expect(getRouteAction("/auth/callback", "not_owner")).toBe("pass");
    expect(getRouteAction("/private", "anonymous")).toBe("pass");
    expect(getRouteAction("/private", "not_owner")).toBe("pass");
  });
});

describe("privacy page source", () => {
  const source = readFileSync(
    new URL("../../app/privacy/page.tsx", import.meta.url),
    "utf8",
  );

  it.each([
    "Limited Use",
    "never sent to AI services",
    "myaccount.google.com",
    "https://github.com/Muffi7869/runway",
  ])("contains the required phrase: %s", (phrase) => {
    expect(source).toContain(phrase);
  });

  it("contains no email-address marker", () => {
    expect(source).not.toContain("@");
  });
});
