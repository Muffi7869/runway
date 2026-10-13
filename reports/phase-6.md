# Phase 6 Report

## 1. Summary

Phase 6 adds daily check-ins, durable session history, live per-class pace, nightly reminder and morning maintenance jobs, and owner-scoped rough-day and planned-day-off controls. Check-in writes are atomic in the database, pace is derived by pure tested math, and every successful check-in replans remaining work. Cron routes fail closed unless given the configured bearer secret, and only cron code can import the service-role client. Fresh application verification passes with 53 test files and 556 tests; the local SQL rollback suite could not start because neither Docker nor Podman is installed, and the remaining live checks are listed explicitly below.

## 2. Requirement check

### P6-1 — Schema, atomic check-in, and pace engine

1. **Done — Cross-instance replan serialization:** `public.replace_planned_blocks` takes a transaction-scoped advisory lock keyed from the owner identifier. The existing in-process per-owner guard remains in `src/lib/scheduler/replan.ts`; `supabase/tests/advisory_lock_replace.sql` covers both authenticated and explicit service-role owner paths.
2. **Done — Service-role owner path:** The replacement function accepts optional `p_user_id`, rejects mismatches for authenticated callers, permits it only for the service role when no authenticated owner exists, and remains SECURITY INVOKER.
3. **Done — Session uniqueness:** The migration rejects existing duplicates before adding one session per assignment and Los Angeles calendar date.
4. **Done — Blocked-day integrity:** The migration rejects existing duplicates, adds unique `(user_id, date)`, and adds an authenticated owner-scoped delete policy.
5. **Done — Atomic check-in function:** `public.save_checkin` is SECURITY INVOKER, resolves the authenticated owner, validates all input and ownership before writes, accepts only active owner assignments and their steps and blocks, and executes session, progress, and block-status writes in one transaction.
6. **Done — Same-day semantics:** A session is one row per assignment per Los Angeles day; another save replaces that day's actual minutes. A session-step conflict updates only `percent_after`, preserving the earliest `percent_before` for that day.
7. **Done — Progress and limits:** Minutes are restricted to 0–720, progress uses only 0/25/50/75/100, progress cannot go backward, and unique constraints prevent duplicate same-day sessions or duplicate step rows in a session.
8. **Done — Pace formula:** `computePace` implements `(60 + actual minutes) / (60 + estimated progress minutes)`, clamps to 0.5–3.0, and rounds to two decimals. Its tests cover faster and slower work, both clamps, rounding, multiple steps, combined sessions, and zero-progress sessions whose actual minutes still count.

### P6-2 — Check-in page and pace updates

1. **Done — Protected Check in page:** `/checkin` uses the owner and settings gates and is linked from the protected navigation.
2. **Done — Required work window and grouping:** The page loads today's work plus yesterday's unchecked planned or missed work and groups it by assignment. Today's already checked-in blocks are also included so a same-day check-in can be updated.
3. **Done — Safe progress controls:** Every step starts at its stored percentage and offers no lower percentage; the server reloads stored progress and strips unchanged values before calling the atomic function.
4. **Done — Minute controls:** Actual minutes are prefilled from planned work, rounded and clamped to 0–720, and validated again on the server and in the database.
5. **Done — Other work:** “Log other work” allows an active assignment without a scheduled block to be included in the same validated check-in.
6. **Done — Pace recomputation:** After an atomic save, every touched class is recomputed from all of its session history, including done and dropped assignments and zero-progress sessions, and `classes.pace_ratio` is updated.
7. **Done — Replan after check-in:** A successful check-in triggers the injected-client owner replan; a later pace or replan failure cannot undo the committed check-in.
8. **Done — Completion prompt:** Fully complete active assignments show “All steps done. Mark assignment done?” and reuse the existing owner-scoped Mark done action.
9. **Done — Live pace display:** The Classes page reads `pace_ratio` and explains the live two-decimal ratio in plain language.

### P6-3 — Cron jobs and server-only maintenance

1. **Done — Fail-closed authorization:** Both cron routes require the exact `Bearer CRON_SECRET` value and return 401 when the variable or header is missing or wrong. Constant-time digest comparison is unit-tested.
2. **Done — Single-owner resolution:** Cron code resolves exactly one configured owner through paginated admin user results and fails when none or more than one match.
3. **Done — Reminder contents and skip rule:** The reminder counts planned and checked-in blocks starting during the current Los Angeles day and sends only the count plus a check-in link. The route skips delivery when the count is zero.
4. **Done — Morning boundary:** The morning job computes the prior Los Angeles midnight correctly across daylight-saving changes, marks only earlier owner planned blocks missed, then replans and mirrors even if an earlier stage fails.
5. **Done — Injected owner services:** Replan and mirror accept a Supabase client and owner identifier, so authenticated actions and service-role cron execution use the same implementation without browser state.
6. **Done — Service-role boundary:** `SUPABASE_SERVICE_ROLE_KEY` appears only in `src/lib/db/service-client.ts`. A source-import test restricts that module to cron handlers.
7. **Done — Vercel schedules:** Current Hobby-plan constraints were checked when P6-3 was built. `0 6 * * *` places the reminder in the approved late-evening Los Angeles firing window, and `0 15 * * *` places morning processing after Los Angeles midnight in both daylight and standard time; hourly precision can vary by up to 59 minutes.
8. **Done — Resend sender caveat:** The default onboarding sender can send only to the account owner's address until a sender is verified; that constraint is documented without exposing an address.

### P6-4 — Rough day and Days off

1. **Done — Pure rough-day summary:** `summarizeRoughDay` compares only planned blocks starting on today's Los Angeles date, never returns negative moved minutes, and reports warnings that are new or have worsened. `describeRoughDay` produces the requested compact moved-time sentence or the nothing-planned sentence.
2. **Done — Rough day action:** The owner-first action snapshots today's plan and warnings, inserts today's `rough day` row using the authenticated owner, handles the uniqueness conflict plainly, replans, and returns only the moved-minutes result plus newly introduced or worsened active-assignment warnings.
3. **Done — Safe failure and Undo:** A failed replan keeps the saved day off and returns the quiet retry note. Undo deletes only the authenticated owner's row matching today and reason `rough day`, then replans.
4. **Done — Week control:** Week detects an existing rough-day row, shows Rough day or Undo rough day beside Replan, includes pending and dismiss states, and refreshes the server page after a successful change.
5. **Done — Days off list:** Settings loads explicit fields for owner rows dated today or later in Los Angeles, orders them by date, and includes rough-day rows.
6. **Done — Day-off validation:** A pure helper accepts only real non-past Los Angeles dates and the fixed travel, sick, or other reasons. Unit tests cover all choices, invalid dates, past dates, and a UTC-midnight boundary.
7. **Done — Add and remove:** Both actions require the owner first, take the owner identifier only from authentication, handle duplicate dates plainly, scope deletion by row and owner, and replan after successful changes. The ordinary Settings save does not touch `blocked_days`.
8. **Done — Responsive presentation:** Both controls use wrapping or grid layouts without fixed page widths, preserving phone-safe behavior.

## 3. Files changed

- `supabase/migrations/20261012150000_phase6_checkin_and_pace.sql` — Adds owner advisory locking, the service-role replan owner path, session and blocked-day uniqueness, blocked-day delete policy, and atomic check-in.
- `supabase/tests/advisory_lock_replace.sql` — Rollback-only checks for replan locking and owner resolution.
- `supabase/tests/save_checkin.sql` — Rollback-only checks for check-in ownership, same-day replacement, earliest progress, and block status.
- `src/lib/pace/compute.ts` and `src/lib/pace/compute.test.ts` — Pure pace formula, description, boundaries, and tests.
- `src/lib/pace/input.ts` and `src/lib/pace/input.test.ts` — Converts permanent session history into pace inputs and tests included statuses.
- `src/lib/checkin/view.ts`, `errors.ts`, and their tests — Pure check-in grouping, defaults, safe limits, and fixed database-error mapping.
- `src/app/(app)/checkin/page.tsx`, `checkin-form.tsx`, `checkin.module.css`, and `actions.ts` — Protected check-in UI, atomic save, pace update, replan, and completion prompt.
- `src/app/(app)/layout.tsx` — Adds Check in navigation.
- `src/app/(app)/classes/classes-manager.tsx` — Shows descriptive live pace.
- `src/app/(app)/assignments/actions.ts` — Lets the completion prompt reuse Mark done.
- `src/lib/db/database.types.ts` — Regenerated linked schema types for Phase 6 functions and constraints.
- `src/lib/db/service-client.ts` and `service-client-import.test.ts` — Server-only service-role client and import boundary.
- `src/lib/cron/auth.ts`, `owner.ts`, `time.ts`, `reminder.ts`, `morning.ts`, `handlers.ts`, and tests — Cron authorization, owner resolution, Los Angeles windows, reminder delivery, missed marking, and orchestration.
- `src/app/api/cron/reminder/route.ts`, `morning/route.ts`, and route tests — Protected Vercel cron endpoints.
- `src/lib/scheduler/replan.ts` — Supports an injected client and explicit owner while keeping the per-owner guard.
- `src/lib/auth/routing.ts` and its tests — Keeps cron API routes outside interactive login routing.
- `.env.example` and `vercel.json` — Declare the cron environment names and the two daily schedules.
- `src/lib/scheduler/rough-day.ts` and `rough-day.test.ts` — Pure moved-minutes and warning comparison with Los Angeles and DST coverage.
- `src/app/(app)/week/rough-day-actions.ts` — Owner-first rough-day save and Undo actions.
- `src/components/rough-day-controls.tsx` — One-tap Week control, result, warning, retry note, dismiss, and Undo states.
- `src/lib/settings/day-off.ts` and `day-off.test.ts` — Pure date and reason validation.
- `src/app/(app)/settings/days-off-actions.ts` and `days-off-section.tsx` — Owner-scoped Days off add, remove, list, and replan UI.
- `src/app/(app)/week/page.tsx` and `src/app/(app)/settings/page.tsx` — Wire the new controls to explicit owner queries.
- `PROGRESS.md` — Records Phase 6 work, decisions, known issues, and manual checks.
- `reports/phase-6.md` — Provides this evidence-based review.

### New dependencies

None.

## 4. Database changes

**Data-model and database behavior change:** The Phase 6 migration adds unique `(assignment_id, date)` on sessions, unique `(user_id, date)` on blocked days, and an authenticated owner-scoped delete policy on blocked days. It adds no table or column.

`public.replace_planned_blocks` now accepts an optional owner identifier for service-role cron calls, while preserving authenticated owner checks. It remains SECURITY INVOKER and takes a transaction advisory lock derived from the resolved owner before replacing future planned blocks.

`public.save_checkin` is a new SECURITY INVOKER function. It validates the complete owner-scoped request before writing, upserts one session per assignment per current Los Angeles date, replaces same-day actual minutes, preserves the earliest same-day `percent_before`, advances step progress only, and marks submitted owner blocks checked in atomically. Execute access is restricted to authenticated users.

The linked database types were regenerated at the start of P6-4 and already matched the live schema, so regeneration produced no file change. The migration's blocked-day uniqueness and delete policy were confirmed directly before building the P6-4 actions.

## 5. Tests

TypeScript and ESLint produced no errors. Vitest reported 53 passing files and 556 passing tests with zero failures. The production build compiled successfully and generated 19 application routes. The full audit reports 9 high-severity development-tool findings and no critical findings; the runtime-only audit reports zero vulnerabilities.

Public-safe command output follows with npm banners and the machine-specific project path removed.

### `npm run typecheck`

```text
> tsc --noEmit
```

### `npm run lint`

```text
> eslint .
```

### `npm test`

```text
> vitest run

 RUN  v4.1.11 [project]

 Test Files  53 passed (53)
      Tests  556 passed (556)
   Start at  22:36:24
   Duration  1.94s (transform 1.65s, setup 0ms, import 4.10s, tests 1.38s, environment 14ms)
```

### `npm run build`

```text
> next build --webpack

▲ Next.js 16.3.8 (webpack)
- Environments: .env.local
✓ Running next.config.ts took 112ms
- Experiments (use with caution):
  · serverActions

  Creating an optimized production build ...
✓ Compiled successfully in 2.5s
  Running TypeScript ...
  Finished TypeScript in 1768ms ...
  Collecting page data using 7 workers ...
  Generating static pages using 7 workers (0/17) ...
  Generating static pages using 7 workers (4/17)
  Generating static pages using 7 workers (8/17)
  Generating static pages using 7 workers (12/17)
✓ Generating static pages using 7 workers (17/17) in 373ms
  Finalizing page optimization ...
  Collecting build traces ...

Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /api/cron/morning
├ ƒ /api/cron/reminder
├ ƒ /api/google/callback
├ ƒ /api/google/connect
├ ƒ /assignments
├ ƒ /assignments/[id]/breakdown
├ ƒ /assignments/[id]/edit
├ ƒ /assignments/import
├ ƒ /assignments/new
├ ƒ /auth/callback
├ ƒ /checkin
├ ƒ /classes
├ ƒ /login
├ ○ /privacy
├ ○ /private
├ ƒ /settings
└ ƒ /week

ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

### `npm audit`

```text
# npm audit report

braces  *
Severity: high
braces vulnerable to stack-exhaustion denial of service through deeply nested patterns - https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
fix available via `npm audit fix --force`
Will install shadcn@1.0.0, which is a breaking change
node_modules/braces
  micromatch  >=0.2.0
  Depends on vulnerable versions of braces
  node_modules/micromatch
    fast-glob  *
    Depends on vulnerable versions of micromatch
    node_modules/@shadcn/registry/node_modules/fast-glob
    node_modules/@ts-morph/common/node_modules/fast-glob
    node_modules/fast-glob
    node_modules/shadcn/node_modules/fast-glob
      @next/eslint-plugin-next  >=14.3.0-canary.0
      Depends on vulnerable versions of fast-glob
      node_modules/@next/eslint-plugin-next
        eslint-config-next  >=14.3.0-canary.0
        Depends on vulnerable versions of @next/eslint-plugin-next
        node_modules/eslint-config-next
      @shadcn/registry  <=0.0.0-rc-20261007105214 || >=0.1.0
      Depends on vulnerable versions of fast-glob
      Depends on vulnerable versions of ts-morph
      node_modules/@shadcn/registry
        shadcn  <=0.0.0-rc-20261007105214 || >=2.0.0
        Depends on vulnerable versions of @shadcn/registry
        Depends on vulnerable versions of fast-glob
        Depends on vulnerable versions of ts-morph
        node_modules/shadcn
      @ts-morph/common  0.2.0 - 0.24.0 || 0.26.0 - 0.27.0
      Depends on vulnerable versions of fast-glob
      node_modules/@ts-morph/common
        ts-morph  6.0.1 - 23.0.0 || 25.0.0 - 26.0.0
        Depends on vulnerable versions of @ts-morph/common
        node_modules/ts-morph

9 high severity vulnerabilities

To address all issues (including breaking changes), run:
  npm audit fix --force
```

### `npm audit --omit=dev`

```text
found 0 vulnerabilities
```

### Local SQL rollback tests

The required local-only command was attempted. The Supabase CLI returned:

```text
{"_tag":"Error","error":{"code":"DockerLifecycleInspectError","message":"failed to inspect container health: docker: command not found (podman also not found) — install Docker Desktop or Podman and ensure it is on PATH"}}
```

Because the local stack did not start, no local database reset, SQL test, or stop command ran. No remote database command ran. The rollback scripts remain unexecuted by Codex.

### Signed-out route checks

```text
/week     307 location: /login
/settings 307 location: /login
```

### Source safety scans

```text
src/lib/db/service-client.ts:9:  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
src/app/(app)/settings/days-off-actions.ts:75:    .delete()
src/app/(app)/week/rough-day-actions.ts:186:    .delete()
src/app/api/google/callback/route.ts:61:  cookieStore.delete(GOOGLE_STATE_COOKIE);
src/lib/google/sync-service.ts:219:      .delete()
```

Every new server action calls `requireOwner()` before any other action work. The new mutations use only the authenticated owner identifier, explicit selected columns, and owner filters.

### `git log --oneline` — Phase 6 before the report commit

```text
2e581b0 P6-3: cron jobs, reminder email, injected-client replan
d7b823d P6-2: check-in page, pace updates, live pace
8424525 P6-1: Phase 6 schema, advisory lock, pace engine
```

### `git status --short` — before the report commit

```text
 M PROGRESS.md
 M src/app/(app)/settings/page.tsx
 M src/app/(app)/week/page.tsx
?? reports/phase-6.md
?? src/app/(app)/settings/days-off-actions.ts
?? src/app/(app)/settings/days-off-section.tsx
?? src/app/(app)/week/rough-day-actions.ts
?? src/components/rough-day-controls.tsx
?? src/lib/scheduler/rough-day.test.ts
?? src/lib/scheduler/rough-day.ts
?? src/lib/settings/day-off.test.ts
?? src/lib/settings/day-off.ts
```

### Manual checks

- [x] Live Canvas import: fetch, import selected, fetch again shows Already imported, changed date shows Update and is never auto-applied. (verified by Mufaddal, 2026-10-12)
- [x] Canvas link stored as ciphertext in settings.canvas_feed_url_encrypted (looks like gibberish, plain column gone). (verified by Mufaddal, 2026-10-12)
- [x] Blocks appear on the phone's Google Calendar (Runway calendar). (verified by Mufaddal, 2026-10-12)
- [x] Replanning 3 times live leaves no duplicate events. (verified by Mufaddal, 2026-10-12)
- [x] Main (primary) calendar is untouched. (verified by Mufaddal, 2026-10-12)
- [x] Week page shows planned blocks in class colors next to gray events. (verified by Mufaddal, 2026-10-12)
- [x] Replan button works and the warning banner reads in plain words. (verified by Mufaddal, 2026-10-12)
- [x] Saving steps, adding/editing/done/drop/restore, and Canvas import each trigger a replan. (verified by Mufaddal, 2026-10-12)
- [x] Regenerate is disabled once steps are scheduled. (verified by Mufaddal, 2026-10-12)
- [x] Deleting a step that has only future planned blocks works. (verified by Mufaddal, 2026-10-12)
- [ ] Second check-in the same day updates the session instead of duplicating.
- [ ] Slow progress at check-in pushes remaining work later.
- [ ] Classes page shows live pace.
- [ ] /checkin shows today's blocks grouped by assignment with minutes prefilled.
- [ ] Percent picker can't go below the saved value.
- [ ] Log other work adds an unscheduled assignment.
- [ ] All steps done prompt appears and Mark done works.
- [ ] Reminder email arrives around 11:30 PM (within the window the plan allows).
- [ ] Next morning an unchecked day shows as missed and the work moved to later days.
- [ ] Cron route without the secret returns 401 on the live site.
- [ ] Vercel Cron jobs listed in the project dashboard.
- [ ] Rough day shows "Moved ... to later days" and Undo restores the plan live.
- [ ] Days off: add a travel day, blocks move off it; remove it, plan returns.

## 6. Deviations from the brief, and why

- Phase 6 used four prompts instead of three so one database migration push could cover advisory locking, check-in atomicity, uniqueness, and blocked-day deletion before all UI work.
- The blocked-day delete policy and unique `(user_id, date)` rule moved into P6-1 rather than P6-4 so every later action could rely on the applied database safety rules.
- `replace_planned_blocks` gained optional `p_user_id` for service-role cron calls; authenticated callers still cannot select another owner.
- The check-in session date is always today's Los Angeles date, including when the displayed work originated yesterday, so a check-in remains one daily reflection.
- The reminder counts both planned and already checked-in blocks exactly as the brief specifies.
- The SQL rollback suite was attempted but not run because the required local container runtime is unavailable. It was not replaced with remote execution because the brief forbids remote SQL tests.

## 7. Known issues and shortcuts

- The full npm audit reports 9 high-severity findings through a development-only `braces` advisory. Runtime dependencies report zero vulnerabilities. The available automated fix requires forced breaking package changes and was not applied.
- The local rollback SQL scripts have not run because neither Docker nor Podman is installed. Static migration and test review plus linked type generation are not substitutes for executing those tests.
- Vercel Hobby cron schedules have hourly firing precision, so the reminder can arrive within the documented hour rather than at exactly 11:30 PM.
- Live Resend delivery, live cron authorization and dashboard registration, check-in workflows, rough-day behavior, and Days off behavior remain unchecked in the Manual checks list.
- The default Resend onboarding sender remains limited to the account owner's address until a sender is verified.

## 8. Setup needed from Mufaddal

- **Complete:** The Phase 6 migration was pushed before P6-4, and linked types expose the updated functions.
- **Complete:** The deployment configuration names the cron secret, service-role key, Resend key, and application URL without values in the public environment template.
- **Open:** Confirm both scheduled jobs are visible in the Vercel project dashboard.
- **Open:** Complete every unchecked item in the Manual checks subsection on the live deployment.
- **Open:** Install and start Docker Desktop or Podman if the Orchestrator wants Codex to execute the rollback SQL suite locally in a follow-up.

## 9. How to test it

1. Open the live app at https://runway-xi-ten.vercel.app and sign in as the owner.
2. Open Check in. Confirm today's work is grouped by assignment, minutes are prefilled, lower progress cannot be chosen, and Log other work can add an active unscheduled assignment.
3. Save a check-in twice on the same day and confirm one session is updated, remaining work replans, class pace changes, and the completion prompt appears when all steps reach 100 percent.
4. On Week, tap Rough day once. Confirm the result says how much work moved or that nothing remained, review any new shortfall lines, and use Undo to restore the plan.
5. In Settings, add a future travel day, confirm blocks move away from it, then remove the day and confirm the plan returns.
6. In Vercel, confirm both cron jobs are registered. Call a cron route without its secret and confirm 401. Confirm the reminder arrives in its allowed window and that the next morning moves unchecked work later.
7. Inspect the Classes page for live pace and verify the Runway calendar changes while the main calendar remains untouched.

## 10. Commits

- `P6-1: Phase 6 schema, advisory lock, pace engine`
- `P6-2: check-in page, pace updates, live pace`
- `P6-3: cron jobs, reminder email, injected-client replan`
- `P6-4: rough day, days off, Phase 6 report`

## 11. Questions

- Should the local SQL rollback suite be rerun in a follow-up after Docker Desktop or Podman is installed?
