# Phase 1 Report

## 1. Summary

Phase 1 connected Runway to Supabase, established the complete eight-table schema with Row Level Security, and generated typed database clients. Google sign-in now limits the application to its single owner, while all other accounts are denied and signed out. The protected app shell requires valid settings before other pages can be used, and the Settings and Classes pages provide the first persistent workflows. Manual checks confirm the database, authentication, settings gate, secret handling, class persistence, and live deployment all work as intended.

## 2. Requirement check

- **Done — Supabase clients and local tooling:** Typed browser and server clients are configured, and the local CLI setup is initialized.
- **Done — Core database schema:** All eight contract tables, constraints, update triggers, and owner-scoped policies are defined in one migration.
- **Done — Migration deployment:** The CLI is linked, the migration is applied, and the Table Editor shows all eight tables with Row Level Security enabled.
- **Done — Database constraint check:** A step progress value outside the allowed set was rejected during manual testing.
- **Done — Generated database types:** The checked-in types were generated from the deployed schema and are used by both clients.
- **Done — Owner check:** Email comparison is normalized, unit tested, and fails closed when the allowed owner value is absent.
- **Done — Google sign-in:** Sign-in works locally and on the live deployment.
- **Done — Single-owner enforcement:** A second account is shown the private-app notice and remains signed out.
- **Done — Protected app shell:** Navigation, sign-out, and the Week, Assignments, Classes, and Settings routes are present.
- **Done — Settings-first gate:** First sign-in leads to Settings, and incomplete settings prevent access to the other protected pages.
- **Done — Shared settings validation:** Client and server use the same schema, relational rules, time conversion, and plain-English errors.
- **Done — Settings persistence:** Valid settings save successfully; invalid study-window ordering shows an error and saves nothing.
- **Done — Secret Canvas handling:** The saved feed value is never returned to the page, action state, HTML, errors, or logs; manual source inspection confirmed this.
- **Done — Classes workflow:** Classes can be added, renamed, and recolored; pace is displayed read-only and no delete action exists.
- **Done — Class persistence:** The entered Fall 2026 classes survive refresh, sign-out, and sign-in.
- **Done — Live parity:** The completed Phase 1 behavior works the same on the live deployment.
- **Done — Automated verification:** Typecheck, lint, 66 unit tests, and the production build pass.

## 3. Files changed

- `PROGRESS.md` — Records Phase 1 work, decisions, fixes, and known issues.
- `package.json` — Adds the Supabase client libraries, Supabase development CLI, and Zod.
- `package-lock.json` — Locks the Phase 1 dependency versions.
- `src/app/(app)/actions.ts` — Provides the authenticated sign-out action.
- `src/app/(app)/assignments/page.tsx` — Provides the protected Phase 3 placeholder.
- `src/app/(app)/classes/actions.ts` — Adds owner-authenticated create and update actions for classes.
- `src/app/(app)/classes/classes-manager.tsx` — Provides controlled add, rename, and recolor forms with read-only pace display.
- `src/app/(app)/classes/page.tsx` — Loads the owner's classes and renders the Classes workflow.
- `src/app/(app)/layout.tsx` — Defines the protected header, navigation, and sign-out control.
- `src/app/(app)/page.tsx` — Applies the settings gate and redirects the protected root to Week.
- `src/app/(app)/settings/actions.ts` — Validates and upserts settings without returning the secret feed value.
- `src/app/(app)/settings/page.tsx` — Loads only non-secret settings and a server-computed secret-presence boolean.
- `src/app/(app)/settings/settings-form.tsx` — Provides the controlled Settings form with shared client validation.
- `src/app/(app)/week/page.tsx` — Provides the protected Phase 2 placeholder.
- `src/app/auth/callback/route.ts` — Completes the authentication code exchange and owner check.
- `src/app/login/page.tsx` — Provides the public sign-in page.
- `src/app/login/sign-in-button.tsx` — Starts Google sign-in without requesting extra scopes.
- `src/app/page.tsx` — Was replaced by the protected route-group root page.
- `src/app/private/page.tsx` — Explains that unauthorized accounts cannot use the application.
- `src/lib/auth/owner.test.ts` — Tests normalized owner matching and fail-closed behavior.
- `src/lib/auth/owner.ts` — Implements the pure owner comparison.
- `src/lib/auth/server.ts` — Provides server-only owner status and redirect helpers.
- `src/lib/classes/palette.ts` — Defines the fixed eight-color class palette.
- `src/lib/classes/validation.test.ts` — Tests class name and palette validation with made-up data.
- `src/lib/classes/validation.ts` — Validates and trims class inputs.
- `src/lib/db/.gitkeep` — Was removed after real database client files were added.
- `src/lib/db/client.ts` — Creates the typed browser Supabase client.
- `src/lib/db/database.types.ts` — Contains generated types for the deployed schema.
- `src/lib/db/server.ts` — Creates the typed server Supabase client with cookie handling.
- `src/lib/settings/schema.test.ts` — Tests settings rules, boundaries, messages, and time conversion.
- `src/lib/settings/schema.ts` — Defines shared settings validation and minute/time helpers.
- `src/lib/settings/server.ts` — Enforces completion of required non-secret settings.
- `src/proxy.ts` — Refreshes authentication and denies non-owner access before protected routes run.
- `supabase/.gitignore` — Excludes local Supabase state from version control.
- `supabase/config.toml` — Stores the local Supabase CLI configuration without project credentials.
- `supabase/migrations/.gitkeep` — Was removed when the first migration was added.
- `supabase/migrations/20261006193929_create_core_tables.sql` — Creates all tables, constraints, triggers, and Row Level Security policies.

## 4. Database changes

**Data-model change:** Phase 1 created the full contract schema: `settings`, `classes`, `fixed_events`, `assignments`, `steps`, `blocks`, `sessions`, and `blocked_days`. Every table has owner identity, creation time, and update time fields; Row Level Security is enabled on every table with authenticated select, insert, and update policies scoped to the current owner. Constraints enforce the documented assignment types, weights and statuses, block statuses, nonnegative minute fields, positive pace ratios, allowed step progress values, and per-owner uniqueness for imported assignment identifiers.

The `sessions` design stores one row per step touched, with direct assignment and step references plus progress before and after the work session. This makes class-level pace calculations straightforward to aggregate while retaining foreign-key validation and permanent session history.

The `classes.color` field stores a stable palette key rather than a presentation value. The eight keys are `blue`, `green`, `purple`, `orange`, `red`, `teal`, `pink`, and `yellow`; display colors are mapped in one constants file so presentation can change without rewriting stored rows.

## 5. Tests

Result summary: four required commands passed and zero failed. TypeScript and ESLint reported zero errors. Vitest reported 4 passing files and 66 passing tests, with zero failures. The production build compiled successfully and generated all nine application routes. The current audit reports 9 high-severity findings overall and 0 runtime findings; all 9 come from the known development-tooling advisory, for which npm offers only breaking forced changes.

The output below preserves the command results while applying the public-safety substitutions documented in section 6.

### `npm run typecheck`

```text
Now using node v24.21.0 (npm v11.19.0)

> runway 0.1.0 typecheck
> tsc --noEmit
```

### `npm run lint`

```text
Now using node v24.21.0 (npm v11.19.0)

> runway 0.1.0 lint
> eslint .
```

### `npm test`

```text
Now using node v24.21.0 (npm v11.19.0)

> runway 0.1.0 test
> vitest run


 RUN  v4.1.11 [project root]


 Test Files  4 passed (4)
      Tests  66 passed (66)
   Start at  18:41:15
   Duration  429ms (transform 323ms, setup 0ms, import 495ms, tests 23ms, environment 0ms)
```

### `npm run build`

```text
Now using node v24.21.0 (npm v11.19.0)

> runway 0.1.0 build
> next build --webpack

▲ Next.js 16.3.8 (webpack)
- Environments: .env.local
✓ Running next.config.ts took 80ms

  Creating an optimized production build ...
✓ Compiled successfully in 1403ms
  Running TypeScript ...
  Finished TypeScript in 850ms ...
  Collecting page data using 7 workers ...
  Generating static pages using 7 workers (0/11) ...
  Generating static pages using 7 workers (2/11)
  Generating static pages using 7 workers (5/11)
  Generating static pages using 7 workers (8/11)
✓ Generating static pages using 7 workers (11/11) in 154ms
  Finalizing page optimization ...
  Collecting build traces ...

Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /assignments
├ ƒ /auth/callback
├ ƒ /classes
├ ƒ /login
├ ○ /private
├ ƒ /settings
└ ƒ /week


ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

## 6. Deviations from the brief, and why

- The initial settings implementation duplicated a narrow time parser and used a non-number failure sentinel that exposed technical validation wording. A follow-up fix introduced one shared parser and formatter, plain-English messages, and regression coverage without changing any validation rule.
- Verification output included a machine-specific working directory and npm package banners containing the literal at-sign character. Those strings were replaced with neutral wording in this public report; command results, timings, and pass counts are unchanged.
- No additional dependencies beyond the approved Supabase packages, Supabase CLI, and Zod were added.

## 7. Known issues and shortcuts

- npm reports 9 high-severity findings from one advisory in development tooling and 0 runtime findings. No non-breaking fix exists; the available forced changes would replace major tool versions and were not applied.
- Week and Assignments remain intentional placeholders for later phases.
- No Phase 1 functionality is known to be failing after the parsing fix and manual checks.

## 8. Setup needed from Mufaddal

- **Complete:** The three required deployment environment variables are configured, and the live site deploys successfully.
- **Complete:** The Supabase CLI is linked and the migration is deployed.
- **Complete:** All eight tables and their Row Level Security status were checked in the Table Editor.
- **Complete:** Google sign-in and owner-only rejection were tested locally and live.
- **Complete:** Settings gating, invalid-input rejection, class persistence, and secret-feed masking were tested locally and live.
- **Remaining:** None for Phase 1.

## 9. How to test it

1. Open https://runway-xi-ten.vercel.app and sign in with the configured owner account.
2. Confirm a first-time account is sent to Settings and cannot open Week, Assignments, or Classes until valid settings are saved.
3. Enter a study-window end before its start, submit, and confirm a clear error appears and nothing is saved.
4. Save valid settings, then confirm the protected navigation becomes available.
5. Save a valid HTTPS feed address, refresh Settings, and confirm only `Saved ••••` appears; inspect the page source and confirm the full value is absent.
6. Add a class using made-up test data, rename it, recolor it, and confirm pace remains read-only at one decimal place.
7. Sign out and back in, then confirm settings and classes persist. Remove any temporary made-up class through the database administration interface if cleanup is needed, because the app intentionally has no delete action.
8. Sign in with a different account and confirm the private-app notice appears and the account remains signed out.
9. Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` with Node.js 24; all commands should pass.

## 10. Commits

- `P1-T1: Supabase clients and CLI`
- `P1-T2: schema migration`
- `P1-T2: generated types`
- `P1-T3: owner check and tests`
- `P1-T3: Google sign-in with owner lock`
- `P1-T4: settings validation and tests`
- `P1-T4: app shell and settings gate`
- `P1-T4: settings page`
- `P1-T4: classes page`
- `P1-T4: fix settings time parsing`
- `P1: phase report`

## 11. Questions

None.
