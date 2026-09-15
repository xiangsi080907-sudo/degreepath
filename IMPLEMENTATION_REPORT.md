# DegreePath implementation report

Local implementation for review, September 14, 2026. No commit, push or deployment was performed. The existing StudyPilot project was not modified.

## 1. What was built

A working full-stack application with Next.js 16.3.5 / React 19, TypeScript, PostgreSQL, Prisma 6.19.3, Auth.js, Zod and Tailwind. Features include the landing page, public demo, account creation/sign-in/sign-out, protected workspace, six-step onboarding, course history, preferences, overview, degree audit, course explorer, prerequisite graph, next-course recommendations, three plan strategies, what-if validation, draft/saved-plan persistence, and source transparency.

**This is a partial academic MVP, not a fully verified UW graduation planner.** The generic engines work on normalized fixtures; the real UW program still has manual-review rules and cannot claim verified graduation.

## 2. Exact supported institution, campus, program and catalog

- Institution: University of Washington (`uw`).
- Campus: Seattle (`uw-seattle`).
- Program: Computer Science, B.S. (`uw-seattle-cs`), with **partial course-planning coverage**.
- Catalog selector: `uw-seattle-current-2026-09`, displayed as “Current source snapshot · September 2026 (review required).”
- Fully verified governing catalog years: **none**. Source retrieval is not a substitute for historical catalog applicability.
- Computer Engineering and the CS Data Science option are not selectable; their degree implementations remain incomplete.

## 3. Official UW sources integrated

| Source                                                                                                          | Integration                                                             |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [CSE Course Catalog](https://www.washington.edu/students/crscat/cse.html)                                       | Live adapter, source fixtures, undergraduate course/rule normalization  |
| [MATH Course Catalog](https://www.washington.edu/students/crscat/math.html)                                     | Live adapter, source fixtures, undergraduate course/rule normalization  |
| [Autumn 2026 public CSE offerings](https://www.washington.edu/students/timeschd/pub/AUT2026/cse.html)           | Live course-presence import, complete subject/term scope                |
| [CS program catalog](https://www.washington.edu/students/gencat/program/S/ComputerScience-210.html)             | Reviewed mathematics/fundamental groups; full degree remains review     |
| [Allen School degree requirements](https://www.cs.washington.edu/academics/undergraduate/degree-requirements/)  | Saved raw page, 180-credit threshold evidence, checklist conflict notes |
| [Allen School course lists](https://www.cs.washington.edu/academics/undergraduate/degree-requirements/courses/) | Saved raw page for science/elective review; not fully normalized        |

The linked CS checklist and CE catalog were inspected as official source evidence. Their full requirements are not advertised as a supported machine-readable implementation. No NetID-only links were fetched.

## 4. Data successfully imported

The saved-source import and an intentional live importer run both succeeded against local PostgreSQL:

- 93 undergraduate CSE courses and 79 undergraduate MATH courses: **172 total**.
- **54** undergraduate CSE course presences in Autumn 2026 public offerings.
- One CS program/current snapshot with mathematics and fundamental-course logic, grade thresholds and manual-review groups.
- Source URLs, retrieval timestamps, raw snapshots/checksums, parsed rule status and import-run records.

The shipped demo uses the saved September 14 UTC source fixtures. Live refreshes update the database independently. “PARSED” records are not falsely labeled as university-certified or manually VERIFIED.

## 5. Unsupported fields and unresolved rules

- **27 course rules need review**: complex prerequisite prose, placement/AP-score/equivalency conditions and one missing course description (CSE 190). The other 145 prerequisite records are PARSED, including records with no required prerequisite listed.
- Variable-credit courses and credit restrictions are not automatically scheduled.
- CS elective-list allocation, natural-science alternatives, general education, language, residency, transfer/AP applicability, repeat policy, petitions and cumulative GPA need review.
- MATH 208 conflict: current catalog says 4 credits; the department-linked 2023 checklist says 3. Current course credits are used, and the conflict is visible.
- No guarantee of major registration access, seats or future offerings. Section/meeting-time optimization is deferred.
- No fully verified Computer Engineering or historical catalog implementation.

## 6. Database schema

The schema separates academic structures from student-owned data: Institution, Campus, AcademicTerm, CatalogVersion, Department, Course, CourseAttribute, PrerequisiteRule, CourseOffering, Section, Program, ProgramCatalog, RequirementGroup, RequirementCourse, User, StudentProfile, StudentCourse, SavedPlan, SavedPlanTerm, SavedPlanCourse, ImportRun, SourceSnapshot and AuthAttempt.

Foreign keys, compound uniqueness and ownership indexes prevent duplicate academic identities and support user-scoped access. Profiles refer to a program/catalog pair. Saved plans store normalized term/course rows plus a result/config snapshot. Generated drafts store their input snapshot; stale-input drafts are hidden. Section fields are reserved but unpopulated.

## 7. Prerequisite rules

Nested discriminated union expressions preserve AND/OR meaning. Supported operations include course completion, minimum grades, concurrent permission, credit thresholds, program status, explicit permission and unsupported text. The result is SATISFIED/MISSING/UNKNOWN plus explanations. Missing grades, permission and unsupported prose never silently satisfy a hard rule. Recommended preparation is separate from required prerequisites.

## 8. Degree requirement evaluation

The engine evaluates hierarchical all/any/choose-N groups, course lists, credit thresholds, subject/level/attribute filters, total/upper-division credits and manual-review rules. Completed, in-progress and planned evidence are evaluated separately. Explicit double-counting flags allow reuse; ambiguous overlapping allocation remains under review. Heuristic allocation may miss valid allocations; it does not invent one.

## 9. Planning algorithm

Deterministic bounded beam search chooses remaining requirement courses and unsatisfied prerequisite branches. It preserves prerequisite order, validates concurrent batches, applies credit limits, rejects duplicate/unavailable/unsupported courses and respects confirmed offering scope. Bounds are 14 shortlisted courses, 6 courses per batch, 320 enumerated batches, 48 retained batches, beam width 12 and a 16-term horizon.

Constraint validation is separate from scoring. The algorithm does not prove global optimality or that no solution exists outside the search bounds. Only a satisfied, VERIFIED program can receive a complete result. Otherwise the result remains partial with no asserted graduation date.

## 10. Scoring

Scores combine fractional requirement progress (+100), relevant direct prerequisite connections (+4), confirmed availability (+3), unconfirmed availability (−2), accumulated deviation from target credit load (−2 per credit) and term cost (−18 fastest, −10 balanced, −4 light). Weights are centralized in `SCORING`. Strategies target maximum, midpoint and minimum credits respectively. No invented difficulty or offering-rarity statistics are used. User-edited saved plans receive no optimizer score.

## 11. Offering uncertainty

Confirmed course presence is dated source evidence, not a promise of registration. NOT_LISTED applies only to an imported complete subject/term scope. Future unimported terms remain UNKNOWN. Historical-pattern status is modeled but not populated. Published catalog offering text is preserved separately. A plan can be useful while future availability remains uncertain; uncertainty is always visible.

## 12. Multi-institution extensibility

Domain engines operate on opaque course identifiers, generic calendar seasons, normalized rules, offerings and program data. They do not import UW modules. Adapters own source fetching and institution-specific normalization. Prisma models multiple institutions, campuses, programs and catalog versions. Future adapters must namespace identifiers and supply their own calendars and rule data. The current selection UI intentionally exposes only UW Seattle and its partial CS snapshot.

## 13. Major files and modules

| Area              | Files                                                                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application setup | `package.json`, `package-lock.json`, `.env.example`, `.gitignore`, `tsconfig.json`, `next-env.d.ts`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs` |
| Database          | `prisma/schema.prisma`, both `prisma/migrations/*/migration.sql` files, `migration_lock.toml`                                                                    |
| Domain            | `src/domain/types.ts`, `calendar.ts`, `prerequisites.ts`, `graph.ts`, `requirements.ts`, `eligibility.ts`, `planner.ts`                                          |
| Ingestion         | `src/ingestion/adapter.ts`, `uw.ts`, `import.ts`                                                                                                                 |
| Academic data     | `src/data/uw/snapshot.json`, `src/data/demo.ts`, six official HTML files and `manifest.json` in `tests/fixtures/uw/`                                             |
| Server/auth       | `src/auth.ts`, `src/server/db.ts`, `password.ts`, `rate-limit.ts`, `validation.ts`, `http.ts`, `academic.ts`, `student.ts`, `plans.ts`                           |
| API               | `src/app/api/auth/[...nextauth]/route.ts`, `register/route.ts`, `state/route.ts`, `generate/route.ts`, `plans/route.ts`                                          |
| Pages             | `src/app/layout.tsx`, `page.tsx`, `loading.tsx`, `error.tsx`, `login/page.tsx`, `register/page.tsx`, `app/[[...view]]/page.tsx`, `demo/[[...view]]/page.tsx`     |
| UI                | `src/components/brand.tsx`, `auth-form.tsx`, `workspace.tsx`, `src/app/globals.css`                                                                              |
| Commands          | `scripts/local-db.ts`, `seed.ts`, `import-uw.ts`, `capture-fixtures.ts`, `normalize-fixtures.ts`, `status.ts`                                                    |
| Tests             | `vitest.config.ts`, `playwright.config.ts`, `tests/factory.ts`, `domain.test.ts`, `ingestion.test.ts`, `database.test.ts`, `tests/e2e/app.spec.ts`               |
| Review artifacts  | `README.md`, this report, `docs/screenshots/`                                                                                                                    |

Brand rendering is centralized in `brand.tsx`; changing the working name also requires updating page metadata and copy. No existing StudyPilot files were edited.

## 14. Tests and verification

- TypeScript: passed.
- ESLint: passed with no warnings.
- Vitest: **74 tests passed** across engine, fixture and real PostgreSQL integration suites.
- Prisma schema validation and client generation: passed.
- Initial and draft-plan migrations: applied successfully.
- Production build: passed with Next.js 16.3.5.
- Live UW import: passed, 172 courses and 54 offerings.
- npm dependency audit after patches: **zero known vulnerabilities**.
- Playwright: **4 tests passed (11.6 seconds)**, covering the full account flow, public demo, ownership protection and responsive layout.

Tests include scrypt verification, user A/B record and saved-plan isolation, injected owner ID rejection, failed-import rollback, prerequisite Boolean logic and grades, concurrent scheduling, graph cycles/paths, shared alternatives, requirement allocation, credit constraints, deterministic strategies, what-if violations and malformed/changed source rejection. A 60-course synthetic benchmark completes well below its four-second budget on this machine.

## 15. Migrations

1. `202609140001_initial`: normalized PostgreSQL academic/student/auth-support schema.
2. `202609140002_draft_plans`: adds `StudentProfile.draftPlans` JSONB.

Use `npm run db:migrate` for deployment. Migrations are files only in the local checkout; nothing was committed.

## 16. Required environment variables

`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`; `AUTH_TRUST_HOST=true` only when the hosting proxy is trusted. The local ignored `.env` contains a generated secret and local development database settings. No paid API keys are required.

## 17. Run locally

```sh
npm ci
cp .env.example .env
# Put a fresh openssl rand -base64 32 result in AUTH_SECRET.
npm run db:local
# In another terminal:
npm run db:migrate
npm run data:seed
npm run dev
```

Open `http://127.0.0.1:3000`. Public demo: `/demo`; account workspace: `/app`. Do not overwrite an existing configured `.env` unnecessarily.

## 18. Perform UW import

Run `npm run data:import:uw`, then `npm run data:status`. This intentionally refreshes four public sources; it currently targets Autumn 2026 CSE offerings. It never scrapes on app startup. Fixture maintenance commands are documented separately in README. Production refreshes preserve prior valid data on errors.

## 19. Vercel preparation

Provision PostgreSQL, configure the environment, install/generate Prisma, apply migrations in a controlled release step, run the importer, and use the Next.js Vercel preset with `npm run build`. The local embedded PostgreSQL server is not used in production. No deployment or scheduled scraper was created. See README for full steps and domain/session smoke checks.

## 20. Known limitations

The largest limitation is incomplete official degree coverage, not an absent UI: **there is no fully verified CS or CE graduation path or governing catalog year yet.** Other limits include only two imported departments and one offering term, manual AP/transfer/grade/exception policy, no section schedules, conservative course allocation, a bounded non-optimal search, credit-only workload estimates, no offering-rarity data, and no email verification/password recovery. Production abuse controls and monitoring need expansion before large-scale public signup.

## 21. Recommended next milestones

1. Work with reviewed official catalog-year documents to certify one full CS requirement tree and its credit allocation.
2. Import science/general education and elective lists; add explicit AP/transfer and repeat-policy evidence.
3. Expand public offerings by term and normalize registration constraints and sections only where reliable.
4. Implement CE as a separately reviewed program.
5. Expand fixture coverage for complex prerequisite syntax and exhaustive allocation/search edge cases.
6. Add recovery/email verification, deployment monitoring and broader abuse protection before public launch.
