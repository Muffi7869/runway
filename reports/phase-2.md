# Phase 2 Report

## 1. Summary

Phase 2 added a server-only Google Calendar connection with encrypted refresh-token storage, narrow read and app-created-calendar permissions, and wrong-account protections. Runway can find or create its dedicated calendar, let the owner choose fixed calendars, and synchronize six weeks of read-only fixed commitments into Supabase without duplicates. The Week page displays those commitments in Los Angeles time across desktop and phone layouts, including the November 2026 daylight-saving transition. Automated checks pass, all 19 testable manual checks are confirmed, and no manual check remains open; one check covering three special Google event types cannot be performed with a personal Gmail account and is covered by unit tests instead.

## 2. Requirement check

### Phase 2 brief

- **Done — Approved Calendar scopes:** The application defines and requests only `calendar.calendarlist.readonly`, `calendar.events.readonly`, and `calendar.app.created`; the scope list and missing-scope behavior are unit tested.
- **Done — Token encryption:** Refresh tokens are encrypted with AES-256-GCM before storage, use randomized initialization vectors, and are never sent to the browser or included in errors.
- **Done — Public privacy information:** The public privacy page states how calendar data is used and that it is not sent to an AI service.
- **Done — Google connection schema:** The tenth table stores encrypted token material, granted scopes, selected calendars, the Runway calendar reference, sync time, and connection status with owner-scoped Row Level Security.
- **Done — Connect and callback implementation:** Owner-only routes implement state validation, code exchange, scope checks, encrypted storage, reconnect status, and safe user-facing outcomes.
- **Done — Consent-screen publication:** The exact three scopes and “In production” publication are configuration requirements and are manually confirmed.
- **Done — Redirect URI configuration:** Local and live redirect URIs are configuration requirements and are manually confirmed.
- **Done — Connection UI end-to-end check:** The Connect and Connected states are built; their full flow is manually confirmed locally and on the live site.
- **Done — Wrong-account end-to-end check:** The code revokes and refuses mismatched accounts, the comparison is unit tested with made-up accounts, and the real flow is manually confirmed to show the required message and store nothing.
- **Done — Stored connection inspection:** Encryption and granted-scope persistence are built and unit tested where applicable; one row, unreadable ciphertext, and all three stored scopes are manually confirmed.
- **Done — Revoke and reconnect check:** Reconnect handling is built and its access-token paths are unit tested; revoking access, seeing Reconnect, and reconnecting are manually confirmed.
- **Done — Calendar listing and selection:** The picker lists eligible calendars without exposing the Runway calendar and validates selections against a fresh server-side list; calendar display and the saved choice are manually confirmed.
- **Done — Dedicated Runway calendar:** Find-or-create adopts an existing owned non-primary calendar named Runway or creates one and is unit tested; exactly one calendar after connection and reconnection is manually confirmed.
- **Done — Extra Runway calendar handling:** Extra-calendar detection, filtering, and no-delete behavior are built and unit tested; the notice, picker exclusion, and absence of deletion are manually confirmed.
- **Done — Deleted Runway calendar recovery:** Recovery and adoption paths are unit tested; reopening Settings after deletion is manually confirmed to recreate one calendar or adopt a suitable manually created one.
- **Done — Event mapping:** Cancelled, working-location, all-day, declined, and free events are skipped; out-of-office and focus-time events are retained; malformed events are counted rather than silently hidden. These rules are unit tested. All-day and free exclusions are manually confirmed; working-location, out-of-office, and focus-time cannot be tested on a personal Gmail account and are covered by unit tests only.
- **Done — Event fetch and sync planning:** Event pages are fetched with a narrow field list, mapped, and planned into inserts, updates, unchanged rows, and deletes.
- **Done — Synchronization engine:** The owner-only service fetches every chosen calendar before database writes, upserts fixed events, removes stale rows last, and records a successful sync time.
- **Done — Six-week data accuracy:** The six-week window is built and unit tested; fixed events matching real commitments for that window is manually confirmed.
- **Done — Add and delete propagation:** Insert and delete planning and synchronization are unit tested; a newly added event appearing and a removed event disappearing are manually confirmed.
- **Done — Event-type behavior:** The mapper is built and unit tested for all skip and retention rules. All-day and free exclusions are manually confirmed. Working-location, out-of-office, and focus-time cannot be tested on a personal Gmail account and are covered by unit tests only.
- **Done — Idempotency:** The composite database key and upsert logic are covered by automated tests; two consecutive synchronizations creating no duplicate rows is manually confirmed.
- **Done — Time-zone and DST logic:** Pure time helpers use Los Angeles calendar days and UTC instants, with tests around the November 2026 fall-back week.
- **Done — Week-view logic:** Week selection, bounds, day segmentation, overlap lanes, hour range, relative sync text, and time labels are pure and unit tested.
- **Done — Week page:** The protected page provides week navigation, sync controls, connection states, event blocks, overlap lanes, today highlighting, and read-only display.
- **Done — Desktop and phone layout:** Scoped layout rules show seven days on wider screens and one swipeable day on phones, with component and placement tests; the phone-width view is manually confirmed.
- **Done — Week accuracy:** Week and daylight-saving behavior are unit tested; this week, next week, and the week of November 1 are manually confirmed against Google Calendar.
- **Done — Not-connected Week banner:** The disconnected and reconnect-required Week states are built; the banner appearing after access is revoked is manually confirmed.
- **Done — Live parity:** Completed Phase 2 behavior on the live Vercel deployment is manually confirmed.
- **Done — Automated verification:** Typecheck, lint, 263 unit tests, and the production build pass.

### Orchestrator decisions

1. **Done — Google credentials:** `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are recorded as configured locally and in Vercel; only their names appear in the repository.
2. **Done — Shared encryption key:** PROGRESS records that local and Vercel deployments use the same `TOKEN_ENCRYPTION_KEY`; only the variable name appears in the repository.
3. **Done — Wrong-account protection:** The connect request provides a sign-in hint, the callback compares the primary calendar account case-insensitively, mismatches are revoked and never stored, the required message is present, and made-up-account tests pass. The real wrong-account flow and absence of storage are manually confirmed.
4. **Done — Sync window and deselection cleanup:** Synchronization covers Monday of the current Los Angeles week through the Monday 42 days later and deletes local fixed events belonging to deselected calendars.
5. **Done — Fixed-event uniqueness:** The P2-T3 migration adds uniqueness across owner, source calendar, and Google event identifiers, and synchronization upserts against that key.
6. **Done — Event-type policy:** Working-location entries are skipped, while out-of-office and focus-time entries are kept; all three cases are built and unit tested. They cannot be tested on a personal Gmail account and are covered by unit tests only.
7. **Done — No Runway-calendar placeholder:** The application lists first, deterministically adopts the first eligible owned Runway calendar, reports extras without deleting them, and creates only when no candidate exists. Exact-one, recovery, extra-notice, picker-exclusion, and no-delete behavior are manually confirmed.
8. **Done — Revoke test timing:** The test was correctly moved after P2-T2, and revoking access, seeing Reconnect, and reconnecting are manually confirmed.
9. **Done — Granted scopes persistence:** Every successful connection write includes the granted-scope string; the stored three-scope value is manually confirmed.
10. **Done — No empty-selection banner:** A connected account with no chosen fixed calendars does not receive an extra Week banner.

## 3. Files changed

- `.env.example` — Adds the token-encryption variable name without a value.
- `AGENTS.md` — Records the ten-table contract, approved scopes, encrypted-token rule, public-repository safeguards, and calendar-data privacy rule.
- `PROGRESS.md` — Records Phase 2 implementation decisions, follow-up fixes, and known issues.
- `reports/phase-2.md` — Provides this Phase 2 review report.
- `src/app/(app)/page.tsx` — Removes the former protected root page after the public landing page took its place.
- `src/app/(app)/settings/calendar-actions.ts` — Validates and saves chosen calendar identifiers against a fresh server-side Google list.
- `src/app/(app)/settings/calendar-picker.tsx` — Provides controlled calendar selection with retained failure state.
- `src/app/(app)/settings/page.tsx` — Loads connection status without token data, ensures the Runway calendar, and renders connection and picker states.
- `src/app/(app)/week/actions.ts` — Exposes the authenticated manual synchronization action.
- `src/app/(app)/week/page.tsx` — Loads the selected week, fixed events, settings, and safe connection fields for the Week page.
- `src/app/api/google/callback/route.ts` — Validates the callback, scopes, and account before encrypting and storing the refresh token.
- `src/app/api/google/connect/route.ts` — Starts the owner-only authorization flow with state protection and a sign-in hint.
- `src/app/login/page.tsx` — Adds access to the public privacy information.
- `src/app/page.tsx` — Provides the public landing page and owner continuation behavior.
- `src/app/privacy/page.tsx` — Provides the static public privacy page.
- `src/components/sync-controls.tsx` — Provides manual and automatic sync controls with safe status messages.
- `src/components/week-grid.module.css` — Defines scoped phone and seven-day grid geometry, event layers, and responsive behavior.
- `src/components/week-grid.test.tsx` — Verifies rendered day columns, shared coordinate containers, event offsets, lanes, and empty days.
- `src/components/week-grid.tsx` — Renders the read-only Week grid and phone day navigation.
- `src/lib/auth/routing.test.ts` — Tests exact public-route behavior and protected-route outcomes.
- `src/lib/auth/routing.ts` — Defines exact public routing decisions for the landing and privacy pages.
- `src/lib/crypto/tokens.test.ts` — Tests encryption round trips, randomization, tampering, invalid keys, and secret-free errors.
- `src/lib/crypto/tokens.ts` — Encrypts and decrypts refresh tokens with versioned AES-256-GCM payloads.
- `src/lib/db/database.types.ts` — Adds generated typing for `google_connection` and updated schema objects.
- `src/lib/google/access-token.test.ts` — Tests access-token refresh, reconnect state, unreadable tokens, and safe failures.
- `src/lib/google/access-token.ts` — Decrypts the stored refresh token server-side and obtains a fresh access token.
- `src/lib/google/calendar-api.test.ts` — Tests calendar and event pagination, strict request fields, creation, and safe API errors.
- `src/lib/google/calendar-api.ts` — Implements fetch-based calendar listing, calendar creation, and event listing.
- `src/lib/google/calendar-selection.test.ts` — Tests empty, valid, duplicate, excessive, and invalid calendar selections.
- `src/lib/google/calendar-selection.ts` — Defines shared calendar-selection validation.
- `src/lib/google/event-mapper.test.ts` — Tests fixed-event mapping, skip reasons, offsets, recurrence instances, and DST behavior.
- `src/lib/google/event-mapper.ts` — Maps minimal Google event data into fixed events or explicit skip reasons.
- `src/lib/google/oauth.test.ts` — Tests authorization parameters and case-insensitive account matching with made-up accounts.
- `src/lib/google/oauth.ts` — Builds authorization requests and performs pure account matching.
- `src/lib/google/request.ts` — Provides server-side Google request and safe error helpers.
- `src/lib/google/runway-calendar.test.ts` — Tests ready, adopt, create, extra-calendar, race, and failure paths.
- `src/lib/google/runway-calendar.ts` — Implements deterministic find-or-create with compare-and-set persistence.
- `src/lib/google/scopes.test.ts` — Tests the required scope set and missing-scope calculation.
- `src/lib/google/scopes.ts` — Exports the three approved Calendar scope URLs.
- `src/lib/google/sync-planner.test.ts` — Tests insert, update, delete, deselection, instant equality, and composite-key behavior.
- `src/lib/google/sync-planner.ts` — Purely plans fixed-event synchronization changes.
- `src/lib/google/sync-service.test.ts` — Tests successful, repeated, empty, filtered, reconnect, Google-failure, and database-failure synchronizations.
- `src/lib/google/sync-service.ts` — Coordinates owner-scoped fetch, mapping, upsert, deletion, and sync-time updates.
- `src/lib/time/zoned.test.ts` — Tests Los Angeles date math and the 169-hour daylight-saving week.
- `src/lib/time/zoned.ts` — Provides pure time-zone conversion, calendar arithmetic, and six-week bounds.
- `src/lib/week/placement.test.ts` — Tests event pixel offsets, proportional heights, minimum height, and clipping.
- `src/lib/week/placement.ts` — Computes reusable absolute event placement within an hour grid.
- `src/lib/week/view.test.ts` — Tests week parsing, day splitting, lanes, hour ranges, relative text, and time labels.
- `src/lib/week/view.ts` — Provides pure Week-view data and formatting logic.
- `src/proxy.ts` — Preserves authentication while allowing only the exact public landing and privacy routes through.
- `supabase/migrations/20261007030808_create_google_connection.sql` — Creates the tenth table, trigger, constraints, Row Level Security, and three owner policies.
- `supabase/migrations/20261007043429_fixed_events_delete_policy_and_unique_key.sql` — Adds the fixed-event composite unique key and the schema's sole delete policy.
- `supabase/tests/p2_t1_b_rollback.sql` — Provides rollback-only checks for the connection table and its constraints.

## 4. Database changes

**Data-model change:** Phase 2 adds `google_connection` as the tenth table. It stores one owner row containing encrypted refresh-token material, granted scopes, selected fixed-calendar identifiers, the Runway calendar identifier, last successful sync time, and either connected or reconnect-required status. It has the standard identity and timestamp fields, a non-cascading owner foreign key, per-owner uniqueness, the shared update-time trigger, Row Level Security, and authenticated owner-scoped select, insert, and update policies with no delete policy.

The fixed-events migration first refuses to continue if duplicate composite Google event keys already exist, then adds a unique constraint across `user_id`, `source_calendar_id`, and `google_event_id`. Synchronization uses that constraint for idempotent upserts. The same migration adds an authenticated owner-scoped delete policy to `fixed_events`; this is the only delete policy in the ten-table schema because synchronized fixed events are a rebuildable cache, while assignments, sessions, and other records retain their no-delete protections. No foreign key uses cascading deletion.

## 5. Tests

All four required commands passed. TypeScript and ESLint reported zero errors. Vitest reported 19 passing files and 263 passing tests, with zero failures. The production build compiled successfully and generated 14 application routes. The current dependency audit reports 9 high-severity findings overall, 0 critical findings, and 0 high-severity runtime findings.

Public-safe command output is reproduced below with the machine-specific working directory and package banners removed; pass counts and command results are unchanged.

### `npm run typecheck`

```text
> tsc --noEmit

PASS — 0 errors
```

### `npm run lint`

```text
> eslint .

PASS — 0 errors
```

### `npm test`

```text
> vitest run

Test Files  19 passed (19)
Tests       263 passed (263)
Failures    0
```

### `npm run build`

```text
> next build --webpack

Next.js 16.3.8 (webpack)
Compiled successfully
TypeScript completed
Static pages generated: 14 of 14
PASS — 0 build errors
```

### Dependency audit

```text
All dependencies: 9 high, 0 critical
Runtime dependencies: 0 high, 0 critical
```

## 6. Deviations from the brief, and why

- The synchronization window is explicitly Monday 00:00 in Los Angeles for the current week through Monday 00:00 42 days later. This approved boundary gives six complete calendar weeks and is tested across daylight-saving time.
- Synchronization also removes local fixed events from calendars the owner has deselected. This approved behavior prevents stale commitments from remaining visible after a selection change.
- Cancelled, working-location, all-day, declined, and free entries are skipped. Out-of-office and focus-time entries are retained because they represent unavailable time. These approved decisions are implemented with fixed reasons and tests.
- The Runway calendar uses find-or-create and never stores placeholder text. It adopts the first eligible owned match in deterministic order, reports additional matches, never deletes them, and creates only if none exists. A simultaneous first-time race can create an extra calendar; compare-and-set storage preserves one winner, and the extra is reported rather than deleted.
- Wrong-account protection uses both a sign-in hint and a case-insensitive primary-calendar account comparison. A mismatch is revoked and never stored, because accepting another account would violate the single-owner model.
- The first Week-grid implementation required two follow-up layout fixes. The final version uses one positioned coordinate box per day and scoped responsive CSS, with static-markup and placement tests preventing the reported below-grid and one-day desktop regressions.
- Verification output was shortened to counts and public-safe lines as explicitly required for this public report; machine paths and package banners were not copied.

## 7. Known issues and shortcuts

- Working-location, out-of-office, and focus-time behavior cannot be tested with a personal Gmail account. Their skip-or-keep behavior is covered by unit tests only.
- A simultaneous first-time find-or-create race can create an additional Runway calendar. The database winner is deterministic, extras are reported, and the app deliberately never deletes calendars.
- npm reports 9 high-severity development-tooling findings and 0 runtime findings. The available fixes require breaking forced changes and were not applied.
- No Phase 2 calendar event is editable or clickable; this is intentional because fixed commitments are read-only.

## 8. Setup needed from Mufaddal

- **Complete:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the same `TOKEN_ENCRYPTION_KEY` are recorded as configured locally and in Vercel.
- **Complete:** The consent screen contains exactly the three approved Calendar permissions and is published “In production.”
- **Complete:** Both local and live callback addresses are configured as authorized redirect URIs.
- **Complete:** Settings changes from Connect Google Calendar to Connected after authorization, locally and live.
- **Complete:** Connecting a different Google account shows the required private-account message and stores nothing.
- **Complete:** The database has one connection row, its token value is unreadable ciphertext, and its granted scopes contain all three approved scope names.
- **Complete:** Revoking access makes the app show Reconnect, and reconnecting restores access.
- **Complete:** Calendar selection, extra-calendar handling, Runway-calendar recovery, six-week synchronization, testable event filtering, duplicate prevention, the disconnected banner, Week accuracy, mobile layout, and live parity are manually confirmed.
- **Not testable with this account:** Working-location, out-of-office, and focus-time entries cannot be created by a personal Gmail account; their behavior is covered by unit tests.

## 9. How to test it

1. Open https://runway-xi-ten.vercel.app, sign in with the configured owner account, and open Settings.
2. If disconnected, choose Connect Google Calendar, approve exactly the three displayed Calendar permissions, and confirm Settings reports Connected.
3. In the database administration interface, confirm one connection row exists, the encrypted token is unreadable, and the granted-scope field contains the three approved scope names. Do not copy any values into an issue or report.
4. Select at least one fixed calendar in Settings, save, refresh, and confirm the choices remain selected. Confirm no calendar named Runway appears in the picker.
5. In Google Calendar, confirm exactly one owned calendar named Runway exists. Delete it, reopen Settings, and confirm one is recreated or a suitable manually created one is adopted.
6. Open Week and choose Sync now. Compare this week and next against Google Calendar, including a week crossing November 1, 2026.
7. Add a temporary fictional timed event in a chosen calendar, synchronize, and confirm it appears. Remove it, synchronize again, and confirm it disappears.
8. With fictional test entries, confirm all-day and working-location entries are absent while focus-time and out-of-office entries appear. Remove the temporary entries afterward.
9. Choose Sync now twice and confirm no duplicate database rows appear.
10. Test Week below and above the 768-pixel breakpoint: phones should show one swipeable day, while wider screens should show all seven days with events aligned to hour lines.
11. Connect with a different account and confirm the private-account message appears and no token is stored.
12. Revoke access from the Google account page, confirm Settings shows Reconnect, reconnect, and repeat one synchronization.
13. Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` with Node.js 24; all commands should pass.

## 10. Commits

- `P2-T1: scopes and encryption helpers`
- `P2-T1b: public privacy page and landing`
- `P2-T1: google_connection migration`
- `P2-T1: Google connect flow and token helper`
- `P2-T1: Google connection status UI`
- `P2-T2: calendar API helpers and Runway calendar find-or-create`
- `P2-T2: calendar picker`
- `P2-T3: time helper and event mapper`
- `P2-T3: events fetcher and sync planner`
- `P2-T3: fixed_events delete policy and unique key`
- `P2-T3: sync engine`
- `P2-T4: week view logic`
- `P2-T4: week view`
- `P2-T4: fix week event positioning`
- `P2-T4: fix week grid layout`
- `P2: phase report`

## 11. Questions

None.
