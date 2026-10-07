# AGENTS.md — Runway

Instructions for Codex. Read this file and `PROGRESS.md` at the start of every task. These rules override any default habits.

## What this app is

**Runway** is a single-user web app for a UCSD student. It:

1. Reads fixed commitments (classes, lab) from Google Calendar. These are never moved.
2. Takes assignments (typed in or imported from a Canvas calendar feed). The OpenAI API breaks each pasted spec into named steps with time estimates.
3. Schedules those steps into free time before each deadline and writes them to a dedicated Google calendar named **"Runway"**.
4. Runs a nightly check-in (reminder at 11:30 PM): the user marks each step's percent done (0/25/50/75/100) and the minutes worked.
5. Updates a per-class pace ratio from real sessions, then re-plans all remaining work.
6. Warns plainly when work no longer fits before a deadline.

## Team and workflow

- An **Orchestrator** (Claude) owns the plan and reviews all work. A **Prompt Writer** (Claude) turns the plan into the prompts you receive. **Mufaddal**, the user, is not a programmer and relays messages.
- Do only what the prompt asks. If something seems missing or wrong, say so in your reply. Don't silently expand scope.
- If a task would require changing the data model, the scheduler rules, or the tech stack, **stop and explain why** instead of doing it.
- When a step needs the user to act (create an account, copy a key, click a setting), give exact plain-English steps. Assume no coding knowledge.

## Tech stack (locked, do not substitute)

- Next.js, TypeScript (strict mode), App Router
- Tailwind CSS + shadcn/ui
- Supabase: Postgres, Google sign-in, Row Level Security on every table
- Google Calendar API (personal Gmail account)
- OpenAI API (server-side only)
- Vercel hosting and Vercel Cron for nightly jobs
- Resend for email
- Vitest for tests

Ask before adding any other dependency. Prefer the standard library and the stack above.

## Project layout

```
src/app/              pages and API routes
src/components/       UI components
src/lib/scheduler/    the scheduler (pure functions only) + tests
src/lib/pace/         pace math (pure functions only) + tests
src/lib/google/       Google Calendar client code
src/lib/ai/           OpenAI calls and response validation
src/lib/db/           Supabase queries
supabase/migrations/  every schema change, as SQL migration files
reports/              end-of-phase reports
PROGRESS.md           running log (see below)
```

## Data model (the contract, change only with Orchestrator approval)

| Table | Belongs to | Key fields |
| --- | --- | --- |
| settings | user | study window start/end, max study minutes per day, min/max block minutes, buffer days, timezone, check-in time (default 23:30), Canvas feed URL (treat as secret) |
| classes | user | name, color, pace_ratio (default 1.0) |
| fixed_events | user | title, start, end, google_event_id, source_calendar_id |
| assignments | class | class_id, title, type (assignment/exam), deadline, spec_text, weight (low/medium/high), status (active/done/dropped), ai_total_estimate_minutes, recurrence_rule (v2, nullable), canvas_uid (nullable, unique per user) |
| steps | assignment | assignment_id, name, order, estimated_minutes, percent_done (0/25/50/75/100) |
| blocks | step | step_id, start, end, planned_minutes, google_event_id, status (planned/checked_in/missed) |
| sessions | assignment | assignment_id, date, actual_minutes |
| session_steps | session | session_id, step_id, percent_before, percent_after (both 0/25/50/75/100, after ≥ before) |
| blocked_days | user | date, reason |
| google_connection | user | refresh_token_encrypted, granted_scopes, fixed_calendar_ids (list), runway_calendar_id, last_synced_at, status (connected/needs_reconnect). One row per user |

Every table has `id`, `user_id`, `created_at`, `updated_at`. Link columns (`*_id`) are foreign keys to the table named in "Belongs to" (`session_steps.step_id` links to steps). No foreign key cascades deletes.

## Hard rules

1. **Times:** store all timestamps in UTC. Display in `America/Los_Angeles`. Never use local-time getters for logic. Test across the Nov 1, 2026 DST change.
2. **Minutes are integers.** No fractional hours in the database.
3. **Never write, edit, or delete events on any Google calendar except "Runway".** Fixed events are read-only. This is enforced by OAuth scopes: the app requests only `calendar.calendarlist.readonly`, `calendar.events.readonly`, and `calendar.app.created`. Never request the full `calendar` or `calendar.events` scope.
4. **Secrets:** API keys, OAuth secrets, and the Canvas feed URL never appear in code, logs, or commits. Use `.env.local` (git-ignored) and Vercel environment variables. Keep `.env.example` updated with variable names only. The Google refresh token is encrypted (AES-256-GCM, key in `TOKEN_ENCRYPTION_KEY`) before it touches the database, and is never sent to the browser.
5. **AI and Google calls run server-side only.**
6. **Never hard-delete** assignments or sessions. Assignments get `status = dropped`. Sessions are permanent.
7. **AI output is untrusted.** Validate every OpenAI response against a strict schema (zod). Retry once on bad output, then show a clear error.
8. **The scheduler and pace math are pure functions.** Inputs in, outputs out, no database or network calls inside. Both must have Vitest tests.
9. **Re-planning only touches future blocks that aren't checked in.** Past and checked-in blocks are history.
10. **The repo is PUBLIC.** Nothing personal goes in code, commits, docs, `PROGRESS.md`, `reports/`, or test fixtures: no real calendar events, class schedules, emails, assignment specs, Canvas feed URLs, or local machine paths. His name, GitHub username, and the fact that he's a UCSD student are fine to show; they're already public through the LICENSE and commits. Tests use made-up data. Anything that needs a real value goes in an environment variable.
11. **Only one person may use the deployed app.** Sign-in is restricted to the email in the `ALLOWED_EMAIL` environment variable. Every other account is rejected before it can reach any data or trigger any OpenAI call.
12. **Google Calendar data is never sent to OpenAI or any other AI service.** Only text the user pastes or types (assignment specs, exam topics) and Runway's own records (assignment names, step names, minutes) may be sent. The public /privacy page promises this.

## Scheduler rules (summary)

- Free time = study window minus fixed events minus 15 minutes around each class, minus blocked days, minus the past.
- Remaining minutes for a step = `estimated_minutes × (1 − percent_done/100) × class pace_ratio`.
- Working deadline = deadline minus buffer days. Order by working deadline (earliest first), ties broken by weight.
- Spread each assignment's work evenly over the days available, not piled on the last day.
- Blocks are between min and max block length, steps in order, and never exceed max minutes per day.
- If work doesn't fit, schedule what fits and return a warning: assignment, minutes short, first overflow day.

Pace ratio per class: `(60 + total actual minutes) / (60 + total estimated minutes of progress)`, where estimated minutes of progress = step estimate × the increase in that step's percent.

## Every task, in this order

1. Read `AGENTS.md` and `PROGRESS.md`.
2. Do the task, and only the task.
3. Run `npm run typecheck`, `npm run lint`, and `npm test`. All must pass. Fix what you broke.
4. Append to `PROGRESS.md`: task ID, what was done, decisions made, known issues.
5. Commit with the message `P#-T#: <short description>`, using the repo's configured Git identity. Never add `Co-authored-by` trailers, "generated by" lines, or any AI attribution to commits, and never change the Git author settings.
6. Reply with what you did, the commands run and their results, and any manual steps for the user.

## End-of-phase report

When asked, write `reports/phase-N.md` with these sections, commit it, and print it in full in your reply:

1. Summary (3–5 sentences)
2. Requirement check: each requirement marked done / partly / not done, with one line on how
3. Files changed: each file, one line on what it does
4. Database changes (any data-model change goes at the very top of the report)
5. Tests: commands run and **raw, unedited output**, with pass and fail counts
6. Deviations from the brief, and why
7. Known issues and shortcuts (bugs, hard-coded values, TODOs)
8. Setup needed from Mufaddal (accounts, keys, environment variables, settings)
9. How to test it: live URL and exact steps
10. Commits: list of commit messages for the phase
11. Questions

Be honest in the report. A clearly reported problem is fine. A hidden one is not.
