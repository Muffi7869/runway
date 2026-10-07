import { timingSafeEqual } from "node:crypto";

import { GOOGLE_CALENDAR_SCOPES } from "./scopes";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const PRIMARY_CALENDAR_URL =
  "https://www.googleapis.com/calendar/v3/users/me/calendarList/primary";

type OptionalText = string | null | undefined;

export function buildAuthUrl({
  clientId,
  redirectUri,
  state,
  loginHint,
}: {
  clientId: string;
  redirectUri: string;
  state: string;
  loginHint?: string;
}): string {
  const url = new URL(GOOGLE_AUTH_URL);

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);

  if (loginHint?.trim()) {
    url.searchParams.set("login_hint", loginHint.trim());
  }

  return url.toString();
}

export function statesMatch(a: OptionalText, b: OptionalText): boolean {
  if (!a || !b) {
    return false;
  }

  const first = Buffer.from(a);
  const second = Buffer.from(b);

  return first.length === second.length && timingSafeEqual(first, second);
}

export function sameGoogleAccount(
  signedInEmail: OptionalText,
  primaryCalendarId: OptionalText,
): boolean {
  const normalizedEmail = signedInEmail?.trim().toLowerCase();
  const normalizedCalendarId = primaryCalendarId?.trim().toLowerCase();

  return Boolean(
    normalizedEmail &&
      normalizedCalendarId &&
      normalizedEmail === normalizedCalendarId,
  );
}

export async function verifyGoogleAccount({
  accessToken,
  signedInEmail,
  fetchImpl = fetch,
}: {
  accessToken: string;
  signedInEmail: OptionalText;
  fetchImpl?: typeof fetch;
}): Promise<"match" | "mismatch" | "unverified"> {
  try {
    const url = new URL(PRIMARY_CALENDAR_URL);
    url.searchParams.set("fields", "id");

    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      return "unverified";
    }

    const body: unknown = await response.json();
    const id =
      typeof body === "object" && body !== null && "id" in body
        ? (body as { id?: unknown }).id
        : undefined;

    if (typeof id !== "string" || !id.trim()) {
      return "unverified";
    }

    return sameGoogleAccount(signedInEmail, id) ? "match" : "mismatch";
  } catch {
    return "unverified";
  }
}
