export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
  "https://www.googleapis.com/auth/calendar.app.created",
] as const;

export type GoogleCalendarScope = (typeof GOOGLE_CALENDAR_SCOPES)[number];

export function missingScopes(
  granted: string | undefined,
): GoogleCalendarScope[] {
  const grantedScopes = new Set(
    (granted ?? "")
      .split(/\s+/)
      .map((scope) => scope.trim())
      .filter(Boolean),
  );

  return GOOGLE_CALENDAR_SCOPES.filter(
    (scope) => !grantedScopes.has(scope),
  );
}
