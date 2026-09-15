import {
  AcademicData,
  Calendar,
  Course,
  Offering,
  RecordContext,
  Term,
} from "./types";
import { compareTerms, recordBeforeTerm, termKey } from "./calendar";
import { evaluatePrerequisite } from "./prerequisites";
export function availability(
  course: Course,
  term: Term,
  offerings: Offering[],
  coverage: AcademicData["offeringCoverage"] = [],
) {
  const exact = offerings.find(
    (o) => o.courseId === course.id && termKey(o.term) === termKey(term),
  );
  if (exact) return exact.status;
  if (
    coverage.some(
      (x) => x.subject === course.subject && termKey(x.term) === termKey(term),
    )
  )
    return "NOT_LISTED" as const;
  return "UNKNOWN" as const;
}
export function getEligibleCourses(
  record: RecordContext,
  term: Term,
  courses: Course[],
  offerings: Offering[],
  calendar: Calendar,
  coverage: AcademicData["offeringCoverage"] = [],
) {
  const prior = {
    ...record,
    courses: recordBeforeTerm(record.courses, term, calendar),
  };
  return courses
    .filter(
      (c) =>
        !record.courses.some(
          (r) =>
            r.courseId === c.id &&
            (r.status === "COMPLETED" || r.status === "IN_PROGRESS"),
        ) &&
        availability(c, term, offerings, coverage) !== "NOT_LISTED" &&
        c.minCredits === c.maxCredits &&
        !c.restrictions &&
        ["VERIFIED", "PARSED"].includes(c.parseStatus) &&
        evaluatePrerequisite(c.prerequisite, prior, courses).status ===
          "SATISFIED",
    )
    .map((c) => ({
      course: c,
      availability: availability(c, term, offerings, coverage),
      conditional: record.courses.some(
        (r) =>
          r.status === "IN_PROGRESS" &&
          r.term &&
          compareTerms(r.term, term, calendar) < 0,
      ),
    }));
}
