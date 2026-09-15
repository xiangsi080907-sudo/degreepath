import {
  AcademicData,
  Course,
  Plan,
  PlanTerm,
  Preferences,
  Program,
  RecordContext,
  StudentCourse,
  Term,
} from "./types";
import {
  compareTerms,
  nextTerm,
  recordBeforeTerm,
  termKey,
  termLabel,
} from "./calendar";
import { availability } from "./eligibility";
import {
  evaluatePrerequisite,
  missingPrerequisiteCourseIds,
} from "./prerequisites";
import { getCoursesUnlockedBy } from "./graph";
import {
  evaluateRequirement,
  remainingCourseIds,
  requirementLeaves,
} from "./requirements";
export const SCORING = {
  progress: 100,
  unlock: 4,
  confirmed: 3,
  uncertainty: 2,
  loadDeviation: 2,
  termCost: { fastest: 18, balanced: 10, light: 4 },
};
export type Violation = {
  term: string;
  courseId?: string;
  message: string;
  repair: string;
  severity: "ERROR" | "WARNING";
};
export function validatePlan(
  plan: Pick<Plan, "terms">,
  data: AcademicData,
  record: RecordContext,
  prefs: Preferences,
): Violation[] {
  const issues: Violation[] = [];
  const seen = new Set(
    record.courses
      .filter((c) => c.status === "COMPLETED" || c.status === "IN_PROGRESS")
      .map((c) => c.courseId),
  );
  const projected: StudentCourse[] = [];
  let previous: Term | undefined;
  for (const t of plan.terms) {
    const key = termKey(t.term);
    if (
      !data.campus.calendar.seasons.includes(t.term.season) ||
      compareTerms(t.term, prefs.start, data.campus.calendar) < 0
    )
      issues.push({
        term: key,
        message: "Invalid term or before planning start",
        repair: "Choose a term within the planning horizon",
        severity: "ERROR",
      });
    if (previous && compareTerms(previous, t.term, data.campus.calendar) >= 0)
      issues.push({
        term: key,
        message: "Terms must be unique and chronological",
        repair: "Reorder terms chronologically",
        severity: "ERROR",
      });
    previous = t.term;
    const prior = {
      ...record,
      courses: [
        ...recordBeforeTerm(record.courses, t.term, data.campus.calendar),
        ...projected,
      ],
      concurrent: t.courseIds,
    };
    let credits = 0;
    if (
      !prefs.includeSummer &&
      t.term.season === data.campus.calendar.optionalSeason
    )
      issues.push({
        term: key,
        message: "Optional term is disabled",
        repair: "Enable summer or move these courses",
        severity: "ERROR",
      });
    for (const id of t.courseIds) {
      const course = data.courses.find((c) => c.id === id);
      const add = (
        message: string,
        repair: string,
        severity: "ERROR" | "WARNING" = "ERROR",
      ) => issues.push({ term: key, courseId: id, message, repair, severity });
      if (!course) {
        add("Unknown course", "Choose an imported course");
        continue;
      }
      credits += course.maxCredits;
      if (seen.has(id))
        add("Course repeated or already in progress", "Remove the duplicate");
      seen.add(id);
      if (prefs.unavailable.includes(id))
        add("Course marked unavailable", "Remove or make available");
      if (course.minCredits !== course.maxCredits)
        add(
          "Variable-credit course requires review",
          "Select credits with an adviser before planning",
        );
      if (course.restrictions)
        add(course.restrictions, "Review registration and credit restrictions");
      const overlaps = course.overlaps.filter(
        (x) =>
          prior.courses.some((c) => c.courseId === x) ||
          t.courseIds.includes(x),
      );
      if (overlaps.length)
        add(
          `Credit overlaps with ${overlaps.join(", ")}`,
          "Review credit overlap; choose one course",
        );
      const e = evaluatePrerequisite(course.prerequisite, prior, data.courses);
      if (e.status !== "SATISFIED")
        add(
          e.reasons.join("; "),
          "Move the course after its prerequisites or resolve the missing evidence",
        );
      if (
        availability(course, t.term, data.offerings, data.offeringCoverage) ===
        "NOT_LISTED"
      )
        add(
          "Not listed in the imported official offering set",
          "Move to a different term or refresh offering data",
        );
      if (
        availability(course, t.term, data.offerings, data.offeringCoverage) ===
        "UNKNOWN"
      )
        add(
          "Offering is unknown for this term",
          "Verify the official Course Offerings before registering",
          "WARNING",
        );
    }
    if (credits < prefs.minCredits || credits > prefs.maxCredits)
      issues.push({
        term: key,
        message: `${credits} credits is outside ${prefs.minCredits}–${prefs.maxCredits}`,
        repair: "Adjust courses or credit preferences",
        severity: "ERROR",
      });
    projected.push(
      ...t.courseIds.map((courseId) => ({
        courseId,
        status: "COMPLETED" as const,
      })),
    );
  }
  return issues;
}
function combinations(
  candidates: Course[],
  min: number,
  max: number,
  target: number,
): Course[][] {
  const out: Course[][] = [];
  function visit(index: number, chosen: Course[], credits: number) {
    if (chosen.length && credits >= min && credits <= max)
      out.push([...chosen]);
    if (chosen.length >= 6 || out.length >= 320) return;
    for (let i = index; i < candidates.length; i++) {
      const c = candidates[i];
      if (
        credits + c.maxCredits <= max &&
        !chosen.some(
          (x) => x.overlaps.includes(c.id) || c.overlaps.includes(x.id),
        )
      ) {
        chosen.push(c);
        visit(i + 1, chosen, credits + c.maxCredits);
        chosen.pop();
      }
    }
  }
  visit(0, [], 0);
  return out
    .sort(
      (a, b) =>
        Math.abs(a.reduce((s, c) => s + c.maxCredits, 0) - target) -
          Math.abs(b.reduce((s, c) => s + c.maxCredits, 0) - target) ||
        a
          .map((c) => c.id)
          .join()
          .localeCompare(b.map((c) => c.id).join()),
    )
    .slice(0, 48);
}
export function generatePlan(
  data: AcademicData,
  program: Program,
  record: RecordContext,
  prefs: Preferences,
  options = { beamWidth: 12, maxTerms: 16 },
): Plan {
  const { courses, campus, offerings } = data;
  const targetLoad =
    prefs.workload === "fastest"
      ? prefs.maxCredits
      : prefs.workload === "light"
        ? prefs.minCredits
        : Math.round((prefs.minCredits + prefs.maxCredits) / 2);
  type State = {
    terms: PlanTerm[];
    projected: StudentCourse[];
    score: number;
    utility: number;
    progress: number;
    complete: boolean;
  };
  let beam: State[] = [
    {
      terms: [],
      projected: [],
      score: 0,
      utility: 0,
      progress: 0,
      complete: false,
    },
  ];
  let best = beam[0];
  let term = prefs.start;
  let searched = 0;
  for (
    let depth = 0;
    depth < options.maxTerms;
    depth++, term = nextTerm(term, campus.calendar, prefs.includeSummer)
  ) {
    if (
      !prefs.includeSummer &&
      term.season === campus.calendar.optionalSeason
    ) {
      term = nextTerm(term, campus.calendar, false);
    }
    const expanded: State[] = [];
    for (const state of beam) {
      if (state.complete) {
        expanded.push(state);
        continue;
      }
      const prior = {
        ...record,
        courses: [
          ...recordBeforeTerm(record.courses, term, campus.calendar),
          ...state.projected,
        ],
      };
      const remaining = remainingCourseIds(
        program.requirements,
        prior.courses,
        courses,
      );
      const wanted = new Set(
        remaining.flatMap((id) => [
          id,
          ...missingPrerequisiteCourseIds(
            courses.find((c) => c.id === id)?.prerequisite ?? { type: "TRUE" },
            prior,
            courses,
          ),
        ]),
      );
      const candidates = courses
        .filter(
          (c) =>
            wanted.has(c.id) &&
            availability(c, term, offerings, data.offeringCoverage) !==
              "NOT_LISTED" &&
            !prefs.unavailable.includes(c.id) &&
            !prior.courses.some((r) => r.courseId === c.id) &&
            !record.courses.some(
              (r) => r.courseId === c.id && r.status === "IN_PROGRESS",
            ) &&
            c.minCredits === c.maxCredits &&
            !c.restrictions &&
            !c.overlaps.some((id) =>
              prior.courses.some((r) => r.courseId === id),
            ) &&
            ["VERIFIED", "PARSED"].includes(c.parseStatus) &&
            evaluatePrerequisite(
              c.prerequisite,
              { ...prior, concurrent: [...wanted] },
              courses,
            ).status === "SATISFIED",
        )
        .sort(
          (a, b) =>
            Number(remaining.includes(b.id)) -
              Number(remaining.includes(a.id)) ||
            getCoursesUnlockedBy(b.id, courses).length -
              getCoursesUnlockedBy(a.id, courses).length ||
            a.id.localeCompare(b.id),
        )
        .slice(0, 14);
      let batches = combinations(
        candidates,
        prefs.minCredits,
        prefs.maxCredits,
        targetLoad,
      );
      if (prefs.workload === "light") {
        const lighter = batches.filter(
          (b) => b.reduce((s, c) => s + c.maxCredits, 0) <= targetLoad,
        );
        if (lighter.length) batches = lighter;
      }
      if (!batches.length) batches.push([]);
      for (const batch of batches) {
        if (
          batch.some(
            (c) =>
              evaluatePrerequisite(
                c.prerequisite,
                { ...prior, concurrent: batch.map((c) => c.id) },
                courses,
              ).status !== "SATISFIED",
          )
        )
          continue;
        searched++;
        const projected = [
          ...state.projected,
          ...batch.map((c) => ({
            courseId: c.id,
            status: "COMPLETED" as const,
          })),
        ];
        const after = [
          ...prior.courses,
          ...batch.map((c) => ({
            courseId: c.id,
            status: "COMPLETED" as const,
          })),
        ];
        const audit = evaluateRequirement(program.requirements, after, courses);
        const credits = batch.reduce((s, c) => s + c.maxCredits, 0);
        const progress = requirementLeaves(program.requirements).reduce(
          (s, r) => {
            const a = evaluateRequirement(r, after, courses);
            return s + Math.min(1, a.earned / Math.max(a.needed, 1));
          },
          0,
        );
        const reasons = Object.fromEntries(
          batch.map((c) => [
            c.id,
            [
              remaining.includes(c.id)
                ? "Contributes to a remaining requirement."
                : "Prerequisite for a remaining requirement.",
              `Fits the ${prefs.minCredits}–${prefs.maxCredits} credit range.`,
              availability(c, term, offerings, data.offeringCoverage) ===
              "CONFIRMED"
                ? `Listed in official ${termLabel(term)} Course Offerings.`
                : "Future availability requires confirmation.",
              ...(getCoursesUnlockedBy(c.id, courses).length
                ? [
                    `Is referenced by ${getCoursesUnlockedBy(c.id, courses).length} later course prerequisite rules.`,
                  ]
                : []),
            ],
          ]),
        );
        const utility =
          state.utility +
          batch.reduce(
            (sum, c) =>
              sum +
              getCoursesUnlockedBy(c.id, courses).filter((id) => wanted.has(id))
                .length *
                SCORING.unlock,
            0,
          ) +
          batch.filter(
            (c) =>
              availability(c, term, offerings, data.offeringCoverage) ===
              "CONFIRMED",
          ).length *
            SCORING.confirmed -
          Math.abs(credits - targetLoad) * SCORING.loadDeviation -
          batch.filter(
            (c) =>
              availability(c, term, offerings, data.offeringCoverage) !==
              "CONFIRMED",
          ).length *
            SCORING.uncertainty;
        const score =
          progress * SCORING.progress +
          utility -
          (state.terms.length + 1) * SCORING.termCost[prefs.workload];
        expanded.push({
          terms: [
            ...state.terms,
            {
              term: { ...term },
              courseIds: batch.map((c) => c.id),
              credits,
              reasons,
            },
          ],
          projected,
          utility,
          score,
          progress,
          complete:
            audit.status === "COMPLETE" &&
            program.status === "VERIFIED" &&
            batch.length > 0 &&
            state.terms.every((t) => t.credits >= prefs.minCredits),
        });
      }
    }
    expanded.sort(
      (a, b) =>
        Number(b.complete) - Number(a.complete) ||
        b.score - a.score ||
        JSON.stringify(a.terms).localeCompare(JSON.stringify(b.terms)),
    );
    const unique = new Set<string>();
    beam = expanded
      .filter((s) => {
        const k = s.projected
          .map((c) => c.courseId)
          .sort()
          .join("|");
        if (unique.has(k)) return false;
        unique.add(k);
        return true;
      })
      .slice(0, options.beamWidth);
    if (!beam.length) break;
    if (
      beam[0].progress > best.progress ||
      beam[0].complete ||
      (beam[0].progress === best.progress && beam[0].score > best.score)
    )
      best = beam[0];
    if (beam[0].complete) break;
  }
  const warnings: string[] = [];
  if (!best.complete)
    warnings.push(
      "Partial plan: a complete degree path could not be verified within the bounded search. Missing data, grades, credit bounds, or manual rules may block progress.",
    );
  if (program.status !== "VERIFIED")
    warnings.push(
      "Program rules require review; graduation cannot be certified.",
    );
  if (
    best.terms.some((t) =>
      t.courseIds.some(
        (id) =>
          availability(
            courses.find((c) => c.id === id)!,
            t.term,
            offerings,
            data.offeringCoverage,
          ) === "UNKNOWN",
      ),
    )
  )
    warnings.push(
      "Some course offerings are unknown. Confirm availability before registration.",
    );
  if (record.courses.some((c) => c.status === "IN_PROGRESS"))
    warnings.push(
      "In-progress courses are assumed passed only after their recorded term; grade-dependent prerequisites remain blocked until grades are entered.",
    );
  const last = best.terms.at(-1)?.term;
  if (
    prefs.target &&
    (!best.complete ||
      (last && compareTerms(last, prefs.target, campus.calendar) > 0))
  )
    warnings.push(
      `Graduation by ${termLabel(prefs.target)} is not established by this plan.`,
    );
  return {
    id: prefs.workload,
    name:
      prefs.workload === "fastest"
        ? "Fastest"
        : prefs.workload === "light"
          ? "Light workload"
          : "Balanced",
    terms: best.terms,
    score: Math.round(best.score),
    complete: best.complete,
    warnings,
    estimatedGraduation: best.complete ? last : undefined,
    explanation: `Bounded beam search favors remaining requirements and prerequisite progress, with a ${targetLoad}-credit target. ${searched} candidate states evaluated. No guaranteed global optimum.`,
    searchStates: searched,
  };
}
export const generatePlans = (
  data: AcademicData,
  program: Program,
  record: RecordContext,
  prefs: Preferences,
) =>
  ["fastest", "balanced", "light"].map((workload) =>
    generatePlan(data, program, record, {
      ...prefs,
      workload: workload as Preferences["workload"],
    }),
  );
export function whatIf(
  plan: Plan,
  data: AcademicData,
  record: RecordContext,
  prefs: Preferences,
  change: { courseId: string; from: number; to?: number },
) {
  const terms = plan.terms.map((t) => ({ ...t, courseIds: [...t.courseIds] }));
  terms[change.from].courseIds = terms[change.from].courseIds.filter(
    (id) => id !== change.courseId,
  );
  if (change.to !== undefined) terms[change.to].courseIds.push(change.courseId);
  for (const t of terms)
    t.credits = t.courseIds.reduce(
      (s, id) => s + (data.courses.find((c) => c.id === id)?.maxCredits ?? 0),
      0,
    );
  const changed = {
    ...plan,
    terms,
    complete: false,
    estimatedGraduation: undefined,
  };
  return {
    plan: changed,
    violations: validatePlan(changed, data, record, prefs),
    affected: getCoursesUnlockedBy(change.courseId, data.courses),
  };
}
