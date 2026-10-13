import { afterEach, describe, expect, it } from "vitest";

import { verifyCronRequest } from "./auth";

const originalSecret = process.env.CRON_SECRET;

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = originalSecret;
  }
});

function request(authorization?: string): Request {
  return new Request("https://example.com/api/cron/test", {
    headers: authorization ? { authorization } : undefined,
  });
}

describe("verifyCronRequest", () => {
  it("rejects a missing header", () => {
    process.env.CRON_SECRET = "test-secret";
    expect(verifyCronRequest(request())).toBe(false);
  });

  it("rejects a wrong secret", () => {
    process.env.CRON_SECRET = "test-secret";
    expect(verifyCronRequest(request("Bearer wrong-secret"))).toBe(false);
  });

  it("accepts the exact bearer secret", () => {
    process.env.CRON_SECRET = "test-secret";
    expect(verifyCronRequest(request("Bearer test-secret"))).toBe(true);
  });

  it("fails closed when the configured secret is missing", () => {
    delete process.env.CRON_SECRET;
    expect(verifyCronRequest(request("Bearer test-secret"))).toBe(false);
  });

  it("rejects a different authorization prefix", () => {
    process.env.CRON_SECRET = "test-secret";
    expect(verifyCronRequest(request("Basic test-secret"))).toBe(false);
  });

  it("rejects a similar-length wrong secret", () => {
    process.env.CRON_SECRET = "test-secret";
    expect(verifyCronRequest(request("Bearer test-secreu"))).toBe(false);
  });
});
