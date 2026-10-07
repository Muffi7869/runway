import { describe, expect, it } from "vitest";

import { GOOGLE_CALENDAR_SCOPES, missingScopes } from "./scopes";

const [calendarListScope, eventScope, appCreatedScope] =
  GOOGLE_CALENDAR_SCOPES;

describe("missingScopes", () => {
  it("returns an empty list when all required scopes are present", () => {
    expect(missingScopes(GOOGLE_CALENDAR_SCOPES.join(" "))).toEqual([]);
  });

  it("returns a required scope when it is missing", () => {
    expect(missingScopes(`${calendarListScope} ${appCreatedScope}`)).toEqual([
      eventScope,
    ]);
  });

  it("returns every required scope when none is granted", () => {
    expect(missingScopes("https://example.com/extra-scope")).toEqual(
      GOOGLE_CALENDAR_SCOPES,
    );
  });

  it.each([undefined, ""])(
    "returns every required scope for an absent value: %s",
    (granted) => {
      expect(missingScopes(granted)).toEqual(GOOGLE_CALENDAR_SCOPES);
    },
  );

  it("ignores extra granted scopes", () => {
    expect(
      missingScopes(
        `${GOOGLE_CALENDAR_SCOPES.join(" ")} https://example.com/extra-scope`,
      ),
    ).toEqual([]);
  });

  it("handles extra whitespace and duplicate scopes", () => {
    expect(
      missingScopes(
        `  ${calendarListScope}\n${eventScope}  ${eventScope}\t${appCreatedScope}  `,
      ),
    ).toEqual([]);
  });
});
