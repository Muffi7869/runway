# Phase 6.5 Report

## 1. Summary

Phase 6.5 applies the approved Runway design system across the public shell and every existing signed-in screen without changing application behavior. The work adds token-driven light and dark themes, device-local System/Light/Dark preference, shared controls, a responsive sidebar, and the designed Week, Check in, Assignments, plan editor, Canvas import, Classes, Settings, landing, login, privacy, and private-app presentations. The final test run reports 64 passing files and 598 passing tests, compared with 59 files and 588 tests before the visual rollout. Public pages and signed-out redirects were exercised locally; signed-in appearance and workflows remain explicitly assigned to Mufaddal in Manual checks because Codex cannot enter the owner-only app.

## 2. Requirement check

1. **Done — Design sources protected:** `design-ref/` and `design-ref.zip` are ignored, untracked, and absent from all history. The archive is absent from the working tree.
2. **Done — Governing documents:** `AGENTS.md` and `DESIGN.md` are committed in `P6.5-0`, and DESIGN is treated as the visual source of truth.
3. **Done — Light and dark tokens:** `src/app/globals.css` defines every DESIGN token for explicit light and dark themes, including surfaces, ink, lines, accent states, status colors, and eight class colors.
4. **Done — Tailwind and shadcn wiring:** `src/app/globals.css` imports Tailwind, the animation stylesheet, and shadcn mappings; the theme block maps framework tokens to Runway variables.
5. **Done — Old palette removed:** `src/lib/classes/palette.ts` now exposes only eight DESIGN keys backed by CSS variables, with no component-level raw colors.
6. **Done — Theme behavior:** `src/lib/theme/index.ts`, `src/lib/theme/bootstrap.ts`, `src/components/theme-control.tsx`, and tests provide System, Light, and Dark; System is the default; local storage and a cookie persist the choice; the pre-paint script prevents a theme flash; no database state or theme package was added.
7. **Done — Typography:** `src/app/layout.tsx` loads Geist and Geist Mono through the framework font loader; global styles expose body and code variables, and `.num` supplies mono tabular numerals.
8. **Done — Shared UI:** Separate components provide default, primary, ghost, small, and icon buttons; cards; all eight class-chip keys; default and warning tags; segmented controls; tabs; progress bars; status banners; steppers; labeled inputs, selects, and textareas; and nav items. `src/components/ui/ui.test.tsx` renders every primitive and scans app/component source for raw hex colors.
9. **Done — Sidebar shell:** `src/app/(app)/layout.tsx` and `src/components/app-sidebar.tsx` implement the 232-pixel laptop sidebar, responsive phone stacking, active navigation, the existing sign-out action, an owner-filtered today/yesterday unchecked-block badge, and Google sync status.
10. **Done — Week:** Week uses 48 pixels per hour, today wash and circle, a live now line, class-tinted planned blocks, neutral fixed events, faded checked-in and missed work, a Today panel, due-soon progress, and the existing shortfall banner. Presentation helpers and markup are tested.
11. **Done — Check in:** The page uses responsive assignment cards, existing minute and progress controls, completion prompts, summary and success states, and per-class pace cards without changing submitted fields or actions.
12. **Done — Signed-out pages:** Landing and login share the designed no-sidebar shell and an aria-hidden preview made only from fictional content; privacy and private-app pages use the matching public document shell.
13. **Done — Assignments:** `AssignmentsView` renders counted Active, Done, and Dropped tabs; non-empty Los Angeles This week, Next week, and Later groups; weighted step progress; current plan totals; optional secondary AI totals; class chips; active-only needs-spec and overdue tags; weight tags; and the existing Plan or Break down, Edit, Done, Drop, and Restore controls. `groupByWeek` tests Monday/Sunday boundaries and both 2026–2027 daylight-saving transitions.
14. **Done — Plan editor:** The existing editor now follows the designed card hierarchy with breadcrumb, assignment context, minute stepper, reorder and delete controls, progress and logged-work notes, total comparison, unsaved indicator, regeneration states, Save, and Cancel. Hidden action fields remain `assignmentId`, `steps`, and `aiTotal`.
15. **Done — Canvas import:** New, Due date changed, and Already imported are styled as designed, while Fetch, the not-shown summary, needs-spec and missing-time tags, selection, class and time controls, row Update, and all action payloads are unchanged.
16. **Done — Classes:** Each responsive class card shows the class chip, descriptive live pace, active count, logged time, next due date, Rename, and a Color button. The plain-React popover has eight options, closes on Escape or outside interaction, returns focus, and preserves the existing `name`, `color`, and `class_id` fields. Markup and pure stats are tested.
17. **Done — Settings:** Existing study limits, encrypted Canvas-link status and replacement/removal, Google connection and calendars, and Days off appear as section cards. Appearance reuses the existing ThemeControl. No saved Canvas link or ciphertext is rendered.
18. **Done — No new dependencies:** The Phase 6.5 package manifest and lockfile diff is empty.
19. **Done — Visual-only boundary:** The Phase 6.5 diff has no migration or Supabase changes, no scheduler or pace changes, and no server-action file changes. UI-3 adds only explicit owner-filtered read columns for assignment progress and class summaries.
20. **Done — No component raw hex:** The source scan test covers `src/app` and `src/components` outside the token file and reports no offenders.
21. **Done — Existing test suite retained:** Before Phase 6.5 there were 59 passing files and 588 tests. The final run has 64 passing files and 598 tests, with no removed or failing earlier test.
22. **Partly — Laptop and phone presentation:** Responsive CSS uses flexible grids, min-width zero, wrapping controls, hidden desktop headers on narrow screens, and no fixed page widths. Phone controls have 40-pixel targets through shared styles and targeted overrides. A browser-only 390-pixel signed-in visual check remains open.
23. **Done — Keyboard and focus support in code:** Global focus-visible styling, native fields, arrow-key segmented controls, and the color popover's Escape/outside handling and focus return are implemented. Full signed-in keyboard traversal remains a browser-only manual check.
24. **Done — Reduced motion in code:** The global reduced-motion media query collapses transition and animation durations and disables smooth scrolling. Browser preference behavior remains a visual manual check.
25. **Done — Public and access checks:** `/`, `/login`, and `/privacy` returned 200 with the theme bootstrap in their HTML. `/week`, `/checkin`, `/assignments`, `/assignments/import`, `/classes`, and `/settings` returned 307 to `/login` while signed out.

## 3. Files changed

- `.gitignore` — Ignores both design-reference forms so private mockup material cannot be committed.
- `AGENTS.md` — Records the approved UI workflow and constraints.
- `DESIGN.md` — Defines the visual tokens, components, screen layouts, accessibility, and responsive behavior.
- `PROGRESS.md` — Logs all Phase 6.5 tasks and carries forward manual checks.
- `reports/phase-6-5.md` — Provides this evidence-based Phase 6.5 review.
- `src/app/globals.css` — Defines themes, framework mappings, typography, shared primitives, focus, responsive shell, and reduced motion.
- `src/app/layout.tsx` — Loads fonts and runs the inline no-flash theme bootstrap.
- `src/lib/theme/bootstrap.ts` — Supplies the pre-paint theme script.
- `src/lib/theme/index.ts` — Implements pure theme preference parsing and application.
- `src/lib/theme/index.test.ts` — Covers default, stored choices, system preference, cookie, storage, and DOM application.
- `src/lib/classes/palette.ts` — Maps the eight class keys to light/dark CSS tokens.
- `src/components/theme-control.tsx` — Offers System, Light, and Dark as an accessible segmented control.
- `src/components/ui/button.tsx` — Provides five button variants.
- `src/components/ui/card.tsx` — Provides the shared surface card.
- `src/components/ui/class-chip.tsx` — Provides tokenized class pills.
- `src/components/ui/tag.tsx` — Provides neutral and warning tags.
- `src/components/ui/segmented-control.tsx` — Provides controlled/uncontrolled keyboard navigation.
- `src/components/ui/tabs.tsx` — Adds counted tabs on the segmented primitive.
- `src/components/ui/progress-bar.tsx` — Provides clamped accessible progress.
- `src/components/ui/banner.tsx` — Provides warning and success banners.
- `src/components/ui/stepper.tsx` — Provides an accessible numeric stepper.
- `src/components/ui/field.tsx` — Provides labeled input, select, and textarea fields with hint/error wiring.
- `src/components/ui/nav-item.tsx` — Provides active navigation and badges.
- `src/components/ui/ui.test.tsx` — Renders primitives and enforces the no-raw-hex component rule.
- `src/lib/shell/checkin-badge.ts` — Counts unchecked today/yesterday blocks for shell presentation.
- `src/lib/shell/checkin-badge.test.ts` — Covers badge date/status boundaries.
- `src/components/runway-logo.tsx` — Provides the shared Runway mark.
- `src/components/app-sidebar.tsx` — Renders navigation, badge, sync state, owner block, and sign out.
- `src/app/(app)/layout.tsx` — Loads explicit owner shell data and installs the responsive sidebar.
- `src/components/replan-controls.tsx` — Applies shared controls to Replan.
- `src/components/rough-day-controls.tsx` — Applies shared controls to rough-day actions.
- `src/components/sync-controls.tsx` — Applies shared controls to Sync now.
- `src/lib/week/presentation.ts` — Adds pure assignment-progress and current-time positioning helpers.
- `src/lib/week/presentation.test.ts` — Covers weighted progress, invalid values, wall-clock position, and DST.
- `src/components/week-grid.tsx` — Adds today, now-line, class/status treatments, and accessible block presentation.
- `src/components/week-grid.module.css` — Implements the fixed 48-pixel grid and responsive day layout.
- `src/components/week-grid.test.tsx` — Covers class and status markers, current day, and now line.
- `src/components/week-today-panel.tsx` — Presents today blocks and due-soon assignments.
- `src/components/week-today-panel.module.css` — Styles the responsive Week side panel.
- `src/components/week-today-panel.test.tsx` — Covers fictional Today and due-soon markup.
- `src/app/(app)/week/page.tsx` — Loads explicit read-only Week presentation data.
- `src/app/(app)/week/week.module.css` — Styles Week headers, controls, banner, and layout.
- `src/components/checkin-card.tsx` — Provides assignment check-in cards and summaries.
- `src/components/checkin-card.module.css` — Styles Check in cards and responsive controls.
- `src/components/checkin-card.test.tsx` — Covers summary and pace presentation.
- `src/app/(app)/checkin/page.tsx` — Loads read-only summary and pace presentation data.
- `src/app/(app)/checkin/checkin-form.tsx` — Applies cards while retaining existing action fields.
- `src/app/(app)/checkin/checkin.module.css` — Styles Check in page states and forms.
- `src/components/signed-out-shell.tsx` — Provides landing/login shell and fictional aria-hidden preview.
- `src/components/signed-out-shell.module.css` — Styles public marketing and login layouts.
- `src/components/signed-out-shell.test.tsx` — Covers public shell semantics and preview privacy.
- `src/components/public-document-shell.tsx` — Provides the simple public policy shell.
- `src/components/public-document-shell.module.css` — Styles public documents.
- `src/app/page.tsx` — Uses the signed-out landing shell.
- `src/app/login/page.tsx` — Uses the signed-out login shell.
- `src/app/login/sign-in-button.tsx` — Applies the shared primary button.
- `src/app/privacy/page.tsx` — Uses the public document shell.
- `src/app/private/page.tsx` — Uses the public document shell.
- `src/app/(app)/assignments/assignment-form.tsx` — Applies shared field and button styling without changing names.
- `src/lib/assignments/presentation.ts` — Groups active assignments by Los Angeles week.
- `src/lib/assignments/presentation.test.ts` — Covers week edges, DST, overdue placement, and empty groups.
- `src/lib/steps/totals.ts` — Shares current and original AI total labels with editor and list presentation.
- `src/app/(app)/assignments/page.tsx` — Loads explicit progress and original-estimate columns and prepares list presentation.
- `src/app/(app)/assignments/assignments-view.tsx` — Renders counted tabs, week groups, progress, tags, totals, and actions.
- `src/app/(app)/assignments/assignments-view.test.tsx` — Covers active-only tags, optional AI copy, counts, and hidden empty groups.
- `src/app/(app)/assignments/assignments.module.css` — Styles the responsive grouped assignment table.
- `src/app/(app)/assignments/[id]/breakdown/page.tsx` — Adds read-only class and assignment context around the existing editor.
- `src/app/(app)/assignments/[id]/breakdown/breakdown.module.css` — Styles editor cards, stepper, states, and responsive controls.
- `src/app/(app)/assignments/import/page.tsx` — Adds the designed Import heading and navigation.
- `src/app/(app)/assignments/import/canvas-import.module.css` — Styles import sections and responsive rows without changing behavior.
- `src/lib/classes/stats.ts` — Builds active-count, logged-time, and next-deadline class summaries.
- `src/lib/classes/stats.test.ts` — Covers class summary aggregation.
- `src/app/(app)/classes/page.tsx` — Loads small explicit owner-filtered summary queries.
- `src/app/(app)/classes/classes-manager.tsx` — Renders class cards and accessible Color popover while preserving forms.
- `src/app/(app)/classes/classes-manager.test.tsx` — Covers eight open popover options and Escape close handling.
- `src/app/(app)/classes/classes.module.css` — Styles responsive class cards, statistics, forms, and popover.
- `src/app/(app)/settings/page.tsx` — Arranges existing settings into cards and mounts Appearance.
- `src/app/(app)/settings/settings-form.tsx` — Applies section-card field styling without changing names or validation.
- `src/app/(app)/settings/calendar-picker.tsx` — Styles the existing trusted calendar selection form.
- `src/app/(app)/settings/canvas-feed-url-section.tsx` — Styles boolean-only saved-link management without rendering the secret.
- `src/app/(app)/settings/days-off-section.tsx` — Styles existing day-off forms and rows.
- `src/app/(app)/settings/appearance-section.tsx` — Adds the existing ThemeControl to Settings.
- `src/app/(app)/settings/appearance-section.test.tsx` — Confirms all three appearance choices render.
- `src/app/(app)/settings/settings.module.css` — Styles the 920-pixel section-card layout and phone collapse.

### New dependencies

None. `package.json` and `package-lock.json` have no Phase 6.5 diff.

## 4. Database changes

None. Phase 6.5 contains no migration, Supabase file, database change, policy change, action mutation, scheduler change, or pace change. The only new data reads are explicit owner-filtered assignment-step progress fields, an existing assignment estimate field, breakdown-page class context, and Classes summary fields from assignments and sessions. Assignment specs and saved Canvas values are not selected for presentation.

## 5. Tests

TypeScript and ESLint produced no errors. Vitest reported 64 passing files and 598 passing tests with zero failures. The production build compiled and generated 19 application routes. The full audit reports 9 high-severity development-tool findings; the runtime-only audit reports zero vulnerabilities.

Raw output below removes only npm banners and the machine-specific project path.

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

 Test Files  64 passed (64)
      Tests  598 passed (598)
   Start at  14:42:19
   Duration  1.42s (transform 1.16s, setup 0ms, import 2.99s, tests 824ms, environment 4ms)
```

### `npm run build`

```text
> next build --webpack

▲ Next.js 16.3.8 (webpack)
- Environments: .env.local
✓ Running next.config.ts took 60ms
- Experiments (use with caution):
  · serverActions

  Creating an optimized production build ...
✓ Compiled successfully in 2.4s
  Running TypeScript ...
  Finished TypeScript in 1412ms ...
  Collecting page data using 7 workers ...
  Generating static pages using 7 workers (0/17) ...
  Generating static pages using 7 workers (4/17)
  Generating static pages using 7 workers (8/17)
  Generating static pages using 7 workers (12/17)
✓ Generating static pages using 7 workers (17/17) in 384ms
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

### Public and protected route checks

```text
/ 200 theme=runway-theme
/login 200 theme=runway-theme
/privacy 200 theme=runway-theme
/week 307 /login
/checkin 307 /login
/assignments 307 /login
/assignments/import 307 /login
/classes 307 /login
/settings 307 /login
```

### Design-reference evidence

```text
.gitignore:45:design-ref/ design-ref
.gitignore:46:design-ref.zip design-ref.zip
design-ref.zip: absent
```

`git log --all -- design-ref design-ref.zip` and `git ls-files design-ref design-ref.zip` both printed nothing.

### Phase 6.5 boundary evidence

`git diff` for `package.json` and `package-lock.json` printed nothing. The restricted-path scan for `supabase/`, `src/lib/scheduler`, and `src/lib/pace` printed nothing. The changed-action/migration scan printed nothing.

The complete per-file `git diff --stat 4d46f72^` is represented in Files changed above; its final summary line was:

```text
84 files changed, 4979 insertions(+), 1472 deletions(-)
```

### `git log --oneline` — Phase 6.5 before this report commit

```text
65a2ccf P6.5-UI-2: Week, Check in, sign-in restyle
d34eced P6.5-UI-1: design tokens, theme, components, app shell
4d46f72 P6.5-0: design system docs
```

### `git status --short` — before this report commit

```text
M  PROGRESS.md
A  reports/phase-6-5.md
M  src/app/(app)/assignments/[id]/breakdown/breakdown.module.css
M  src/app/(app)/assignments/[id]/breakdown/page.tsx
A  src/app/(app)/assignments/assignments-view.test.tsx
A  src/app/(app)/assignments/assignments-view.tsx
M  src/app/(app)/assignments/assignments.module.css
M  src/app/(app)/assignments/import/canvas-import.module.css
M  src/app/(app)/assignments/import/page.tsx
M  src/app/(app)/assignments/page.tsx
A  src/app/(app)/classes/classes-manager.test.tsx
M  src/app/(app)/classes/classes-manager.tsx
A  src/app/(app)/classes/classes.module.css
M  src/app/(app)/classes/page.tsx
A  src/app/(app)/settings/appearance-section.test.tsx
A  src/app/(app)/settings/appearance-section.tsx
M  src/app/(app)/settings/calendar-picker.tsx
M  src/app/(app)/settings/canvas-feed-url-section.tsx
M  src/app/(app)/settings/days-off-section.tsx
M  src/app/(app)/settings/page.tsx
M  src/app/(app)/settings/settings-form.tsx
A  src/app/(app)/settings/settings.module.css
M  src/app/globals.css
A  src/lib/assignments/presentation.test.ts
A  src/lib/assignments/presentation.ts
A  src/lib/classes/stats.test.ts
A  src/lib/classes/stats.ts
M  src/lib/steps/totals.ts
```

## 6. Deviations from the brief, and why

- The plan editor does not add a spec side panel because UI-3 explicitly forbids selecting `spec_text`; it restyles only the data and controls already safe to load.
- Class cards show active assignments, logged time, and next due rather than total planned time. These meaningful statistics need only two small owner-filtered, explicit-column queries and avoid expanding the UI task into block-join logic.
- The sidebar badge and several progress displays required small read-only owner-filtered queries. They are presentation inputs only and do not change data meaning or writes.
- No public screenshots were created because Playwright is not installed. It was not added because this phase forbids new dependencies.
- The signed-in screens were verified through compilation, tests, source review, and signed-out access boundaries, not visual browser inspection, because Codex cannot authenticate as the owner.

## 7. Known issues and shortcuts

- The full npm audit reports 9 high-severity findings in development tooling through one `braces` advisory. Runtime dependencies report zero vulnerabilities; the automated fix is a forced breaking downgrade and was not applied.
- Signed-in laptop, 390-pixel phone, light/dark, keyboard traversal, focus return, and reduced-motion presentation still need a real owner browser check.
- The visual rollout deliberately does not address any product behavior outside the approved Phase 6.5 surface.

## 8. Setup needed from Mufaddal

- No package, environment-variable, database, or account setup is needed for Phase 6.5.
- After deployment, complete the unchecked Phase 6.5 items in Manual checks on laptop and a 390-pixel phone viewport in both light and dark modes.

## 9. How to test it

1. Open the live app and verify System, Light, and Dark from Settings → Appearance. Reload several pages and confirm the preference persists without a flash.
2. At laptop width, compare the sidebar, Week, Check in, Assignments, plan editor, Canvas import, Classes, and Settings to their approved mockups in light and dark.
3. At 390 pixels, confirm the sidebar stacks, tables become cards, controls remain at least 40 pixels, and no page scrolls horizontally.
4. Use only the keyboard to move through navigation, assignment tabs, form fields, and the Classes Color popover. Press Escape and click outside the popover; confirm it closes and focus returns to Color.
5. Repeat the existing check-in save, Replan, Canvas import, assignment status, and step-save flows and confirm their behavior and payload outcomes are unchanged.
6. Enable reduced motion in the operating system and confirm decorative motion is effectively removed.

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
- [ ] Run supabase/tests/run_all_rollback.sql in the Supabase SQL Editor and confirm RUNNER REPORT shows 0 failed (owner: Mufaddal).
- [ ] Theme System/Light/Dark works and persists after reload, no flash
- [ ] Sidebar nav, Check in badge and sync status look like the mockup
- [ ] Nothing that worked before broke: check-in save, replan, import, step save
- [ ] Week page matches its mockup in light and dark (calendar, now line, Today panel, banner)
- [ ] Check in matches its mockup in light and dark and saves exactly as before
- [ ] Signed-out landing, /login, /privacy match the mockup in light and dark
- [ ] Assignments, plan editor, Import, Classes (Color popover) and Settings (Appearance) match their mockups in light and dark on the live site
- [ ] Theme persists after reload on every page

## 10. Commits

- `P6.5-0: design system docs`
- `P6.5-UI-1: design tokens, theme, components, app shell`
- `P6.5-UI-2: Week, Check in, sign-in restyle`
- `P6.5-UI-3: Assignments, plan editor, Import, Classes, Settings, Phase 6.5 report`

## 11. Questions

- After Mufaddal completes the visual checks, are any small spacing or copy differences from the reference worth a follow-up, or should the design system be considered final?
