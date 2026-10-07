# Runway Progress

## Decisions

- Runtime versions: Node.js 24.21.0 and npm 11.19.0.
- Framework version: Next.js 16.3.8.
- Used `eslint .` because this Next.js version does not provide `next lint`.
- Installed Vitest 4.1.11 because Vitest 5.0.3 requires newer Node type definitions than the generated Next.js scaffold.
- Initialized shadcn/ui with its current default `base-nova` preset; removed the automatically generated sample button so no shadcn components are included.
- Configured production builds to use Next.js webpack mode because Turbopack's CSS worker cannot bind its internal port in the project environment.
- `agentRules: false` in `next.config.ts` is kept on purpose. It stops `next dev` from modifying the required `AGENTS.md` or generating `CLAUDE.md`. It does not affect the deployed app. The Orchestrator confirmed keeping it.
- Supabase browser and server clients live in `src/lib/db`, matching the project layout. The Supabase CLI installed and ran without requiring install-script approval, so no package scripts were approved.
- Live Vercel URL: https://runway-xi-ten.vercel.app

## Known issues

- npm audit reports 9 high findings from one braces advisory. No non-breaking fix exists. The only fixes are forced major downgrades of shadcn and eslint-config-next, which were not applied. Moving shadcn to devDependencies reduced the runtime audit result to 0 high findings.

## Log

### P0-T1 — Project skeleton

- Created a Git-tracked Next.js app with TypeScript strict mode, App Router, Tailwind CSS, ESLint, the `src/` layout, and the `@/*` import alias.
- Initialized shadcn/ui without retaining any generated components.
- Added Vitest with a passing scheduler test and configured typecheck, lint, and one-shot test scripts.
- Added the required project folders, environment-variable template, and minimal Runway placeholder homepage.
- Verified typecheck, lint, one test, production build, and the live homepage successfully; confirmed only `.env.example` is present and its exception overrides the `.env*` ignore rule.
- Confirmed `AGENTS.md` retained its original SHA-256 checksum: `392f51740eb2b96c225c83aa5eaad285ef162ff316e54c4cf3bf6c865518fbb5`.
- Decisions: used the tool and version choices recorded above.
- Known issues: dependency audit and external lockfile warning recorded above.

### P0-T2 — Temporary GitHub repository validation

- Created a temporary private GitHub repository and connected it as `origin` during setup; it was later deleted before public-release preparation.
- Pushed the local `main` branch and confirmed the repository visibility is private.
- Confirmed the remote contains `AGENTS.md`, `PROGRESS.md`, and the application code.
- Confirmed `.env.example` is the only environment-type file tracked on GitHub.
- Decisions: used the existing authenticated GitHub account and HTTPS Git protocol configured by GitHub CLI.
- Known issues: none introduced by this task.

### P0-T2-a — Public repository preparation

- Added the MIT license and a public project README.
- Added the `ALLOWED_EMAIL` variable name to the environment template.
- Switched all commit author and committer identities to the configured GitHub noreply identity.
- Completed the personal-data scan and removed disallowed references from project documentation.
- Rebuilt Git history as one clean commit because the earlier local commits contained a local machine path.
- Decisions: retained the authorized public owner identity and project context while removing disallowed data.
- Known issues: none introduced by this task.

### P0-T2-b — Public GitHub repository connected

- Published the repository at https://github.com/Muffi7869/runway with public visibility.
- Confirmed the repository is MIT licensed and contains the prepared public README.
- Verified the working tree contained no secrets or disallowed environment files before publishing.
- Decisions: secret scanning and push protection remain for Mufaddal to enable manually in GitHub settings.
- Known issues: secret scanning and push protection are not yet confirmed enabled.

### P0-T3 — Vercel deployment live

- Connected the GitHub repository to Vercel and confirmed the first deployment succeeded.
- Added the visible `v0.0.1` marker to test automatic deployments from the `main` branch.
- Decisions: recorded the live deployment URL above.
- Known issues: none introduced by this task.

### P0-T3-b — Phase 0 report

- Wrote the Phase 0 report with requirement status, changed files, verification output, known issues, setup status, testing instructions, commits, and the remaining review question.
- Decisions: normalized machine-specific paths and package banners in public verification output.
- Known issues: GitHub secret scanning and push protection still need manual confirmation.

### P0-FIX — Phase 0 cleanup

- Set `turbopack.root` and `outputFileTracingRoot` to one project-root value computed by the Next.js configuration.
- Confirmed the non-forced audit attempt left the result at 9 high findings and 0 critical findings, with no dependency changes retained.
- Pinned the project to Node.js 24 through package engine metadata and `.nvmrc`.
- Decisions: did not apply forced major downgrades or move shadcn between dependency groups.
- Known issues: the audit finding and pending Orchestrator decision are recorded above.

### P0-FIX-c — shadcn development dependency

- Moved shadcn from dependencies to devDependencies without changing its version or adding packages.
- Confirmed the only application use is a build-time stylesheet import; the shadcn configuration also references its schema, and there are no runtime imports.
- Confirmed npm audit reports 9 high findings overall and 0 high findings for runtime dependencies.
- Decisions: retained `agentRules: false` as confirmed by the Orchestrator.
- Known issues: the development-only audit findings remain because no non-breaking fix exists.

### P1-T1-a — Supabase clients and CLI

- Added `@supabase/supabase-js` 2.117.2 and `@supabase/ssr` 0.12.7 as application dependencies, plus Supabase CLI 2.120.0 as a development dependency.
- Initialized the local Supabase configuration non-interactively without IDE settings.
- Created browser and server clients in `src/lib/db` with clear environment-variable validation and cookie handling for Server Components.
- Decisions: no CLI install-script approval was needed, and no package scripts were approved.
- Manual step: Mufaddal will link the CLI to the Supabase project by hand; Codex did not log in, link, or push database changes.
- Known issues: none introduced by this task.

### P1-T2-a — Core schema migration

- Wrote one migration for all eight core tables, their named constraints, automatic `updated_at` triggers, and Row Level Security policies.
- Added exactly three authenticated policies per table for select, insert, and update; no delete or anonymous policies were added.
- Decisions: sessions use one row per step touched, with direct step and assignment references plus before/after percentages. This keeps per-class pace calculations simple to aggregate and preserves foreign-key enforcement for the step.
- Manual step: the migration has not been applied; Mufaddal will review and push it to Supabase by hand.
- Known issues: none introduced by this task.

### P1-T2-b — Generated database types

- Added the database types generated from the live Supabase schema, covering all eight core tables.
- Typed both the browser and server Supabase clients with the generated `Database` type.
- Decisions: kept the generated types file unchanged and made no runtime or schema changes.
- Known issues: none introduced by this task.

### P1-T3-a — Owner check and tests

- Added a pure owner-email comparison helper that trims and lower-cases both inputs.
- Added unit coverage for matches, mismatches, capitalization, whitespace, missing user email, and every missing allowed-email form.
- Decisions: the helper fails closed when either value is absent or blank and does not read environment variables or log values.
- Known issues: none introduced by this task.

### P1-T3-b — Google sign-in with owner lock

- Added Google sign-in, the OAuth callback, owner-only route protection, a private-app notice, and sign-out.
- Moved the existing homepage into a protected route group with a minimal header.
- Decisions: used `src/proxy.ts`, as required by the installed Next.js version. The public paths are `/login`, `/auth/callback`, and `/private`.
- Decisions: Google sign-in uses `prompt=select_account` so the owner can choose a different account while testing, without requesting extra scopes or offline access.
- Known issues: real Google sign-in requires browser testing by Mufaddal.

### P1-T4-a — Settings validation and tests

- Added shared Zod validation for settings inputs using integer minutes and days, including the requested relational rules and boundary checks.
- Added optional HTTPS-only Canvas feed validation with error messages that do not echo submitted values.
- Added hours-and-minutes conversion helpers and unit tests for all requested rules and boundaries.
- Decisions: kept the schema client-safe and shared, with no server-only code or additional validation limits.
- Known issues: none introduced by this task.

### P1-T4-b — App shell and settings gate

- Extended the protected header with navigation for Week, Assignments, Classes, and Settings while retaining sign-out.
- Added the four requested placeholder pages and changed the root route to redirect to Week.
- Added a shared server gate that authenticates the owner, reads only the required non-secret settings columns, and redirects incomplete settings to the Settings page.
- Decisions: every protected page calls the gate directly except Settings, which calls the owner check directly to avoid a redirect loop.
- Known issues: none introduced by this task.

### P1-T4-c — Settings page

- Added the owner-only Settings form with shared client and server validation, controlled inputs, and field-level errors.
- Added settings upsert behavior using the authenticated user ID and the fixed `America/Los_Angeles` timezone.
- Kept the Canvas feed URL secret by reading only a server-side saved-status count, returning only a boolean, and preserving an existing value when no replacement is submitted.
- Decisions: existing non-secret settings are prefilled; a new form starts empty except for the required 23:30 check-in default.
- Known issues: none introduced by this task.

### P1-T4-d — Classes page

- Added the owner-scoped Classes page with controlled forms for adding, renaming, and recoloring classes.
- Added one fixed eight-color palette and pure server-side validation for trimmed non-empty names and palette colors.
- Displayed each class pace ratio read-only to one decimal place and added unit coverage for class validation.
- Decisions: `classes.color` stores the stable palette key; pace ratios are never accepted from or written by the client actions.
- Known issues: none introduced by this task.

### P1-T4-c-fix1 — Settings time parsing

- Fixed the settings time parsing failure caused by representing unparseable time strings as `NaN`, which exposed technical Zod errors and prevented saving.
- Added one shared parser for form and database time strings plus one shared formatter for form and database boundaries.
- Added plain-English required-field messages and regression tests for valid, malformed, empty, and round-trip time values.
- Decisions: kept minutes since midnight as the form and validation representation and retained database time strings only at the database boundary.
- Known issues: none introduced by this task.

### P1-T4-e — Phase 1 report

- Wrote the Phase 1 report with implementation status, database decisions, changed files, fresh verification output, audit totals, manual checks, setup status, and testing instructions.
- Decisions: applied the established public-safety substitutions to machine-specific verification output without changing results or pass counts.
- Known issues: the development-only audit findings remain documented in the report.

### P1-FIX-a — Settings validation rules

- Confirmed the nine-table contract defines `session_steps` with its session and step links, allowed progress values, and progress ordering, while `sessions` no longer contains step progress fields.
- Added the 15-minute minimum block rule and the rule requiring the study window to fit at least one minimum block, with boundary and message tests.
- Rules audit: Zod already enforced maximum block versus minimum block and daily maximum versus maximum block; the two new rules were missing. The current migration has none of the four relationship constraints.
- Decisions: used the explicit `session_id` now present in the updated contract; no fallback to the brief was needed.
- Known issues: database enforcement for these four rules remains for the separate database-fix task.
