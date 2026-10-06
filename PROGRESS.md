# Runway Progress

## Decisions

- Runtime versions: Node.js 24.21.0 and npm 11.19.0.
- Framework version: Next.js 16.3.8.
- Used `eslint .` because this Next.js version does not provide `next lint`.
- Installed Vitest 4.1.11 because Vitest 5.0.3 requires newer Node type definitions than the generated Next.js scaffold.
- Initialized shadcn/ui with its current default `base-nova` preset; removed the automatically generated sample button so no shadcn components are included.
- Configured production builds to use Next.js webpack mode because Turbopack's CSS worker cannot bind its internal port in the project environment.
- Disabled Next.js automatic agent-rule generation so `next dev` cannot modify the project's required `AGENTS.md` file.
- Live Vercel URL: https://runway-xi-ten.vercel.app

## Known issues

- `npm install` reports nine high-severity vulnerabilities in the generated dependency tree. No forced upgrades were applied because they may introduce breaking changes.
- Next.js reports an unrelated lockfile outside the project root and ignores it; the project uses its own lockfile and all checks pass.

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
