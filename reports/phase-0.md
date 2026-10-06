# Phase 0 Report

## 1. Summary

Phase 0 established Runway as a working Next.js project with strict TypeScript, Tailwind CSS, shadcn/ui configuration, ESLint, and Vitest. The repository was prepared for public release with an MIT license, a public README, a names-only environment template, and a rebuilt clean Git history. The code is published in a public GitHub repository and deployed on Vercel. A visible `v0.0.1` update reached the live site after a push to `main`, confirming that automatic deployments work.

## 2. Requirement check

- **Done — Project skeleton:** Next.js, TypeScript strict mode, App Router, Tailwind CSS, ESLint, the `src/` layout, and the configured import alias are in place.
- **Done — shadcn/ui:** Initialized with its default configuration without retaining a generated component.
- **Done — Automated checks:** Typecheck, lint, Vitest, and production-build scripts exist and pass.
- **Done — Required folder layout:** All Phase 0 project directories exist, with placeholders in intentionally empty directories.
- **Done — Public-repository preparation:** The project has an MIT license, a public README, a names-only environment template, and a clean public history.
- **Done — Public GitHub repository:** The `main` branch is published at https://github.com/Muffi7869/runway.
- **Done — Vercel deployment:** The live deployment is available at https://runway-xi-ten.vercel.app.
- **Done — Automatic deployment check:** The live site displayed `v0.0.1` after the GitHub push.
- **Done — Required service accounts:** Vercel, Supabase, Google Cloud with Google Calendar API, OpenAI with a monthly limit, and Resend are set up.
- **Partly — GitHub repository security:** Secret scanning and push protection still need manual confirmation in GitHub settings.

## 3. Files changed

- `.env.example` — Lists required environment-variable names without values, including `ALLOWED_EMAIL`.
- `.gitignore` — Ignores dependencies, build output, and environment files while allowing `.env.example`.
- `AGENTS.md` — Defines the project contract, safety rules, workflow, and reporting requirements.
- `LICENSE` — Applies the MIT license.
- `PROGRESS.md` — Records Phase 0 decisions, known issues, and completed tasks.
- `README.md` — Provides the public project summary and technology list.
- `components.json` — Stores the shadcn/ui configuration.
- `eslint.config.mjs` — Configures ESLint for the Next.js project.
- `next.config.ts` — Holds the minimal Next.js configuration and prevents automatic instruction-file changes.
- `package-lock.json` — Locks npm dependency versions.
- `package.json` — Defines project metadata, dependencies, and development scripts.
- `postcss.config.mjs` — Configures PostCSS for Tailwind CSS.
- `public/file.svg` — Provides a scaffold static asset.
- `public/globe.svg` — Provides a scaffold static asset.
- `public/next.svg` — Provides a scaffold static asset.
- `public/vercel.svg` — Provides a scaffold static asset.
- `public/window.svg` — Provides a scaffold static asset.
- `reports/.gitkeep` — Keeps the reports directory in Git before the first report.
- `reports/phase-0.md` — Documents Phase 0 implementation and verification.
- `src/app/favicon.ico` — Provides the application favicon.
- `src/app/globals.css` — Defines Tailwind CSS and shadcn/ui theme styles.
- `src/app/layout.tsx` — Defines the root application layout and fonts.
- `src/app/page.tsx` — Displays the minimal Runway setup page and deployment marker.
- `src/components/.gitkeep` — Keeps the empty shared-components directory.
- `src/lib/ai/.gitkeep` — Keeps the empty server-side AI directory.
- `src/lib/db/.gitkeep` — Keeps the empty database-query directory.
- `src/lib/google/.gitkeep` — Keeps the empty Google Calendar directory.
- `src/lib/pace/.gitkeep` — Keeps the empty pace-math directory.
- `src/lib/scheduler/basic.test.ts` — Provides the initial passing Vitest check.
- `src/lib/utils.ts` — Provides the shadcn/ui class-name utility.
- `supabase/migrations/.gitkeep` — Keeps the empty database-migrations directory.
- `tsconfig.json` — Configures strict TypeScript and the import alias.

## 4. Database changes

None. Phase 0 created the migrations directory but did not add a schema or change the data model.

## 5. Tests

Result summary: four commands passed, zero commands failed. TypeScript and ESLint reported zero errors. Vitest reported 1 passing test file and 1 passing test, with zero failures. The production build compiled successfully and generated both application routes as static content.

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


 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  00:51:27
   Duration  94ms (transform 20ms, setup 0ms, import 25ms, tests 1ms, environment 0ms)
```

### `npm run build`

```text
Now using node v24.21.0 (npm v11.19.0)

> runway 0.1.0 build
> next build --webpack

▲ Next.js 16.3.8 (webpack)
⚠ Warning: Next.js ignored a package lockfile outside the current Git repository.
 To use this directory, set `outputFileTracingRoot` in the Next.js configuration.

✓ Running next.config.ts took 77ms

  Creating an optimized production build ...
✓ Compiled successfully in 606ms
  Running TypeScript ...
  Finished TypeScript in 656ms ...
  Collecting page data using 5 workers ...
  Generating static pages using 5 workers (0/4) ...
  Generating static pages using 5 workers (1/4)
  Generating static pages using 5 workers (2/4)
  Generating static pages using 5 workers (3/4)
✓ Generating static pages using 5 workers (4/4) in 224ms
  Finalizing page optimization ...
  Collecting build traces ...

Route (app)
┌ ○ /
└ ○ /_not-found


○  (Static)  prerendered as static content
```

## 6. Deviations from the brief, and why

- Vitest 4.1.11 was used because Vitest 5 required newer Node type definitions than the generated Next.js scaffold provided.
- The production build uses Next.js webpack mode because the available environment does not permit the internal port binding used by the Turbopack CSS worker.
- The current shadcn/ui default generated a sample button during initialization; it was removed to comply with the requirement not to add components.
- Verification output included machine-specific absolute paths and npm package banners containing the literal at-sign character. Those strings were replaced with neutral wording in this public report to comply with the repository privacy rules; command results and pass counts are unchanged.
- The initial private-repository validation was discarded before public release. Git history was rebuilt locally so the public repository began with clean content and the configured owner identity.

## 7. Known issues and shortcuts

- npm reported nine high-severity findings in the generated dependency tree. No forced dependency upgrades were applied because they could introduce breaking changes.
- Next.js reports and ignores an unrelated lockfile outside the project root; this warning does not prevent successful builds.
- GitHub secret scanning and push protection are not yet confirmed enabled.
- The application remains a Phase 0 skeleton; product features, authentication, database schema, integrations, scheduling, and check-ins are intentionally not implemented yet.

## 8. Setup needed from Mufaddal

- **Complete:** Vercel is connected and the `v0.0.1` automatic deployment was confirmed live.
- **Complete:** The Supabase account is created.
- **Complete:** The Google Cloud project is created and the Google Calendar API is enabled.
- **Complete:** The OpenAI account is configured, the credential is stored outside the repository, and a monthly limit is set.
- **Complete:** The Resend account is created.
- **Still needed:** In the GitHub repository settings, confirm that secret scanning and push protection are enabled.

## 9. How to test it

1. Open https://runway-xi-ten.vercel.app.
2. Confirm the page shows `Runway`, `Setup complete. Building soon.`, and `v0.0.1`.
3. Open https://github.com/Muffi7869/runway and confirm the repository is public and includes `LICENSE` and `README.md`.
4. For a local verification, install dependencies with `npm install` using Node.js 24.
5. Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`; all four commands should exit successfully.

## 10. Commits

- `P0-T1: project skeleton`
- `P0-T2: public GitHub repo connected`
- `P0-T3: Vercel deploy live`
- `P0: phase report`

## 11. Questions

- Should GitHub secret scanning and push protection be treated as a Phase 0 exit requirement before Phase 1 begins?
