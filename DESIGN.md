# DESIGN.md — Runway visual system

The source of truth for how Runway looks. Read it before any UI work. Visual reference mockups live in `design-ref/` (git-ignored, local only). They are design-component source: read their markup and inline styles for exact layout, spacing and copy. Parts with `{{…}}` or `<sc-for>` are template placeholders and won't render standalone. When this file and a mockup disagree, this file wins.

## Principles

- **Calm and minimal.** Lots of white space, few borders, soft tints. Nothing shouts.
- **Color means class.** Each class has one soft tint. Fixed events (classes, lab) are neutral gray. The UI chrome stays neutral so class colors carry meaning.
- **One quiet accent.** Periwinkle is used for the primary button, today, selection, links and the "now" line. Never as a large fill.
- **Numbers line up.** Times, minutes, percents and pace use tabular figures (`font-variant-numeric: tabular-nums`) in the main font. No monospace font anywhere.
- **Readable first.** Comfortable text sizes, content uses the available width, no tiny caps labels.
- **Laptop first, works on phone.** Sidebar + content on laptop; everything stacks on a phone. No horizontal page scroll; wide tables scroll inside their card.

## Theme

- Light and dark, both first-class. Default follows the device (`prefers-color-scheme`). Settings → Appearance offers System / Light / Dark, stored per device (localStorage + cookie). No database change.
- Theme is applied as `data-theme="light|dark"` on `<html>` before first paint so there is no flash. The saved preference (cookie `runway-theme` = system|light|dark, 1 year, path=/, SameSite=Lax, mirrored in localStorage) is read on the server in the root layout and by the inline script. "System" follows the device only while the saved preference is system; an explicit Light or Dark always wins and survives reloads, new tabs and sign-out.
- All colors are CSS variables. Components never use raw hex.

## Tokens

### Neutrals and accent

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | #F7F7F5 | #141413 | Page background |
| `--surface` | #FFFFFF | #1B1B1A | Cards, sidebar, inputs |
| `--surface-2` | #F0F0ED | #242422 | Hover, subtle fills, fixed events, segmented track |
| `--ink` | #191918 | #E3E2DE | Primary text |
| `--ink-2` | #55554F | #A8A7A1 | Secondary text |
| `--ink-3` | #6B6B65 | #8F8E88 | Tertiary text, labels (still ≥ 4.5:1) |
| `--line` | #E5E4E0 | #2A2A28 | Card borders, dividers, grid lines |
| `--line-2` | #D4D3CE | #363633 | Input and button borders |
| `--accent` | #6F80EC | #7783D6 | Now line, focus ring, checkbox accent |
| `--accent-ink` | #3F50C2 | #A9B1E8 | Links, selected labels |
| `--accent-soft` | #EEF0FD | #232638 | Badges, today column wash |
| `--primary` | #E3E7FD | #272C47 | Primary button fill, today date circle |
| `--primary-hover` | #D6DCFB | #2F3556 | Primary button hover |
| `--primary-line` | #C9D0F8 | #383F66 | Primary button border |
| `--on-primary` | #2B3990 | #C7CDF3 | Primary button text (600 weight) |
| `--warn` | #924112 | #DDA47E | Shortfall text |
| `--warn-soft` | #FBEEE4 | #2B211A | Shortfall banner fill |
| `--ok` | #2B6E4C | #8FBFA3 | Success text, connected status |
| `--ok-soft` | #E5F2EA | #1A2520 | Success fill |
| `--danger` | #A8322D | #D98884 | Destructive text (Remove) |

### Class palette (the 8 stored keys)

Each key has a tint fill, a text color on that fill, and a dot color. Study blocks and class chips use fill + text; dots use the dot color.

| Key | Light fill / text / dot | Dark fill / text / dot |
| --- | --- | --- |
| blue | #E7EEFC / #1D4AA6 / #3B6FE0 | #1D2333 / #AAB8DD / #6E89CF |
| green | #E3F2E9 / #1D6640 / #2F9A5E | #1B2620 / #A4C6B1 / #5E9F79 |
| purple | #EEE8FB / #5634A6 / #7B57D6 | #242033 / #BDB1DE / #8B7AC4 |
| orange | #FCEDE1 / #8A4016 / #E07B39 | #2B221B / #DCB498 / #C38A5F |
| red | #FBE9E8 / #8E2C27 / #D2504A | #2D1F1E / #DDABA8 / #C27470 |
| teal | #E0F1F1 / #1A5B5B / #2A9696 | #192827 / #9EC6C3 / #4F9D99 |
| pink | #FBE8F1 / #8A2D5C / #CF5C93 | #2C1E25 / #D9AFC4 / #BF7C9D |
| yellow | #F8F0D6 / #6E5410 / #C29A1E | #2A2519 / #D6C291 / #B89B55 |

## Type

- **Plus Jakarta Sans** (400, 500, 600, 700) for everything, loaded with `next/font/google`. Remove Geist and Geist Mono entirely.
- Numbers: `tabular-nums` utility class on times, durations, percents, pace, counts.
- Scale (rem, base 16px): body 16px / 1.5; table rows and secondary text 15px; small 13–14px (never below 13px); page title 32px 700, letter-spacing −0.02em; section/card title 18px 600; big stat 28px 700; sidebar nav 15px 500.
- Labels: sentence case, 14px 500, `--ink-2`. Uppercase only for the tiny group headers on Assignments ("This week") at 13px 600, letter-spacing 0.04em.
- Never Inter, Roboto or Arial.

## Shape and spacing

- Radius: cards 14px, buttons and inputs 9px, segmented items 8px, chips and badges pill (99px), study blocks 8px.
- Page padding 32px top, 40px sides. Gaps between cards 20–24px. Card padding 24px.
- Content width: main content fills the space beside the sidebar up to max-width 1320px, LEFT-aligned (no narrow centered column). Settings and Check in may cap at 960px, still left-aligned.
- Shadows only on floating things (popovers, toasts): `0 10px 30px rgba(0,0,0,.14)`. Cards are flat with a 1px `--line` border.
- No gradients, no left-border accent cards, no emoji.

## Components

| Component | Spec |
| --- | --- |
| Button (default) | 40px tall, 14px side padding, `--surface` fill, `--line-2` border, 500 weight. Hover `--surface-2`. |
| Button (primary) | `--primary` fill, `--primary-line` border, `--on-primary` text, 600 weight. Hover `--primary-hover`. One per screen area. |
| Button (ghost) | No border or fill, `--ink-2` text. Used for secondary actions like Rough day, Add step. |
| Button (small) | 32px tall, 13px text. Row actions. |
| Icon button | Square, `aria-label` required. Icons are 18px outline strokes at 1.6 width (lucide-style), `currentColor`. |
| Card | `--surface`, 1px `--line`, radius 14. |
| Class chip | Pill, class fill + text, 12px 500. |
| Tag | 12px 500, 1px `--line-2` border, radius 6. Warn variant: `--warn-soft` fill, `--warn` text ("1h 15m short"). |
| Segmented control | `--surface-2` track with 3px padding; selected item `--surface` with 1px `--line-2` ring. Used for check-in percents, Assignments tabs, theme switch. |
| Progress bar | 4–6px tall, `--surface-2` track, class dot color fill, rounded. |
| Banner | Radius 12, 12×16 padding, icon + one sentence + optional link. Warn and ok variants. |
| Stepper | − value + in a bordered pill; value in mono. Steps of 5 minutes. |
| Inputs / selects | 40px tall, `--surface`, `--line-2` border, focus ring 2px `--accent`. Every input has a visible `<label>`. |
| Nav item | 40px tall, radius 8, `--ink-2` text; active = `--surface-2` fill + `--ink` text. |
| Study block (calendar) | Class fill + text, radius 8, title 600 + step name. Checked-in or missed blocks at 60% opacity with "Checked in" / "Not checked in". Fixed events: `--surface-2` fill, `--line` border, `--ink-2` text. |

## Layout

- **App shell:** left sidebar 232px (`--surface`, right border) with logo, nav (Week, Check in with a count badge of unchecked blocks, Assignments, Classes, Settings), and at the bottom the Google sync status and the user. Content area grows. On a phone the sidebar stacks above content (flex-wrap; no sticky, no 100vh sidebar).
- **Logo:** rounded square in `--ink` with three stacked runway lines in `--bg`, then "Runway" 16px 600.

## Screens

Each screen has a mockup of the same name in `design-ref/`.

1. **Week** (`Main.dc.html`): header "This week", date range and planned total; buttons ‹ Today › , Rough day (ghost), Replan. ONE status line under the buttons: "Synced 2 min ago" (Replan syncs first; "Sync now" moves into a small ⋯ menu). Shortfall banner under the header: one icon, one line per shortfall, max 3 lines then "+N more". Declutter rules for the calendar: 56px per hour; hour range = study window (expand only if an event falls outside); consecutive blocks of the same assignment on the same day merge into ONE visual block ("PA3 · 3 steps", time range = first start to last end); blocks under 45 minutes show the title only, one line; blocks of 45 minutes or more show title + step; the time line appears only on blocks of 75 minutes or more; checked-in blocks show a small check icon (no "Checked in" text) at 55% opacity; missed blocks show a small warn dot; fixed events are quiet: no border, `--surface-2` fill, `--ink-2` text, title only, strip bracket prefixes like "[CSE 12]" to "CSE 12"; overlapping items get at most 2 lanes, a third shows "+1"; clicking any block opens a small popover with full title, step(s), time and status. Past days at 70% opacity. Today panel: big stat "3h 20m" on one line (not wrapped). Calendar card: 56px hour gutter + 7 day columns, 48px per hour, grid lines from `--line`. Today's header uses the primary circle; today's column has a faint accent wash; a 2px accent "now" line with a dot. Right "Today" panel (280px): planned today, up next, tonight's check-in card with a primary "Check in now", due soon with progress bars. Calendar scrolls horizontally inside its card on narrow screens.
2. **Check in** (`Checkin.dc.html`): label with the date, title "How did today go?", helper sentence. One card per assignment: class dot, title, due; "From yesterday" warn pill if relevant; step name + planned time (mono); segmented 0/25/50/75/100 (values below the stored percent disabled); "Minutes actually worked" input. "Log work on something else" ghost button. Right summary card: time worked, steps moved forward, primary Save; success banner after save with a link to the new plan. A small "Your pace" card per class.
3. **Assignments** (`Assignments.dc.html`): groups in order Overdue (only if any) / This week / Next week / Later. Each row has ONE visible action (Plan, or Break down if not broken down) plus a ⋯ menu for Edit, Done, Drop; never wrap actions onto two lines. Weight tag only for "high"; never show "medium" or "low". Header with counts, Import from Canvas (default) and New assignment (primary). Segmented tabs Active / Done / Dropped with counts. One card with a table: Assignment (class chip + title + tags), Due (date + relative/time line, "Tomorrow" in warn), Progress (bar + %), Time (current plan in mono + "AI guessed …"), actions (Plan button, more menu). Active rows grouped by This week / Next week / Later. Tags: "Needs spec", "Xh Ym short". Unbroken assignments show "Not broken down yet" and a primary "Break down".
4. **Assignment plan** (`Breakdown.dc.html`): breadcrumb, class chip, title, meta line, Edit details and Mark done. Steps card: "AI estimate · Your plan" line, "Unsaved changes" badge, rows of number, inline-editable name, progress pill (Done / % / Not started), minutes stepper, move and delete icons. Footer: Add step (ghost), Regenerate with AI (disabled with the reason beside it when locked), Save plan (primary). Right column: Spec card (preview, Edit text, Upload PDF) and Scheduled card listing upcoming blocks.
5. **Import from Canvas** (`Import.dc.html`): breadcrumb, title, "Fetch again". New card: select-all, rows with checkbox, title + course code (mono), matched class (dot + name + "matched") or a required "Choose class…" select in warn style, due date + time input with "Time not in feed" tag for date-only items. Due date changed card with strikethrough old date and Update. Already imported in a collapsible. Footer bar with the "Not shown: …" line, Cancel, and primary "Import N selected".
6. **Classes** (`Classes.dc.html`): grid of cards (min 300px). Each: class dot + name, Rename (ghost), **Color** button that opens a 4×2 swatch popover (no always-visible swatches). Big mono pace ("1.35×") and a plain sentence ("Work takes you about 35% longer than estimated." / "Not enough check-ins yet."). Stats row: Active, Logged, Next due.
7. **Settings** (`Settings.dc.html`): labels in sentence case ("Most study per day"), one combined duration control per setting (hours + minutes side by side under ONE label, not two stacked caps labels). One column, max 960px, left-aligned. Each section is a card with a title + one-line explanation on the left and controls on the right (stacks on phone): Study rules (Save and replan), Nightly check-in, Google Calendar (connected banner, calendar checkboxes), Canvas feed (Saved ••••, Replace, Remove), Days off (list + add), Appearance (System/Light/Dark), Account (Sign out).
8. **Sign in / landing** (`Login.dc.html`): split screen. Left: logo, headline "Never cram the night before again.", one-sentence pitch, full-width "Continue with Google", "Private app" note, three numbered how-it-works steps, footer with © and Privacy. Right: dotted-grid panel (`--panel` #EFEFEB light / #181817 dark, dots #D9D8D3 / #2C2C2A, 20px grid) with a decorative product preview: mini week card, floating check-in card, "Replanned" toast. The preview is `aria-hidden`. On phone the preview stacks below or hides.
9. **Privacy** and the "private app" page use the same shell as Sign in (no sidebar), plain readable text, max 680px.

## Accessibility

- Text contrast ≥ 4.5:1 (all tokens above meet it on their intended surfaces).
- Real `<button>`, `<a>`, `<input>` + `<label>`; icon-only buttons have `aria-label`; decorative SVGs `aria-hidden`.
- Visible focus ring on everything focusable (2px `--accent`, 1px offset).
- Touch targets ≥ 40px. Color is never the only signal (tags and text accompany warn states).
- Respect `prefers-reduced-motion`; transitions ≤ 150ms, opacity/color only.
