# Phase 4 Report

## 1. Summary

Phase 4 added a pure deterministic scheduler, an owner-scoped server replan service, atomic planned-block replacement, planning warnings, class-colored Week blocks, automatic replan triggers, and an idempotent Google Calendar mirror. Future planned blocks are reconciled only against the verified Runway calendar using a private block identifier; unrelated calendar events are left untouched, and Google failures never undo the database plan. Authorization failures move the Google connection into its reconnect-required state, while transient failures are counted and surfaced quietly for a later retry. Fresh verification passes with 39 test files and 480 tests, but all live Google Calendar, phone, and browser checks remain explicitly unchecked for Mufaddal.

## 2. Requirement check

### P4-T1 — Pure scheduler and database support

1. **Done — Pure deterministic engine:** `src/lib/scheduler/plan.ts` accepts explicit inputs and performs no database or network calls; the repeated and shuffled-input test proves stable output.
2. **Done — Free-time calculation:** Study windows subtract fixed events with 15-minute padding, blocked days, protected blocks, and the past; dedicated tests cover each case and overlap prevention.
3. **Done — Remaining-minutes formula:** Remaining work applies estimate, incomplete percentage, and class pace ratio, then rounds upward to five minutes; 50-percent progress and 1.5 pace-ratio tests prove the calculation.
4. **Done — Working deadline and buffer:** The planner uses the buffered deadline unless it is already past, when it falls back to the real deadline; the fallback test proves this rule.
5. **Done — Assignment ordering:** Assignments sort by working deadline, weight, and stable identifier; the same-deadline weight-and-identifier test proves both tie breakers.
6. **Done — Even spreading:** Work is divided across eligible days before a final fill pass; the deadline-tomorrow test proves work appears on both available days.
7. **Done — Block size and last-piece rule:** Ordinary blocks respect configured minimum and maximum sizes, while the final remainder may be shorter; both behaviors have direct tests.
8. **Done — Daily cap:** Existing busy blocks count against the daily study limit, and the daily-cap test proves the resulting exact shortfall.
9. **Done — No overlaps and step order:** The planner avoids fixed events, protected blocks, and its own blocks and finishes an earlier step before beginning the next; both properties have direct tests.
10. **Done — Horizon behavior:** Planning stops at the six-week horizon and treats later-deadline remaining work as warning-free carryover; the horizon test proves this outcome.
11. **Done — Warnings:** Work that cannot fit before an in-horizon working deadline returns assignment identifier, exact minutes short, and first overflow day; exact-shortfall and overdue tests cover it.
12. **Done — Time and daylight saving:** Los Angeles wall-clock study windows are used without local-time getters; fall-back and spring-forward tests cover both clock changes.
13. **Done — Other required scheduler cases:** Tests cover abundant capacity, blocked days, completed steps, past rounding to the next 15-minute boundary, fixed-event padding, ordinary block limits, step sequencing, overdue work, and deterministic shuffled inputs.
14. **Done — Blocks delete policy:** `20261012024500_phase4_scheduler_schema.sql` adds one authenticated owner-scoped delete policy for blocks so the atomic planner function can replace future planned work.
15. **Done — Planning metadata:** The same migration adds nullable `settings.last_plan_warnings` and `settings.last_planned_at`; linked generated types expose both fields.
16. **Done — Atomic diff replacement:** `public.replace_planned_blocks` validates the complete requested block array, keeps matching rows and their Google event identifiers, deletes only stale future planned rows, inserts missing rows, and rejects steps outside active owner assignments.
17. **Done — SECURITY INVOKER:** The replacement function and updated step-save function both run as SECURITY INVOKER and grant execution only to authenticated callers.
18. **Done — Database checks:** The rollback-only replacement script covers matching-row preservation, stale-row deletion, checked-in history preservation, and rejection of a non-active assignment step; the task record states these checks were reviewed but not run against the live database in P4-T1.

### P4-T2 — Replan service, Week view, triggers, and carryovers

1. **Done — Server-only replan:** `src/lib/scheduler/replan.ts` is server-only, loads every owner input with explicit fields excluding specification text, runs the pure planner, and writes blocks only through the replacement function.
2. **Done — Stale fixed-event refresh:** A connected Google source older than 30 minutes is refreshed first; a refresh failure is recorded while planning continues from stored fixed events.
3. **Done — Six-week horizon:** Replan uses the established sync window end as the scheduler horizon.
4. **Done — Serialized owner calls:** A per-owner in-flight guard prevents concurrent in-process replans for the same owner while the database function provides atomic replacement.
5. **Done — Warning persistence:** Replan stores JSON warnings and planning time only after successful block replacement; a replacement failure leaves warning metadata untouched.
6. **Done — Owner-first action:** `replanAction` calls the owner requirement first, invokes replan, and revalidates Week and Assignments.
7. **Done — All approved triggers:** Successful step save, assignment create, assignment edit, Done, Drop, Restore, Canvas import, and Canvas due-date update call the same best-effort replan path.
8. **Done — Primary action safety:** `replanQuietly` contains planning failures so they cannot roll back or replace a successful assignment, step, status, or Canvas operation.
9. **Done — Week blocks:** The Week page loads planned blocks with explicit joined step, assignment, and class fields, labels them through a pure builder, colors them from the class palette, and combines them with gray fixed events before lane assignment.
10. **Done — Week warnings:** A pure builder validates stored warning shapes, includes only still-active assignments, and produces plain shortfall sentences; both valid and stale or malformed cases are tested.
11. **Done — Replan control:** The client control exposes a pending state, relative last-planned text, plain errors, refresh behavior, and the transient Google mirror retry message.
12. **Done — Regeneration block lock:** Both the server action and editor disable regeneration when any assignment step has any block; the pure decision helper tests every progress and block combination.
13. **Done — Future-planned step removal:** The updated step-save function deletes only future planned blocks for a removed step before deleting that step.
14. **Done — Historical-step protection:** Logged, missed, checked-in, or already-started scheduled work remains protected, and `RS004` maps to the fixed message explaining that already done or started work cannot be removed.

### P4-T3 — Google Calendar mirror

1. **Done — Runway calendar only:** `mirrorBlocks` obtains one calendar identifier from `ensureRunwayCalendar` and passes that same identifier to every future-event list, create, update, and delete call; the mock test asserts the only target is the Runway calendar.
2. **Done — Existing restricted scope:** No OAuth scope changed; the existing `calendar.app.created` scope remains the only write scope.
3. **Done — Exact event shape:** New and changed events use `Class · Assignment · Step`, description `Planned by Runway`, UTC date-times, and private property `runway_block_id`; the create test asserts the exact fictional format.
4. **Done — Future planned rows only:** The database query requires owner, status `planned`, and start at or after the injected current time, with explicit block and label columns.
5. **Done — Future event paging:** `listRunwayEvents` requests expanded future events with a restricted field list, follows page tokens, and exposes only the fields needed for reconciliation; its paging and field-selection test passes.
6. **Done — Idempotent create and repair:** Missing tagged events are created and their identifiers are written only to the matching owner block; three consecutive mirror runs prove later runs create and delete nothing.
7. **Done — Update only when needed:** Existing tagged events are updated only when title, start, or end differs by instant; the moved-block test proves update without duplicate creation.
8. **Done — Orphan reconcile:** Tagged future events with no corresponding future planned database block are deleted; the orphan test proves this behavior.
9. **Done — Untagged-event safety:** Future events without `runway_block_id` are never updated or deleted; the mixed orphan and untagged test proves it.
10. **Done — Duplicate collapse:** A matching stored Google event identifier wins; otherwise the earliest event wins deterministically, and extra tagged events are deleted. The stored-identifier duplicate test proves collapse to one.
11. **Done — Partial failure recovery:** Operations run with at most four workers, retry 429 and server errors once, continue after non-authorization failures, and count failures; a persistent third-create failure followed by a successful second run ends with exactly one event per block.
12. **Done — Authorization handling:** A 401 or reconnect-required token error changes connection status to reconnect-required and stops new work; the 401 test proves the state change. A server error is counted without changing status.
13. **Done — Gone deletes:** Delete responses with 404 or 410 are treated as successful reconciliation; the 410 test proves the required behavior.
14. **Done — Replan integration:** Mirroring runs only after block replacement and planning metadata succeed, is caught so it cannot fail replan, and therefore runs for the Replan button and every P4-T2 trigger.
15. **Done — UI outcome:** Replan returns transient mirror failure and reconnect outcomes without a migration; the client shows the exact quiet retry sentence or the existing reconnect guidance.
16. **Done — Secret and content handling:** No token, event body, title, or step name is logged, and no primary-calendar write path exists.

## 3. Files changed

- `AGENTS.md` — Adds the fast self-verification and consolidated manual-check workflow used during Phase 4.
- `PROGRESS.md` — Records P4-T1 through P4-T3 decisions, known issues, and end-of-build manual checks.
- `reports/phase-4.md` — Provides this Phase 4 review report.
- `src/lib/scheduler/types.ts` — Defines pure scheduler inputs, planned blocks, and warning outputs.
- `src/lib/scheduler/plan.ts` — Implements deterministic free-time scheduling and warnings.
- `src/lib/scheduler/plan.test.ts` — Covers scheduler rules, boundaries, daylight saving, overlaps, warnings, and determinism.
- `src/lib/scheduler/replan.ts` — Loads owner data, refreshes stale fixed events, replaces planned blocks atomically, stores warnings, and mirrors successful plans.
- `supabase/migrations/20261012024500_phase4_scheduler_schema.sql` — Adds block replacement support, planning metadata, block deletion policy, and future-planned step cleanup.
- `supabase/tests/replace_planned_blocks.sql` — Provides rollback-only replacement, preservation, and ownership checks.
- `supabase/tests/save_assignment_steps_rs004.sql` — Updates rollback-only step-removal checks for future planned versus protected work.
- `src/lib/db/database.types.ts` — Adds generated planning metadata and replacement-function types.
- `src/app/(app)/week/actions.ts` — Adds the owner-first Replan action.
- `src/app/(app)/week/page.tsx` — Loads warnings and planned blocks and combines them with fixed events in the Week grid.
- `src/components/replan-controls.tsx` — Adds the Replan button, planning timestamp, and mirror outcome messages.
- `src/components/week-grid.tsx` — Supports class-color styling for planned block events.
- `src/lib/week/presentation.ts` — Builds planned-block labels and safe active-assignment warning sentences.
- `src/lib/week/presentation.test.ts` — Tests label and warning presentation helpers.
- `src/app/(app)/assignments/actions.ts` — Triggers best-effort replan after assignment and status mutations.
- `src/app/(app)/assignments/canvas-actions.ts` — Triggers best-effort replan after Canvas imports and deadline updates.
- `src/app/(app)/assignments/steps-actions.ts` — Triggers best-effort replan after atomic step saves.
- `src/app/(app)/assignments/breakdown-actions.ts` — Rejects regeneration when any saved step has a block.
- `src/app/(app)/assignments/[id]/breakdown/page.tsx` — Loads the assignment block lock for the editor.
- `src/app/(app)/assignments/[id]/breakdown/step-editor.tsx` — Disables regeneration and displays the matching scheduled-breakdown note.
- `src/lib/steps/regeneration.ts` — Defines the pure regeneration-lock decision.
- `src/lib/steps/regeneration.test.ts` — Tests every progress and scheduled-block lock combination.
- `src/lib/steps/limits.ts` — Updates the protected-step removal message.
- `src/lib/steps/save-errors.ts` — Maps `RS004` to the fixed protected-history message.
- `src/lib/steps/save-errors.test.ts` — Tests the updated fixed error mapping.
- `src/lib/google/calendar-api.ts` — Adds paged future Runway-event listing and narrow create, update, and delete helpers.
- `src/lib/google/calendar-api.test.ts` — Tests future Runway-event paging and private-property field selection.
- `src/lib/google/block-mirror.ts` — Reconciles future planned blocks and Runway events idempotently with retry and authorization handling.
- `src/lib/google/block-mirror.test.ts` — Tests creation, updates, deletion, idempotence, duplicates, recovery, authorization, server failure, gone deletion, and calendar targeting.

### New dependencies

None. Phase 4 uses the existing Supabase client, Google fetch helpers, React, Next.js, and Vitest.

## 4. Database changes

**Data-model change:** Phase 4 adds nullable `settings.last_plan_warnings` JSON and nullable `settings.last_planned_at` timestamp fields. The linked generated database types confirm the applied schema exposes both fields and `public.replace_planned_blocks`.

The migration adds the authenticated owner-scoped delete policy required for the blocks table. No assignment or session delete policy is added. `public.replace_planned_blocks` is SECURITY INVOKER, validates ownership and active assignment state, rejects malformed or duplicate input blocks, preserves unchanged rows and their Google event identifiers, deletes only stale future planned rows, and inserts only missing rows.

The same migration revises `public.save_assignment_steps`: removing a step deletes its future planned blocks, while logged work and blocks that are checked in, missed, or already started remain protected by `RS001` or `RS004`. P4-T3 adds no migration or other schema change.

## 5. Tests

TypeScript and ESLint produced no errors. Vitest reported 39 passing files and 480 passing tests with zero failures. The production build compiled successfully and generated 16 application routes. The full audit reports 9 high-severity findings in development tooling and no critical findings; the runtime-only audit reports zero vulnerabilities.

Public-safe command output follows with only npm banners and the machine-specific project path removed.

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

 Test Files  39 passed (39)
      Tests  480 passed (480)
   Start at  13:54:17
   Duration  1.27s (transform 1.26s, setup 0ms, import 2.66s, tests 709ms, environment 6ms)
```

### `npm run build`

```text
> next build --webpack

▲ Next.js 16.3.8 (webpack)
- Environments: .env.local
✓ Running next.config.ts took 79ms
- Experiments (use with caution):
  · serverActions

  Creating an optimized production build ...
✓ Compiled successfully in 2.1s
  Running TypeScript ...
  Finished TypeScript in 1880ms ...
  Collecting page data using 7 workers ...
  Generating static pages using 7 workers (0/16) ...
  Generating static pages using 7 workers (4/16)
  Generating static pages using 7 workers (8/16)
  Generating static pages using 7 workers (12/16)
✓ Generating static pages using 7 workers (16/16) in 294ms
  Finalizing page optimization ...
  Collecting build traces ...

Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /api/google/callback
├ ƒ /api/google/connect
├ ƒ /assignments
├ ƒ /assignments/[id]/breakdown
├ ƒ /assignments/[id]/edit
├ ƒ /assignments/import
├ ƒ /assignments/new
├ ƒ /auth/callback
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

### `git log --oneline` — Phase 4 before the report commit

```text
ba7f6eb P4-2: replan service, Week blocks, triggers
5e33920 P4-1: scheduler engine and Phase 4 migration
```

### `git status --short`

```text
 M PROGRESS.md
 M src/components/replan-controls.tsx
 M src/lib/google/calendar-api.test.ts
 M src/lib/google/calendar-api.ts
 M src/lib/scheduler/replan.ts
?? reports/phase-4.md
?? src/lib/google/block-mirror.test.ts
?? src/lib/google/block-mirror.ts
```

### Manual checks

The following require the real deployed site, owner data, or a phone and remain for Mufaddal:

- [ ] Live Canvas import: fetch, import selected, fetch again shows Already imported, changed date shows Update and is never auto-applied.
- [ ] Canvas link stored as ciphertext in settings.canvas_feed_url_encrypted (looks like gibberish, plain column gone).
- [ ] Blocks appear on the phone's Google Calendar (Runway calendar).
- [ ] Replanning 3 times live leaves no duplicate events.
- [ ] Main (primary) calendar is untouched.
- [ ] Week page shows planned blocks in class colors next to gray events.
- [ ] Replan button works and the warning banner reads in plain words.
- [ ] Saving steps, adding, editing, Done, Drop, Restore, and Canvas import each trigger a replan.
- [ ] Regenerate is disabled once steps are scheduled.
- [ ] Deleting a step that has only future planned blocks works.

## 6. Deviations from the brief, and why

- Google Calendar supports filtering a private extended property only when its exact value is known. Reconciliation must also find orphan block identifiers whose values are no longer in the database, so the mirror lists future events from the verified Runway calendar with a restricted field set and inspects only the private `runway_block_id` locally.
- The mirror result is not persisted because the brief forbids a migration. The exact retry sentence is available immediately after a Replan button action; background triggers stay quiet, and a later replan retries reconciliation.
- Database rollback scripts were reviewed in P4-T1 but were not executed by Codex against live data. The migration was subsequently pushed by Mufaddal and its fields and function were confirmed through linked type generation in P4-T2.

## 7. Known issues and shortcuts

- The full npm audit reports 9 high-severity findings through the development-only `braces` advisory. Runtime dependencies report zero vulnerabilities. The available automated fix requires forced breaking package changes and was not applied.
- Real Google Calendar behavior cannot be proven with mocked tests alone. Phone display, three-run live idempotence, and primary-calendar safety remain unchecked manual items.
- The quiet transient mirror warning is return-state only by design and therefore is not retained across a full page reload.
- A first-time simultaneous Runway-calendar creation race can still create an extra calendar; the existing find-or-create logic reports extras and never deletes calendars.

## 8. Setup needed from Mufaddal

- **Complete:** The Phase 4 database migration was pushed and linked generated types expose planning metadata and the block replacement function.
- **Complete:** The existing Google connection uses the approved restricted Calendar scopes; Phase 4 requests no new scope.
- **Open:** Run every unchecked item copied into the Manual checks subsection above on the live deployment, including the three Google Calendar safety checks.
- **Open:** If the app shows reconnect-required status during testing, reconnect through Settings before repeating Replan.

## 9. How to test it

1. Open the live deployment, sign in as the configured owner, and ensure Settings shows Google Calendar connected with at least one fixed calendar selected.
2. Add a fictional active assignment and save a fictional breakdown. Confirm the Week page gains class-colored planned blocks beside gray fixed events.
3. Compare the Week blocks with the dedicated Runway calendar on a phone. Confirm each event uses the class, assignment, and step label and the planned description.
4. Press Replan three times without changing data. Confirm the Runway calendar has exactly one event per displayed block and no duplicates.
5. Change a step estimate or assignment deadline, save, and confirm moved or removed blocks reconcile on the Runway calendar while unchanged events remain.
6. Mark the assignment Done, then Restore it. Confirm each action replans and the Runway calendar removes and recreates only the appropriate future planned work.
7. Confirm the Week warning banner uses plain shortfall wording when work cannot fit and disappears when the shortfall is resolved.
8. Confirm Regenerate is disabled after any step has a block. Delete a fictional step that has only future planned blocks and confirm it succeeds; confirm a step with started or historical work remains protected.
9. Open the primary Google calendar and confirm no event was created, edited, or deleted there. Also confirm manually created untagged events on the Runway calendar remain untouched.
10. Run the fresh verification and audit commands shown in this report with Node.js 24 and compare the outputs.

## 10. Commits

- `P4-1: scheduler engine and Phase 4 migration`
- `P4-2: replan service, Week blocks, triggers`
- `P4-3: Google calendar mirror and Phase 4 report`

## 11. Questions

1. Did blocks appear correctly on the phone's Runway calendar after the deployment?
2. Did three unchanged live replans leave exactly one Google event per block?
3. Did inspection confirm the primary calendar remained untouched?
