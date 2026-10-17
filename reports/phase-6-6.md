# Phase 6.6 Report

## 1. Summary

Phase 6.6 improves response-path efficiency and theme persistence, finishes the approved typography and focused screen cleanup, declutters Week, and centralizes Runway's canonical site URL. Week now uses a 56-pixel time scale, display-only adjacent-block merging, compact labels and status marks, quiet fixed events, bounded overlap lanes, accessible detail popovers, past-day fading, one combined status line, and a one-line planned total. A code-and-test investigation found no sync defect behind the reported duplicate event; legitimate cross-calendar or distinct-event rows remain visible rather than being silently hidden. Fresh verification reports 71 passing test files and 640 passing tests, a successful 19-route production build, 9 high-severity development-tool findings, and zero runtime vulnerabilities.

## 2. Requirement check

1. **Done — Performance evidence:** `PROGRESS.md` records before-and-after sequential round-trip stages for the shared layout and every protected page.
2. **Done — Cached request lookups:** the server Supabase client, owner lookup, and settings gate are request-cached and shared within a render.
3. **Done — Parallel reads:** independent Settings, Week, Classes, Check in, Assignments, and breakdown reads use parallel query groups where their dependencies allow it.
4. **Done — Google work after response:** stale Week synchronization runs through framework `after()` with a per-owner in-flight guard and revalidates only after changed rows; explicit Sync and Replan behavior is unchanged.
5. **Done — Region:** `vercel.json` selects `sfo1`, the closest function region to the existing database region. Cron schedules were not changed.
6. **Done — Loading states:** every protected screen and nested protected assignment route has a token-based, reduced-motion-safe loading skeleton.
7. **Done — Navigation prefetching:** internal navigation uses normal framework links and keeps default prefetching. Google OAuth remains a plain GET form action so it cannot be prefetched.
8. **Done — Theme persistence:** the root layout reads the theme cookie, the inline pre-paint script resolves System before paint, and ThemeControl writes both cookie and local storage. Sign-out does not clear either theme store.
9. **Done — Plus Jakarta Sans only:** the root layout loads Plus Jakarta Sans at weights 400, 500, 600, and 700. Exact font-source scans find no Geist, mono font, Inter, Roboto, or Arial declaration.
10. **Done — Numeric and type rules:** `.num` and time/count surfaces use tabular figures in the main font; the shared type scale includes the approved body, secondary, small, page-title, card-title, and big-stat sizes.
11. **Done — Content layout:** protected content is left-aligned and fills available space up to 1320 pixels; Settings and Check in retain narrower left-aligned limits and responsive stacking.
12. **Done — Assignments:** overdue active work is the first non-empty group; each active row has one visible plan action plus the shared accessible more menu. Low and medium weight tags are removed, while the DESIGN-required high tag remains.
13. **Done — Settings durations:** each duration has one sentence-case label with hour and minute controls side by side. Existing field names, parsing, server action, and validation remain unchanged.
14. **Done — Shortfall banner:** Week renders one icon, at most three unchanged warning sentences, then a `+N more` line.
15. **Done — Week time range:** `visibleHourRange` starts with the saved study window and widens only for out-of-window items. Tests cover empty/default input, earlier and later items, and an event on the fall-back daylight-saving day.
16. **Done — Week geometry:** `WEEK_GRID_ROW_HEIGHT_PX` is 56; grid lines, now line, events, phone day view, and hour gutter share the same coordinate system.
17. **Done — Display-only merging:** `mergeAdjacentBlocks` combines touching same-assignment, same-status blocks on one Los Angeles day without changing stored rows. Tests reject different assignments, gaps, and status mismatches and confirm summed minutes and step labels.
18. **Done — Size-aware labels:** `blockLabel` shows assignment only below 45 minutes, assignment plus step at 45 minutes, and class plus assignment plus step at 75 minutes. Full detail remains in the title, aria label, and popover.
19. **Done — Compact statuses and quiet fixed events:** checked-in blocks use an accessible inline check icon at 55% opacity; missed blocks use a quiet warning dot. Fixed events have no border, use muted tokens, show title only, and pass through tested balanced-edge bracket cleaning.
20. **Done — Overlap limit:** `limitLanes` shows at most two lanes per overlap cluster and returns a tested hidden count rendered as `+N`.
21. **Done — Item details:** each calendar item is a native button, so click and Enter open a dialog-style popover. Escape and outside pointer close it and return focus; the popover shows full title, time, class, steps, and status when applicable.
22. **Done — Past days and phone:** `isPastDay` compares Los Angeles calendar dates, including the November 2026 transition, and past columns render at 70% opacity. The existing one-day phone navigation and swipe threshold remain.
23. **Done — Week header:** one line reports Updated and Synced values through the existing relative formatter; Sync now moved into the shared accessible more menu while Rough day and Replan remain primary controls. A pure-tested, no-wrap big stat reports weekly planned time.
24. **Done — Duplicate investigation:** mapper/planner/placement tests cover expanded recurring instances, the same invitation on two calendars, moved instances, cancelled instances, and one-layout-per-input behavior. The mapper stores the API instance ID, the planner keys by calendar plus event ID, moved rows update, cancelled rows are removed, and Week placement does not clone rows. No sync fix or display de-duplication was justified.
25. **Done — Database uniqueness evidence:** the existing migration enforces the unique key `(user_id, source_calendar_id, google_event_id)`, preventing two stored rows for the same composite Google event identity.
26. **Done — Canonical URL helper:** `src/lib/site-url.ts` normalizes `NEXT_PUBLIC_SITE_URL`, accepts a request-origin fallback, permits localhost only outside production, and builds absolute paths. Tests cover configured, unset/request-origin, localhost, trailing slash, and both path forms.
27. **Done — URL wiring:** metadata base and public canonical/Open Graph paths, Supabase OAuth redirect, auth callback redirects, Google connect/callback origins, and reminder links use the shared URL helper. `APP_URL` remains only as the reminder fallback during cutover; Vercel host environment fallbacks were removed.
28. **Done — URL inventory:** remaining absolute URLs are deliberate third-party endpoints or fictional tests: Google OAuth, Calendar, account, and policy pages; Resend API; Canvas allowed hosts; the public GitHub repository; Vercel's JSON schema; and `example.com` fixtures. They are not Runway canonical URLs.
29. **Done — Sender configuration:** `RESEND_FROM` is the only configurable From-address source and retains `Runway <onboarding@resend.dev>` only when unset. The environment template and progress decisions document the verified-domain cutover.
30. **Done — Boundaries:** no migration, scheduler, pace, database policy, owner lock, cron schedule, service-role boundary, or package dependency changed. No Vercel redirect was added.

### Sequential round-trip evidence

| Page | Before | After | Main reason |
| --- | ---: | ---: | --- |
| Shared layout | 3 | 3 | Optional shell reads remain parallel while owner/client state is shared with pages. |
| `/week` | 5 | 4 | Repeated owner lookup removed; stale Google work moved after the response. |
| `/assignments` | 6 | 5 | Owner/client reuse and parallel independent reads. |
| `/assignments/[id]/breakdown` | 8 | 6 | Owner/client reuse plus parallel class/steps and history reads. |
| `/assignments/import` | 3 | 3 | No independent page query exists to shorten further. |
| `/classes` | 5 | 4 | Owner/client reuse and parallel summary reads. |
| `/settings` | 13 | 3 | Google work streams behind Suspense and duplicate token/calendar requests are request-cached. |
| `/checkin` | 7 | 6 | Owner/client reuse and parallel assignment/class reads. |

## 3. Files changed

- `.env.example` — Adds the public canonical site URL placeholder while retaining sender and legacy email-link fallback names.
- `PROGRESS.md` — Records URL/sender decisions, Phase 6.6 work, and live manual checks.
- `next.config.ts` and `vercel.json` — Phase 6.6-1 performance configuration; region only, with cron schedules unchanged.
- `src/lib/auth/server.ts`, `src/lib/db/server.ts`, and `src/lib/settings/server.ts` — Share request-cached authentication, client, and settings-gate work.
- Protected route page and loading files — Parallelize permitted reads and provide loading skeletons without changing actions.
- `src/lib/theme/*`, `src/components/root-document.tsx`, and `src/components/theme-control.tsx` — Preserve System/Light/Dark through cookie plus local storage with pre-paint application.
- `src/app/globals.css` and typography/layout CSS modules — Apply Plus Jakarta Sans, approved type tokens, tabular figures, and left-aligned content sizing.
- Assignment, Settings, and Week presentation files and tests — Apply the approved focused screen declutter while retaining existing data and actions.
- `src/components/action-menu.tsx` and `.module.css` — Generalize the accessible menu used by Assignments and Week.
- `src/lib/week/declutter.ts` and `.test.ts` — Provide visible-range, merging, label, title-cleaning, lane-limit, past-day, and planned-stat helpers.
- `src/components/week-grid.tsx`, `.module.css`, and `.test.tsx` — Render the 56-pixel grid, compact statuses, bounded lanes, past days, and accessible popovers.
- `src/lib/google/duplicate-investigation.test.ts` — Proves recurring, cross-calendar, moved, cancelled, and layout identity behavior with fictional data.
- `src/lib/site-url.ts` and `.test.ts` — Centralize canonical origin and absolute URL construction.
- `src/app/layout.tsx`, public page metadata, sign-in, auth callback, and Google request helper — Use canonical metadata and redirect origins.
- `src/lib/cron/reminder.ts` and `.test.ts` — Build check-in links from the canonical URL with the existing `APP_URL` fallback and configured sender.
- `reports/phase-6-6.md` — Records this evidence, verification, cutover, known limits, and manual checks.

### New dependencies

None. The Phase 6.6 `package.json` and `package-lock.json` diff is empty.

## 4. Database changes

None. Phase 6.6 adds no migration, table, column, constraint, policy, function, generated-type change, or data mutation. Week block merging is presentation-only. The existing fixed-event unique constraint remains `(user_id, source_calendar_id, google_event_id)`.

## 5. Tests

TypeScript and ESLint produced no errors. Vitest reported 71 passing files and 640 passing tests with zero failures. The production build compiled and listed 19 dynamic application routes. The full audit reports 9 high-severity findings in development tooling through one `braces` advisory; the runtime-only audit reports zero vulnerabilities.

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

 Test Files  71 passed (71)
      Tests  640 passed (640)
   Start at  23:17:58
   Duration  1.64s (transform 1.31s, setup 0ms, import 3.45s, tests 985ms, environment 5ms)
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
✓ Compiled successfully in 3.4s
  Running TypeScript ...
  Finished TypeScript in 1243ms ...
  Collecting page data using 7 workers ...
  Generating static pages using 7 workers (0/17) ...
  Generating static pages using 7 workers (4/17)
  Generating static pages using 7 workers (8/17)
  Generating static pages using 7 workers (12/17)
✓ Generating static pages using 7 workers (17/17) in 434ms
  Finalizing page optimization ...
  Collecting build traces ...

Route (app)
┌ ƒ /
├ ƒ /_not-found
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
├ ƒ /privacy
├ ƒ /private
├ ƒ /settings
└ ƒ /week

ƒ Proxy (Middleware)

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

### Route checks

```text
/ 200
/login 200
/privacy 200
/week 307 /login
/checkin 307 /login
/assignments 307 /login
/assignments/import 307 /login
/assignments/new 307 /login
/assignments/00000000-0000-0000-0000-000000000000/edit 307 /login
/assignments/00000000-0000-0000-0000-000000000000/breakdown 307 /login
/classes 307 /login
/settings 307 /login
```

The Vercel-domain scan printed nothing. The service-role scan printed only `src/lib/db/service-client.ts`. The Phase 6.6 package diff printed nothing, and no design-reference file is tracked or staged.

### `git log --oneline` — Phase 6.6

```text
645fe27 P6.6-2: type, layout, Assignments and Settings fixes
2d7044c P6.6-1: speed and theme persistence
```

### `git status --short` — before the report commit

```text
M .env.example
M PROGRESS.md
M src/app/(app)/assignments/assignment-actions-menu.tsx
M src/app/(app)/assignments/assignments.module.css
M src/app/(app)/week/page.tsx
M src/app/(app)/week/week.module.css
M src/app/auth/callback/route.ts
M src/app/layout.tsx
M src/app/login/page.tsx
M src/app/login/sign-in-button.tsx
M src/app/page.tsx
M src/app/privacy/page.tsx
M src/components/replan-controls.tsx
M src/components/sync-controls.tsx
M src/components/week-grid.module.css
M src/components/week-grid.test.tsx
M src/components/week-grid.tsx
M src/lib/cron/reminder.test.ts
M src/lib/cron/reminder.ts
M src/lib/google/request.ts
A reports/phase-6-6.md
A src/components/action-menu.module.css
A src/components/action-menu.tsx
A src/lib/google/duplicate-investigation.test.ts
A src/lib/site-url.test.ts
A src/lib/site-url.ts
A src/lib/week/declutter.test.ts
A src/lib/week/declutter.ts
```

## 6. Deviations from the brief, and why

- DESIGN contains one older sentence saying the calendar card uses 48 pixels per hour, while its Week declutter rule and this task explicitly require 56. The specific declutter rule wins, so the implementation and updated regression test use 56.
- The duplicate report cannot be classified from private live rows. No display de-duplication was added because DESIGN does not authorize hiding events and the code supports several legitimate same-time cases.
- The first sandboxed `npm audit` attempt could not resolve the registry. It was rerun with network access and the successful real output is recorded above.
- The signed-in Week page was compiled, unit-tested, markup-tested, and access-boundary-tested, but not visually inspected because Codex cannot authenticate as the owner.

## 7. Known issues and shortcuts

- The full npm audit reports 9 high-severity findings in development tooling through one `braces` advisory. Runtime dependencies report zero vulnerabilities; the only automatic fix is a forced breaking downgrade and was not applied.
- The real Week density, merge behavior, popover positioning, two-lane overflow, past-day fading, dark theme, and phone presentation require an owner browser check with real data.
- The reported duplicate event still requires the read-only SQL inspection below to distinguish a cross-calendar invitation from two distinct Google events.
- The custom domain, Supabase redirect allowlist, Google OAuth settings, Google domain verification if requested, old-host redirect, and reminder delivery from the new domain are not yet live-verified.
- A simultaneous first-time Runway-calendar creation can still create an extra Google calendar; the existing app reports extras and never deletes them. This is unchanged from Phase 2.

## 8. Setup needed from Mufaddal

Complete the cutover in this order:

1. In Vercel, open runway → Settings → Domains. Add `runway.mrajkotwala.com` and wait until it shows Valid Configuration.
2. Set `NEXT_PUBLIC_SITE_URL = https://runway.mrajkotwala.com` in Vercel for Production and Preview and in `.env.local`, then redeploy. `NEXT_PUBLIC_` variables are baked in at build time.
3. In Supabase, open Authentication → URL Configuration. Set Site URL to `https://runway.mrajkotwala.com` and add `https://runway.mrajkotwala.com/**` to Redirect URLs. Keep the old Vercel entry until everything works.
4. In Google Cloud, open the OAuth client and add `https://runway.mrajkotwala.com/api/google/callback` as an authorized redirect URI; keep the old one. On the OAuth consent screen, add `mrajkotwala.com` as an authorized domain, set the homepage to `https://runway.mrajkotwala.com`, and set the privacy-policy link to `https://runway.mrajkotwala.com/privacy`. If Google asks to verify the domain, use Search Console and add the TXT record it supplies at the registrar.
5. Test sign-in, Google reconnect, and a reminder email on the new domain.
6. Only after those pass, set `runway-xi-ten.vercel.app` to redirect to `runway.mrajkotwala.com` in Vercel Domains.
7. Optional: in Resend, open Domains, add `mrajkotwala.com`, add its DNS records, then set `RESEND_FROM` in Vercel to an address on that domain, for example `runway@mrajkotwala.com`.

No package or database setup is needed.

## 9. How to test it

1. After completing Setup, open the custom domain signed out. Confirm landing, login, and privacy use the custom-domain canonical metadata, then sign in.
2. Reconnect Google Calendar and confirm the callback returns to the custom domain and Settings still shows Connected.
3. Open Week with real data in light and dark on laptop. Confirm 56-pixel rows, study-window hours, merged touching blocks, compact labels, check icons, missed dots, cleaned quiet fixed titles, no more than two lanes plus `+N`, faded past days, one status line, and the planned stat.
4. Click and press Enter on fixed events and planned blocks. Confirm full details appear; Escape and outside click close the popover and return focus.
5. At phone width, swipe through all seven days and confirm no page-level horizontal scrolling.
6. Run this read-only query in the Supabase SQL Editor, replacing only the three placeholders:

```sql
select title, start, "end", source_calendar_id, google_event_id
from fixed_events
where title ilike '%<part of the title>%'
  and start::date between '<date>' and '<date>'
order by start;
```

If the same `google_event_id` appears twice with the same `source_calendar_id`, report a sync/data-integrity bug. Different `source_calendar_id` values with the same title and time mean the invitation is on two selected calendars. Different `google_event_id` values in one calendar mean Google returned two distinct events or recurring instances.
7. Trigger a reminder and confirm its check-in link uses the custom domain. If a sender domain was configured, confirm the From address is the configured sender.
8. Finally test the old Vercel address and confirm it redirects only after the new-domain flows work.

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
- [ ] Run the rollback-only SQL runner in the Supabase SQL Editor and confirm RUNNER REPORT shows 0 failed (owner: Mufaddal).
- [ ] Theme System/Light/Dark works and persists after reload, no flash.
- [ ] Sidebar nav, Check in badge and sync status look like the mockup.
- [ ] Nothing that worked before broke: check-in save, replan, import, step save.
- [ ] Week page matches its mockup in light and dark (calendar, now line, Today panel, banner).
- [ ] Check in matches its mockup in light and dark and saves exactly as before.
- [ ] Signed-out landing, /login, /privacy match the mockup in light and dark.
- [ ] Assignments, plan editor, Import, Classes (Color popover) and Settings (Appearance) match their mockups in light and dark on the live site.
- [ ] Theme persists after reload on every page.
- [ ] Tabs feel instant on the live site (measure in Vercel Logs: before vs after per page).
- [ ] Theme choice survives reload, new tab, sign out and in.
- [ ] New font and bigger type look right on every page, light and dark.
- [ ] Assignments: Overdue first, one action plus a ⋯ menu per row.
- [ ] Settings: one label per duration with hours and minutes side by side, saves exactly as before.
- [ ] Shortfall banner shows at most 3 lines then +N more.
- [ ] Week looks calm with real data (merged blocks, quiet events, +N lanes, faded past days).
- [ ] The duplicate [MMW 14] event: SQL result read and cause identified.
- [ ] Sign-in, Google connect and the reminder email work on runway.mrajkotwala.com.
- [ ] The old vercel.app link redirects to the new domain.
- [ ] Theme choice survives reload.

## 10. Commits

- `P6.6-1: speed and theme persistence`
- `P6.6-2: type, layout, Assignments and Settings fixes`
- `P6.6-3: Week declutter, site URL, Phase 6.6 report`

## 11. Questions

- After running the duplicate-event SQL, which identity pattern appears: same composite key, different selected calendars, or different Google event IDs?
- After the custom-domain checks pass, should the optional verified Resend sender be completed now or left on the onboarding sender?
