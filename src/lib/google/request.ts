import type { NextRequest } from "next/server";

export const GOOGLE_CALLBACK_PATH = "/api/google/callback";
export const GOOGLE_STATE_COOKIE = "google_oauth_state";

function firstForwardedValue(value: string | null): string | undefined {
  return value?.split(",")[0]?.trim() || undefined;
}

export function getPublicOrigin(request: NextRequest): string {
  const forwardedHost = firstForwardedValue(
    request.headers.get("x-forwarded-host"),
  );
  const forwardedProto = firstForwardedValue(
    request.headers.get("x-forwarded-proto"),
  );

  if (forwardedHost && forwardedProto) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
}

export function getGoogleCredentials(): {
  clientId: string;
  clientSecret: string;
} {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is required.");
  }

  if (!clientSecret) {
    throw new Error("GOOGLE_CLIENT_SECRET is required.");
  }

  return { clientId, clientSecret };
}
