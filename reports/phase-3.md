# Phase 3 Report

## 1. Summary

Phase 3 added owner-scoped assignment entry and status management, server-side PDF text extraction, validated AI step breakdowns, atomic step editing, and a manual Canvas calendar-feed import flow. Assignment deadlines are handled in Los Angeles time with explicit daylight-saving behavior, while specifications, AI totals, and imported Canvas data retain the approved null and length semantics. Canvas feed links are encrypted before storage and are never returned to the browser, and both AI and PDF work remain server-side. Fresh verification passes with 35 test files and 443 tests; the near-limit PDF and real AI calls are reported working on the live deployment, while the live Canvas import and encrypted-link inspection still await results from Mufaddal.

## 2. Requirement check

### Phase 3 brief

- **Done — Assignment validation and deadline conversion:** `src/lib/assignments/helpers.ts` enforces class, title, deadline, weight, and specification rules and converts Los Angeles wall-clock deadlines to UTC; `helpers.test.ts` covers limits, invalid dates, daylight-saving transitions, and edit behavior.
- **Done — Assignment forms and owner-scoped actions:** The shared controlled form supports create and edit without losing submitted values, and every mutation begins with the owner check and derives the owner identifier server-side.
- **Done — Assignment list and status controls:** The list separates active, done, and dropped assignments, provides active-only edit and breakdown links, and exposes Done, Drop, and Restore without any assignment delete action.
- **Done — PDF specification extraction:** `src/lib/assignments/pdf.ts` extracts text with `unpdf`, applies fixed safety limits and messages, and returns text to the controlled form for review without storing the upload.
- **Done — AI breakdown:** `src/lib/ai/breakdown.ts` sends only approved assignment data to the Responses API, requires strict structured output, validates it again with Zod, and retries once before returning a fixed error.
- **Done — Breakdown page and editor:** The protected breakdown page loads explicit assignment and step fields, supports draft generation and controlled editing, and displays both the original AI estimate and the current saved-plan total.
- **Done — Atomic step persistence:** The database function validates and saves an assignment's full ordered step list in one transaction under caller Row Level Security, and the server action writes only through that function.
- **Done — Canvas feed link protection:** Settings validates the approved Canvas hosts and path, encrypts the link with the existing AES-256-GCM helper, returns only saved/not-saved state, and supports explicit replacement or removal.
- **Done — Canvas preview and import:** The manual import page re-fetches and re-plans server-side, previews new, changed, already imported, and skipped items, and never trusts client-submitted titles or dates.
- **Done — Needs-spec indication:** The Assignments page issues a separate identifier-only query for active assignments whose specification is null and shows the tag only on those rows.
- **Done — Automated verification:** Typecheck, lint, all 443 tests, and the production build complete successfully.

### Orchestrator decisions

#### P3-T1 — Assignments

1. **Done — Restore both terminal statuses:** `restoreAction` accepts current status `done` or `dropped` and changes it to `active`.
2. **Done — Medium default weight:** `src/app/(app)/assignments/new/page.tsx` initializes new assignments with `weight: "medium"`; edit mode retains the stored value.
3. **Done — Active-only edits:** The edit page and update action require status `active`, and the update repeats that filter when writing.
4. **Done — Text limits:** The shared validator caps titles at 120 characters and specifications at 100,000 characters; exact-boundary and over-limit cases are tested in `helpers.test.ts`.
5. **Done — Spring-forward gaps rejected:** `parseDeadline` rejects a Los Angeles wall-clock time that does not exist, covered by the spring clock-change test.
6. **Done — Fall-back uses the earlier instant:** Ambiguous wall-clock times sort matching UTC candidates and select the earlier one; the November fall-back case is tested.
7. **Done — Past-deadline edit rule:** An unchanged past deadline preserves the stored UTC instant, while a changed past deadline is rejected; both paths and the ambiguous stored-instant case are tested.
8. **Done — Nullable missing values:** `20261007125809_make_assignments_spec_and_estimate_nullable.sql` drops both NOT NULL constraints, converts blank specifications to null, prohibits non-null blank specifications, and prohibits negative non-null AI estimates.

#### P3-T2 — PDF specifications

1. **Done — Approved parser:** `unpdf` is the only PDF parsing dependency and is used only by the server-side extraction module.
2. **Done — Upload limits:** `MAX_PDF_BYTES` is 4 MiB, while the Server Action request limit is 4.5 MB so deployment infrastructure can accept enough multipart overhead for the application to enforce the 4 MiB file limit.
3. **Done — Two size checks:** `assignment-form.tsx` rejects oversized files before upload and `pdf-actions.ts` repeats the check before reading bytes.
4. **Done — PDF signature check:** The extractor verifies the leading PDF signature before opening a document; invalid and truncated inputs are tested.
5. **Done — Page cap before extraction:** The opened document's page count is checked against 50 before text extraction; 50 and 51-page cases are tested.
6. **Done — Locked-document handling:** Password-related parser failures map to the fixed locked-PDF message, with opening and extraction failure tests.
7. **Done — Extracted-text limit:** Text longer than 100,000 characters is rejected using the same public-safe limit message as typed specifications.
8. **Done — Upload never stored:** The action reads the in-memory `File` into an `ArrayBuffer`, performs no database or filesystem write, and the file input has no form name so Save never resubmits it.

#### P3-T3 — AI breakdown

1. **Done — Configured model:** The model is read at call time from `OPENAI_MODEL`; tests use the approved `gpt-6.1-sol` value, and no model fallback is hard-coded.
2. **Done — Responses API configuration:** The request uses the Responses API, strict JSON-schema Structured Outputs, and `reasoning: { effort: "low" }`; the complete request shape is asserted with a mock client.
3. **Done — Documentation preflight:** PROGRESS records that official OpenAI documentation was checked before implementation and confirmed support for the Responses API, Structured Outputs, and low reasoning effort.
4. **Done — AI-only 30,000-character cap:** Stored specification text may remain up to 100,000 characters, while only the first 30,000 characters are included in an AI request; exact and over-limit cases are tested.
5. **Done — No Google Calendar data:** The AI input type contains only class name, assignment title, deadline, weight, and specification text. Its test asserts that the assembled input contains no calendar, email, or user-identifier field.
6. **Done — One retry:** Invalid output, parse failures, validation failures, and API failures share a two-attempt path; success-on-retry and failure-after-two-attempts are tested.
7. **Done — OpenAI is mocked in tests:** Unit tests inject a mock Responses client and make no real AI request.
8. **Done — Spending guard:** Mufaddal reported setting an OpenAI monthly usage limit of about $10 before live testing.

#### P3-T4 — Step editing and save

1. **Done — Atomic save function:** `public.save_assignment_steps` validates, deletes removed rows, updates existing rows, inserts new rows, and optionally stores the original AI total within one PostgreSQL function call.
2. **Done — SECURITY INVOKER:** The function is explicitly `security invoker`, executes only for `authenticated`, and relies on caller Row Level Security.
3. **Done — Ownership re-check:** The function locks and verifies an active assignment belonging to `auth.uid()`, then verifies every retained step belongs to that assignment and owner.
4. **Done — SQL limits:** SQL enforces 1–20 steps, object shape, unique owned identifiers, trimmed names of 1–60 characters, estimates from 15–600 minutes in multiples of 5, and an optional original AI total from 1–12,000 minutes.
5. **Done — Steps delete policy:** The migration adds the owner-scoped authenticated delete policy needed by the atomic replacement operation without adding assignment deletion.
6. **Done — Logged-work guard:** Removing a step referenced by `session_steps` raises `RS001`; the application maps it to a fixed message and tests both named and unnamed details.
7. **Done — Scheduled-step guard:** Removing a step referenced by `blocks` raises `RS004`; the migration includes a rollback-only SQL check and the application error mapping is unit tested. A real blocked-step test awaits Phase 4 data.
8. **Done — Original AI total is preserved:** The save action omits the AI-total argument during ordinary edits and supplies it only with a newly generated AI draft; SQL updates the stored value only when the optional argument is present.
9. **Done — Current total comes from saved steps:** `currentTotalsByAssignment` sums current step estimates and the assignment list queries those step rows rather than treating the stored AI total as the editable-plan total.
10. **Done — Regeneration lock after progress:** Both the server action and editor block regeneration if any step has progress or logged session work; the server makes the final decision.
11. **Done — No scheduling on save:** Neither the save action nor the database function creates or changes blocks; Phase 3 saves the breakdown only.

#### P3-T5 — Canvas import

1. **Done — Approved parser:** Canvas parsing uses `ical.js` 2.2.1, which has no runtime dependencies of its own.
2. **Done — Exact URL allowlist:** `validateCanvasFeedUrl` requires HTTPS, no credentials or port, an exact host of `canvas.ucsd.edu` or `ucsd.instructure.com`, and a path beginning `/feeds/calendars/`; allowed and rejected forms are tested.
3. **Done — Bounded fetch:** Fetch uses manual redirects, a 10-second abort signal, and a 2 MiB limit enforced while streaming the response body; redirects, failures, and streamed overflow are tested.
4. **Done — Encrypted and concealed link:** The link is encrypted before database storage, Settings renders only a boolean saved state and `Saved ••••`, and only a server-side reader decrypts it for import.
5. **Done — Plain column removed:** `20261008212218_encrypt_canvas_feed_url.sql` adds nullable `canvas_feed_url_encrypted` and intentionally drops the prior plaintext column.
6. **Done — Assignment UID filter:** The parser accepts only VEVENT identifiers beginning `event-assignment-` and counts other events as not assignments.
7. **Done — Class matching:** Bracket text is reduced to a parsed subject, number, and suffix and is matched case-insensitively against class names; none, one, and multiple matches are tested.
8. **Done — Import window:** Due instants must be at or after now and before the start of Los Angeles day 71, which includes the entire Los Angeles day 70; daylight-saving and boundary tests cover the rule.
9. **Done — Date-only deadline handling:** Date-only feed items default to 11:59 PM Los Angeles time and expose an editable native time field before import.
10. **Done — Preview before writes:** The first manual action fetches and renders a stateless preview. Import and due-date update actions independently re-fetch and re-plan before writing.
11. **Done — Imported defaults:** Newly imported assignments use weight `medium` and `spec_text: null` and therefore appear as needing a specification.
12. **Done — Changed deadlines require confirmation:** Changed feed dates are never auto-applied; each active changed item has its own Update action after preview.
13. **Done — Done and dropped rows stay unchanged:** Non-active existing imports are placed in Already imported, and the write action repeats status `active` when changing a deadline.
14. **Done — Manual-only Canvas access:** Canvas is fetched only when the owner presses Fetch, Import, or Update; no cron, page-load fetch, or automatic import was added.
15. **Done — Active-list needs-spec query:** The assignment list selects only identifiers from active assignments where `spec_text` is null, and `shouldShowNeedsSpec` also requires active status; done and dropped rows are tested not to show the tag.
16. **Done — One plain skipped summary:** `describeSkipped` produces a single `Not shown: ...` line covering outside-window, unsupported-time, unreadable, and non-assignment counts; wording and combined-count behavior are tested.
17. **Done — Long-title shortening:** Imported titles longer than 120 characters are shortened to 119 trimmed characters plus one ellipsis; exact-120 and over-limit cases are tested.

## 3. Files changed

- `.env.example` — Adds the `OPENAI_MODEL` variable name without a value.
- `AGENTS.md` — Clarifies that assignment specification text and AI total estimates are nullable contract fields.
- `PROGRESS.md` — Records Phase 3 implementation, decisions, manual work, verification, and known issues.
- `next.config.ts` — Sets the Server Action body limit to 4.5 MB for the approved 4 MiB PDF payload.
- `package.json` — Adds the three approved Phase 3 runtime dependencies.
- `package-lock.json` — Locks the Phase 3 dependency graph and exact installed versions.
- `reports/phase-3.md` — Provides this Phase 3 review report.
- `src/app/(app)/assignments/[id]/breakdown/breakdown.module.css` — Defines phone-safe breakdown and editor presentation.
- `src/app/(app)/assignments/[id]/breakdown/page.tsx` — Loads an active assignment and saved steps with explicit fields for the breakdown editor.
- `src/app/(app)/assignments/[id]/breakdown/step-editor.tsx` — Implements AI generation, controlled editing, totals, progress locks, and atomic save submission.
- `src/app/(app)/assignments/[id]/edit/page.tsx` — Loads and prefills one owner assignment for active-only editing.
- `src/app/(app)/assignments/actions.ts` — Implements create, update, Done, Drop, and Restore server actions.
- `src/app/(app)/assignments/assignment-form.tsx` — Provides the shared controlled assignment form and in-memory PDF upload interaction.
- `src/app/(app)/assignments/assignments.module.css` — Defines responsive assignment-list styling.
- `src/app/(app)/assignments/breakdown-actions.ts` — Loads approved assignment data, enforces regeneration locks, and calls the AI module.
- `src/app/(app)/assignments/canvas-actions.ts` — Implements owner-first preview, import, and individually confirmed deadline-update actions.
- `src/app/(app)/assignments/import/canvas-import.module.css` — Defines phone-safe Canvas preview and selection styling.
- `src/app/(app)/assignments/import/canvas-import.tsx` — Renders manual preview, selection, import summaries, deadline changes, and skipped counts.
- `src/app/(app)/assignments/import/page.tsx` — Adds the protected Canvas import page.
- `src/app/(app)/assignments/new/page.tsx` — Adds the protected new-assignment page and medium default weight.
- `src/app/(app)/assignments/page.tsx` — Replaces the placeholder with assignment groups, totals, status actions, import entry, and active needs-spec tags.
- `src/app/(app)/assignments/pdf-actions.ts` — Authenticates and extracts an in-memory PDF without persistence.
- `src/app/(app)/assignments/status-button.tsx` — Provides pending and error states for Done, Drop, and Restore.
- `src/app/(app)/assignments/steps-actions.ts` — Validates editor payloads and invokes the atomic save function.
- `src/app/(app)/settings/actions.ts` — Removes the former plaintext Canvas field from ordinary settings writes.
- `src/app/(app)/settings/canvas-actions.ts` — Saves encrypted Canvas links and explicitly removes them by storing null.
- `src/app/(app)/settings/canvas-feed-url-section.tsx` — Shows only saved state and empty Save or Replace input for the secret link.
- `src/app/(app)/settings/page.tsx` — Loads only Canvas ciphertext presence and mounts the isolated secret-link section.
- `src/app/(app)/settings/settings-form.tsx` — Removes plaintext Canvas URL state from the general settings form.
- `src/lib/ai/breakdown.test.ts` — Tests input boundaries, strict output validation, retries, request shape, and safe errors with a mock client.
- `src/lib/ai/breakdown.ts` — Implements the server-only Responses API breakdown module.
- `src/lib/assignments/helpers.test.ts` — Tests assignment limits, deadline parsing, DST behavior, formatting, and grouping.
- `src/lib/assignments/helpers.ts` — Defines assignment validation and deadline, estimate, and list helpers.
- `src/lib/assignments/needs-spec.test.ts` — Tests active-only needs-spec decisions.
- `src/lib/assignments/needs-spec.ts` — Defines the pure active needs-spec tag rule.
- `src/lib/assignments/pdf-constants.ts` — Exposes client-safe PDF size constants and wording.
- `src/lib/assignments/pdf.test.ts` — Tests PDF signatures, limits, extraction, locked files, empty text, cleanup, and safe errors.
- `src/lib/assignments/pdf.ts` — Extracts bounded PDF text with `unpdf` on the server.
- `src/lib/canvas/class-match.test.ts` — Tests course-code parsing and exact class matching outcomes.
- `src/lib/canvas/class-match.ts` — Parses Canvas bracket codes and matches owner classes.
- `src/lib/canvas/feed-url-value.test.ts` — Tests encryption preparation and safe validation failures.
- `src/lib/canvas/feed-url-value.ts` — Validates and encrypts a submitted Canvas link without echoing it.
- `src/lib/canvas/feed-url.ts` — Reads and decrypts the saved Canvas link server-side.
- `src/lib/canvas/fetch.test.ts` — Tests redirect refusal, fetch failures, and streamed response-size enforcement.
- `src/lib/canvas/fetch.ts` — Fetches an allowed Canvas feed with manual redirects, timeout, and streaming cap.
- `src/lib/canvas/load.ts` — Coordinates secret-link reading, feed fetch and parse, owner data queries, and import planning.
- `src/lib/canvas/parse.test.ts` — Tests assignment filtering, due-time formats, skipped counts, malformed feeds, and title shortening.
- `src/lib/canvas/parse.ts` — Parses minimal assignment VEVENT data with `ical.js`.
- `src/lib/canvas/plan.test.ts` — Tests new, changed, already imported, terminal-status, and outside-window planning.
- `src/lib/canvas/plan.ts` — Purely plans Canvas import categories without writes.
- `src/lib/canvas/preview.test.ts` — Tests safe preview shaping, default times, matching, and row availability.
- `src/lib/canvas/preview.ts` — Converts an import plan into browser-safe preview rows.
- `src/lib/canvas/skipped.test.ts` — Tests the single skipped-items summary line.
- `src/lib/canvas/skipped.ts` — Formats aggregate skipped-item counts without feed content.
- `src/lib/canvas/url.test.ts` — Tests the exact host, path, protocol, credential, and port allowlist.
- `src/lib/canvas/url.ts` — Validates allowed Canvas feed links.
- `src/lib/canvas/window.test.ts` — Tests current-time and Los Angeles day-70 import boundaries across DST.
- `src/lib/canvas/window.ts` — Resolves feed deadlines and the 70-day Los Angeles import window.
- `src/lib/db/database.types.ts` — Reflects nullable assignment fields, the atomic save function, and encrypted Canvas settings column.
- `src/lib/settings/schema.test.ts` — Removes obsolete plaintext Canvas URL validation cases.
- `src/lib/settings/schema.ts` — Removes the secret Canvas URL from the shared browser-safe settings schema.
- `src/lib/steps/editor.test.ts` — Tests immutable editing, limits, totals, payloads, progress, and logged-work removal guards.
- `src/lib/steps/editor.ts` — Provides pure controlled-step editor operations and validation.
- `src/lib/steps/limits.ts` — Centralizes shared step limits and fixed messages.
- `src/lib/steps/save-errors.test.ts` — Tests safe database-error mappings including `RS001` and `RS004`.
- `src/lib/steps/save-errors.ts` — Maps database save codes to fixed user-facing messages.
- `src/lib/steps/totals.test.ts` — Tests saved-step aggregation and separate AI/current total wording.
- `src/lib/steps/totals.ts` — Computes current totals from saved step estimates.
- `supabase/migrations/20261007125809_make_assignments_spec_and_estimate_nullable.sql` — Makes missing specifications and AI totals nullable and adds integrity checks.
- `supabase/migrations/20261008183142_save_assignment_steps.sql` — Adds the steps delete policy and atomic SECURITY INVOKER save function.
- `supabase/migrations/20261008212218_encrypt_canvas_feed_url.sql` — Replaces plaintext Canvas link storage with a nullable encrypted column.
- `supabase/tests/save_assignment_steps_rs004.sql` — Provides a rollback-only database check for scheduled-step rejection and successful preservation.

### New dependencies

Phase 3 added exactly these direct dependencies; `package.json` and `package-lock.json` agree on the installed versions:

| Package | Declared version | Locked version | Purpose | Fresh audit result |
| --- | --- | --- | --- | --- |
| `unpdf` | `^1.8.1` | `1.8.1` | Server-side PDF text extraction | No runtime vulnerability reported |
| `openai` | `^7.30.1` | `7.30.1` | Server-side Responses API client | No runtime vulnerability reported |
| `ical.js` | `^2.2.1` | `2.2.1` | Server-side iCalendar parsing | No runtime vulnerability reported |

The full audit reports 9 high-severity findings in existing development tooling and no critical findings. The runtime-only audit reports zero vulnerabilities.

## 4. Database changes

**Data-model change:** `assignments.spec_text` and `assignments.ai_total_estimate_minutes` are now nullable without defaults. Existing whitespace-only specifications are converted to null, and named checks reject non-null blank specifications and negative non-null AI totals. Null means no specification yet or not yet broken down; zero and empty strings are not substitutes.

The steps migration adds the authenticated owner-scoped delete policy needed only for atomic breakdown replacement. It creates `public.save_assignment_steps` as a SECURITY INVOKER function, restricts execution to authenticated callers, re-checks active-assignment and step ownership, validates all limits in SQL, preserves progress, rejects removal of logged or scheduled steps with `RS001` and `RS004`, and changes the stored original AI estimate only when a new AI total is explicitly supplied. It does not create blocks or schedule work.

The Canvas migration adds nullable `settings.canvas_feed_url_encrypted` with no default and drops the old plaintext `canvas_feed_url`. SQL intentionally does not migrate the old secret because encryption requires the application-held key; the owner re-enters the link once through Settings, where the app encrypts it before storage.

## 5. Tests

TypeScript and ESLint produced no errors. Vitest reported 35 passing files and 443 passing tests, with zero failures. The production build compiled successfully and generated 16 application routes. The full audit reports 9 high-severity development-only findings; the runtime-only audit reports zero vulnerabilities.

Public-safe command output is reproduced below with only npm banners and the machine-specific project path removed.

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

 Test Files  35 passed (35)
      Tests  443 passed (443)
   Start at  02:21:58
   Duration  1.22s (transform 1.13s, setup 0ms, import 2.50s, tests 906ms, environment 6ms)
```

### `npm run build`

```text
> next build --webpack

▲ Next.js 16.3.8 (webpack)
- Environments: .env.local
✓ Running next.config.ts took 58ms
- Experiments (use with caution):
  · serverActions

  Creating an optimized production build ...
✓ Compiled successfully in 1773ms
  Running TypeScript ...
  Finished TypeScript in 1039ms ...
  Collecting page data using 7 workers ...
  Generating static pages using 7 workers (0/16) ...
  Generating static pages using 7 workers (4/16)
  Generating static pages using 7 workers (8/16)
  Generating static pages using 7 workers (12/16)
✓ Generating static pages using 7 workers (16/16) in 437ms
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

### `git log --oneline` — Phase 3

```text
a3d4551 P3-T5: Canvas import page
f7ff042 P3-T5: encrypted Canvas link in Settings
3cb6b15 P3-T5: encrypted Canvas URL column
18cbb3d P3-T5: Canvas feed logic
1998ab5 P3-T4: step editor and save
9dfb8c6 P3-T4: step editor logic
8d79fd2 P3-T4: steps delete policy and save function
c175ff1 P3-T3: breakdown action and page
ebc469e P3-T3: AI breakdown module
a799f6c P3-T2: PDF upload on assignment form
c775f30 P3-T2: PDF text extraction helper
be116b9 Update AGENTS.md: assignments spec and estimate are nullable
28577eb P3-T1: assignments page
e71816b P3-T1: assignment form and actions
742fb1f P3-T1: make spec and estimate nullable
483285a P3-T1: assignment validation and helpers
```

### `git status --short`

The command produced no output because the working tree was clean before this report was written.

### Live checks

The following results are reported by Mufaddal and are not assertions from the automated test suite:

- A near-limit PDF of about 3.8 MB containing real extractable text uploaded on the live site and extracted successfully.
- A real AI breakdown worked on the live site; the OpenAI usage page showed a cost of about one cent.
- The real Canvas feed pre-check reported 34 events: all used the `event-assignment-` UID prefix, 32 were date-only, 2 were UTC date-times, 31 were in the future, and bracket text had the shape `CODE_TERM_NUMBER`.
- Live Canvas import: to be filled in by Mufaddal.
- Encrypted-link check: to be filled in by Mufaddal.

## 6. Deviations from the brief, and why

- PDF uploads are capped at 4 MiB, while the Server Action body limit is 4.5 MB. The small difference is intentional multipart overhead so the application can return its own 4 MiB error before the deployment platform rejects the request.
- The application accepts assignment specification text up to 100,000 characters but sends at most 30,000 characters to the AI. This keeps complete user-entered text available for review while bounding AI cost and latency.
- The original AI total is historical metadata and is not recalculated during manual edits. The current plan total is always calculated from the saved step rows so both values retain distinct meaning.
- Step replacement requires a steps delete policy even though assignments and sessions remain permanent. Deletion is limited to owner-scoped steps inside the atomic function and is blocked when logged work or scheduled blocks exist.
- Canvas date-only events contain no time, so the preview supplies the approved 11:59 PM Los Angeles default and allows the owner to edit it before import.
- Canvas imports and deadline changes are deliberately manual and revalidated against a freshly fetched feed. Nothing imports or changes automatically from a browser-supplied title, date, or class.
- The plaintext Canvas feed column is dropped rather than migrated because PostgreSQL does not have the application encryption key. The owner must re-enter the secret once so encryption happens before storage.
- Verification output retains real timings and tool text while omitting only npm banners and the machine-specific project path, as required for this public report.

## 7. Known issues and shortcuts

- The full npm audit reports 9 high-severity findings in development tooling through the `braces` advisory. The runtime-only audit reports zero vulnerabilities. The available audit fix is a breaking forced downgrade and was not applied.
- The live Canvas import result and the database inspection confirming encrypted Canvas-link storage have not yet been supplied; both remain manual checks for Mufaddal.
- `RS004` is implemented, mapped, and covered by a rollback-only SQL test, but a real scheduled-step removal cannot be exercised until Phase 4 creates blocks.
- Image-only scanned PDFs have no extractable text and intentionally return the paste-text guidance; optical character recognition is not included.
- Canvas class matching depends on a single parsed course-code match. Unmatched or ambiguous rows require the owner to choose a class in the preview.
- The Canvas import preview is stateless. It intentionally re-fetches after import or update rather than persisting feed content.

## 8. Setup needed from Mufaddal

- **Complete:** The live AI result confirms `OPENAI_API_KEY` and `OPENAI_MODEL` are configured in the deployed environment; only the variable names are stored in the repository.
- **Complete:** `OPENAI_MODEL` is configured as the approved model, and the OpenAI monthly usage limit is reported set to about $10.
- **Complete:** The assignment-nullability, atomic-step-save, and encrypted-Canvas-column migrations are reflected in the generated linked database types.
- **Complete:** A near-limit live PDF extraction and a real live AI breakdown have been reported successful.
- **Complete:** The Canvas feed was inspected with the counts-only pre-check before integration.
- **Open:** Enter or replace the Canvas calendar link in Settings after the plaintext column removal, if not already done.
- **Open:** Run the live Canvas preview/import and report the result.
- **Open:** Inspect the saved Canvas setting in the database and confirm it is unreadable ciphertext without copying it anywhere.

## 9. How to test it

1. Open the live deployment and sign in with the configured owner account.
2. Add a fictional assignment. Confirm weight starts at Medium, a past new deadline is rejected, the row appears under Active, and Done, Drop, and Restore move it only between status sections.
3. Edit the active assignment, confirm its stored values remain, then confirm a restored assignment can be edited again.
4. Upload a fictional text PDF under 4 MiB. Confirm the extracted text appears for review and nothing is saved until Save is pressed. Try an oversized, locked, image-only, and over-50-page file and confirm each fixed message.
5. Open Break down, generate draft steps, inspect the original AI total, edit step names and estimates, reorder them, and save. Confirm the assignment list shows the total calculated from saved steps.
6. Return to the editor, make an ordinary edit, and confirm the original AI total remains unchanged. Once a step has progress or logged work, confirm Regenerate is disabled and rejected server-side.
7. In Settings, save a fictional allowed-form Canvas link, refresh, and confirm only `Saved ••••` appears. Replace it and remove it once to verify both explicit actions.
8. Open Import from Canvas and press Fetch from Canvas. Confirm New, Due date changed, Already imported, and the one-line Not shown summary appear without an automatic write.
9. For a fictional date-only item, confirm 11:59 PM is prefilled and editable. Import a selected item and confirm it appears Active with Medium weight and Needs spec.
10. Change an imported fictional feed item's date, fetch again, and confirm the stored deadline changes only after pressing that row's Update button. Confirm done or dropped imported rows stay under Already imported and cannot be updated.
11. Inspect the database through its administration interface without copying values: confirm the Canvas link column contains unreadable ciphertext and the former plaintext column is absent.
12. Run the eight fresh verification commands shown in this report with Node.js 24 and compare the results.

## 10. Commits

- `P3-T1: assignment validation and helpers`
- `P3-T1: make spec and estimate nullable`
- `P3-T1: assignment form and actions`
- `P3-T1: assignments page`
- `Update AGENTS.md: assignments spec and estimate are nullable`
- `P3-T2: PDF text extraction helper`
- `P3-T2: PDF upload on assignment form`
- `P3-T3: AI breakdown module`
- `P3-T3: breakdown action and page`
- `P3-T4: steps delete policy and save function`
- `P3-T4: step editor logic`
- `P3-T4: step editor and save`
- `P3-T5: Canvas feed logic`
- `P3-T5: encrypted Canvas URL column`
- `P3-T5: encrypted Canvas link in Settings`
- `P3-T5: Canvas import page`
- `P3-T5: Phase 3 report`

## 11. Questions

1. What was the result of the live Canvas preview and import check?
2. Did the database inspection confirm the saved Canvas link is unreadable ciphertext and that no plaintext Canvas-link column remains?
