# DegreePath Business / multi-major release

Implemented September 14, 2026 (source capture September 15 UTC). Production was not accessed or changed.

## Architecture and behavior

The initial audit found a generic prerequisite/requirement/planner engine and an existing profile-to-program-catalog relation. Single-major assumptions lived in onboarding, the demo dataset, validation, dashboard course examples, and saved-plan presentation. The database did not need replacement or a new relation.

- `src/data/majors.ts` is the supported-major registry. Stable program IDs are `uw-seattle-cs` and `uw-seattle-business`; catalog-specific keys pair these with snapshot IDs. Metadata includes school, university, campus, coverage, course scope, and dashboard example.
- Program requirement trees remain academic data. The same engine handles both majors. A boundary helper scopes the planning course universe while retaining all courses in user history for credit evidence. Exact original CS-plan equality is regression tested.
- `StudentProfile.programCatalogId` stores one active curriculum. New onboarding offers both imported programs. Every onboarded view exposes an expandable selector and short confirmation. Demo supports both through session storage without authentication.
- Major switching validates a supported, imported catalog and updates only the session user's profile/draft context. The UI first persists pending history/preferences. Requirement progress and recommendations immediately use the new curriculum; generation is explicit.
- `StudentCourse` remains user-scoped. No duplicate history is created per major. Completed/in-progress entries, grades, explicit credits, and preferences survive switches. Existing limitations on transfer equivalency remain.
- `SavedPlan.config.programCatalogId` already records the originating curriculum. New saves validate the submitted context against the server state. Saved plans are labeled and viewed as read-only snapshots, including across majors. Opening one does not replace active history or drafts. To create a revised plan, choose its major and generate using current history. Legacy snapshots without a key default to historical CS.
- Authentication, user ownership checks, and university-based purple/gold styling remain in place. Request schemas reject unsupported IDs and injected owner fields. No new dependency or environment variable.

## Verified Business scope

The [official UW BABA catalog](https://www.washington.edu/students/gencat/program/S/Business-300.html) supports a general Business Administration degree and additional named major curricula. This release supports shared foundations/core only:

| Group         | Modeled courses/rule                                                                       |
| ------------- | ------------------------------------------------------------------------------------------ |
| Foundations   | ECON 200; ECON 201; one of MATH 112, MATH 124, MATH 134                                    |
| Lower core    | ACCTG 215; ACCTG 225; QMETH 201; MGMT 200                                                  |
| Upper core    | B ECON 300; MKTG 301; I S 300; I BUS 300; OPMGT 301; FIN 350; MGMT 300; MGMT 320; MGMT 430 |
| Total credits | 180-credit threshold, with applicability still subject to review                           |

Not fully modeled: 16 upper-division business elective credits, specialization-specific curricula, general education, composition/writing, GPA, admissions, residency, repeated-course/credit restrictions, and approved substitutions. These appear as manual-review groups, not silently satisfied requirements. Foster's broader calculus alternatives and inconsistent writing totals require academic review.

Fifteen new courses are source-derived. Four complex prerequisites (B ECON 300, I S 300, OPMGT 301, FIN 350) remain `RAW_UNSUPPORTED`/`NEEDS_REVIEW`; automatic scheduling does not assume eligibility. This can block downstream capstone scheduling. Business offerings were not imported or guessed; future availability is unknown. Business remains `NEEDS_REVIEW`, with partial plans and no claimed graduation date. No optimality guarantee was added.

Official sources:

- [UW Business catalog](https://www.washington.edu/students/gencat/program/S/Business-300.html)
- [Foster curriculum](https://foster.uw.edu/academics/degree-programs/undergraduate-programs/curriculum/)
- [Foster major options](https://foster.uw.edu/academics/degree-programs/undergraduate-programs/curriculum/options/)
- UW course catalogs: [ACCTG](https://www.washington.edu/students/crscat/acctg.html), [ECON](https://www.washington.edu/students/crscat/econ.html), [FIN](https://www.washington.edu/students/crscat/finance.html), [I S](https://www.washington.edu/students/crscat/infosys.html), [I BUS](https://www.washington.edu/students/crscat/intlbus.html), [MGMT](https://www.washington.edu/students/crscat/mgmt.html), [MKTG](https://www.washington.edu/students/crscat/mktg.html), [OPMGT](https://www.washington.edu/students/crscat/opmgmt.html), [QMETH](https://www.washington.edu/students/crscat/qmeth.html), [B ECON](https://www.washington.edu/students/crscat/busecon.html).

The catalog is the normalized requirement source; Foster pages were cross-checks. Raw UW program/course HTML, URL manifests, capture timestamps, normalized evidence, and importer hashes are retained. Changed core/calculus/economics/total-credit source text fails closed for manual review. Further source-policy changes still require human diff review before import.

## Database and import

**Migration: none. Migration name: not applicable.** Existing `StudentProfile.programCatalogId` and `SavedPlan.config` are sufficient. No migration history was edited, no backfill is needed, and existing CS profiles/plans retain their keys. Do not run a production migration for this release.

The new `data:import:business` command reads committed source snapshots, transactionally upserts Business courses/catalog/requirements and source evidence, and reuses UW institution/calendar metadata. It does not replace CS courses or offerings and never writes student records or saved plans. It is repeatable. Existing MATH data must already be imported (as in the existing production installation).

Local initialization now requires:

```sh
npm ci
npm run db:generate
npm run db:migrate
npm run data:seed
npm run data:import:business
```

Use the local database URL from `.env.example`, with `npm run db:local` running separately. Tests are pinned to `127.0.0.1:54329`; Playwright refuses to reuse another app server. Do not point automated test fixtures at production.

## Changed areas and tests

Changes cover the major registry/selector, workspace onboarding and dashboard, profile API/service validation, generation/save boundaries, saved snapshot presentation, demo/academic data composition, Business capture/normalization/import commands, official fixtures, documentation and screenshots. Prisma schema and the planner search algorithm are unchanged.

Added tests cover registry validation, legacy plan association, exact CS regression, official course provenance, source-change rejection, shared calculus allocation, outside-major credit evidence, accounting chains/statistics alternatives, deterministic partial Business plans, unavailable/impossible cases, database history/plan preservation and switching back. Browser additions cover Business onboarding, save association, both switch directions, changed audits, logout/login persistence, cross-major snapshots, invalid/owner-injected requests, unauthenticated mutation rejection, and mobile demo switching. Existing authenticated cross-user plan protections remain tested and include an injected major-change attempt.

Final validation:

| Check                         | Result                                                  |
| ----------------------------- | ------------------------------------------------------- |
| `npm run typecheck`           | Passed                                                  |
| `npm run lint`                | Passed                                                  |
| `npm test`                    | 88 passed across 5 files (11 more than the original 77) |
| `npx prisma validate`         | Passed                                                  |
| `npm run build`               | Passed, final clean Turbopack build                     |
| `npm run test:e2e`            | 6 passed, including both new multi-major scenarios      |
| `npm audit --omit=dev --json` | 0 vulnerabilities                                       |
| `git diff --check`            | Passed                                                  |

The first new browser scenario stopped at a Save button before navigating to the plan view; the test navigation was corrected and the complete suite rerun successfully. A sandbox-blocked Turbopack worker left a cached build error; moving only generated `.next` output aside and rebuilding with local worker access succeeded. No failing assertion was removed or weakened. Vitest's existing future-config warning and Playwright's color-environment warning are non-fatal.

Final review: CS signup/planning/audits/what-if/saved ownership and login flows passed unchanged; Business selection, core audit, partial planning and preserved records passed; recruiter demo switching passed without authentication. Desktop (1440px) and mobile (390px) screenshots were visually reviewed, including both major cards, Business course examples, shared UW styling and explicit review disclosures. Mobile overflow assertions passed. Screenshots are in `docs/screenshots/business.png` and `docs/screenshots/mobile-business.png`.

## Safe release to the existing Vercel project

These are operator instructions; Codex has not executed production steps.

1. Review the diff and this report. Preserve the existing production configuration (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST`). No new variables are required. Ensure Preview uses a separate non-production database before testing authenticated writes. Set Preview `AUTH_URL` to the preview domain used for sign-in.
2. With the local database running and both catalogs imported, run:

   ```sh
   npm run typecheck
   npm run lint
   npm test
   npx prisma validate
   npm run build
   npm run test:e2e
   npm audit --omit=dev --json
   ```

3. From the current reviewed working tree, create and push a release branch:

   ```sh
   git switch -c codex/uw-business
   git add README.md docs package.json playwright.config.ts vitest.config.ts scripts src tests
   git diff --cached --stat
   git commit -m "Add UW Business and persistent multi-major planning"
   git push -u origin codex/uw-business
   ```

4. Open the branch's deployment in the **existing Vercel project**. Test `/demo` switching immediately. For authenticated preview tests, initialize only the separate preview database with the existing migrations, CS seed and Business import. Never use production credentials for preview tests.
5. Review/merge the branch into the Vercel project's configured Production Branch (currently the local checkout is `main`; verify the project's setting). The existing Git integration deploys that merge. Wait for the deployment to be Ready. [Vercel Git deployment behavior](https://vercel.com/docs/git) and [environment scoping](https://vercel.com/docs/environment-variables).
6. No Prisma migration is required. After deployment, run the additive Business import from this exact released checkout against the production database, once you have reviewed/confirmed the target. In **zsh**, paste the existing production connection string at the hidden prompt (not into shell history):

   ```sh
   read -s 'degreepath_release_db?Production DATABASE_URL: '
   echo
   DATABASE_URL="$degreepath_release_db" npm run data:import:business
   DATABASE_URL="$degreepath_release_db" npm run data:status
   unset degreepath_release_db
   ```

   The value should be the existing Prisma Postgres connection string supported by the deployed Prisma client. Use a trusted local/operator environment with installed dependencies. Do not run `data:seed`, `data:import:uw`, `db:push`, reset, or test commands against production as part of this release. Authenticated Business selection appears only after the catalog exists; the public demo uses its shipped snapshot. If import fails, it rolls back its academic transaction; existing CS remains usable. Inspect the import status before retrying.

7. On the production domain, smoke-test both selectors, source status, an existing CS account/history/saved snapshot, and the public Business demo. Verify saved records survive a switch back. Do not assume a successful Vercel build ran the import: imports are explicit operational steps.

Deployment readiness is for **partial Business planning**, not complete Foster graduation auditing. Retain database restore capability before any operational import. If rollback is needed, prefer fixing forward: old application code may not understand profiles already switched to Business. Do not delete Business catalogs that profiles reference.

## Follow-up review

An academic/adviser review is the priority: reconcile Foster/catalog writing and calculus differences, normalize specialization/elective/residency rules, and review the four complex prerequisites with grammar-specific fixtures. A stronger-model code review could additionally inspect cross-tab save concurrency and the large existing workspace component. These are not claims of full-degree support or reasons to expand scope into a planner rewrite.
