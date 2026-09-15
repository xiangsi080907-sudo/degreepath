import {
  AcademicData,
  Plan,
  PlanTerm,
  RecordContext,
  Preferences,
  Program,
  Term,
} from "../domain/types";
import { validatePlan } from "../domain/planner";
import { availability } from "../domain/eligibility";
export function prepareEditedPlan(
  base: Plan,
  terms: { term: Term; courseIds: string[] }[],
  data: AcademicData,
  record: RecordContext,
  prefs: Preferences,
  program: Program,
): Plan {
  const normalized: PlanTerm[] = terms.map((t) => ({
    term: t.term,
    courseIds: t.courseIds,
    credits: t.courseIds.reduce(
      (s, id) => s + (data.courses.find((c) => c.id === id)?.maxCredits ?? 0),
      0,
    ),
    reasons: Object.fromEntries(
      t.courseIds.map((id) => {
        const c = data.courses.find((c) => c.id === id);
        return [
          id,
          [
            "Placed here in your what-if plan.",
            c &&
            availability(c, t.term, data.offerings, data.offeringCoverage) ===
              "CONFIRMED"
              ? "Listed in official offerings for this term."
              : "Offering availability must be confirmed.",
          ],
        ];
      }),
    ),
  }));
  const issues = validatePlan({ terms: normalized }, data, record, prefs);
  if (issues.some((v) => v.severity === "ERROR"))
    throw Error(
      `Repair plan before saving: ${issues
        .filter((v) => v.severity === "ERROR")
        .map((v) => `${v.courseId ?? ""}: ${v.message}`)
        .join("; ")}`,
    );
  return {
    ...base,
    terms: normalized,
    score: 0,
    complete: false,
    estimatedGraduation: undefined,
    warnings: [
      ...new Set(issues.map((i) => i.message)),
      "Edited course plan: degree completion and graduation date require re-evaluation.",
      ...(program.status === "VERIFIED"
        ? []
        : ["Program requirements need manual review."]),
    ],
    explanation:
      "User-edited plan. Course order and credit limits validated on the server. No optimizer score is assigned to edits.",
  };
}
