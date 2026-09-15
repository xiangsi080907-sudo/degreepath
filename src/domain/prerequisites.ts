import { Course, RecordContext, Rule } from "./types";
export type Evaluation = {
  status: "SATISFIED" | "MISSING" | "UNKNOWN";
  reasons: string[];
};
export function evaluatePrerequisite(
  rule: Rule,
  record: RecordContext,
  catalog: Course[] = [],
): Evaluation {
  const completed = (id: string) =>
    record.courses.find((c) => c.courseId === id && c.status === "COMPLETED");
  const yes: Evaluation = { status: "SATISFIED", reasons: [] };
  const no = (
    reason: string,
    status: Evaluation["status"] = "MISSING",
  ): Evaluation => ({ status, reasons: [reason] });
  switch (rule.type) {
    case "TRUE":
      return yes;
    case "COURSE_COMPLETED":
      return completed(rule.course) ? yes : no(`Complete ${rule.course}`);
    case "CONCURRENT_ALLOWED":
      return completed(rule.course) || record.concurrent?.includes(rule.course)
        ? yes
        : no(`Complete or take ${rule.course} concurrently`);
    case "MIN_GRADE": {
      const c = completed(rule.course);
      return !c
        ? no(`Complete ${rule.course} with grade ≥ ${rule.grade}`)
        : c.grade === undefined
          ? no(
              `Grade for ${rule.course} is needed (minimum ${rule.grade})`,
              "UNKNOWN",
            )
          : c.grade >= rule.grade
            ? yes
            : no(`${rule.course} requires grade ≥ ${rule.grade}`);
    }
    case "PROGRAM_STATUS":
      return record.programs.includes(rule.program)
        ? yes
        : no(`Requires ${rule.program} program status`, "UNKNOWN");
    case "PERMISSION_REQUIRED":
    case "RAW_UNSUPPORTED":
      return no(rule.text, "UNKNOWN");
    case "MIN_CREDITS": {
      let credits = 0;
      let unknown = false;
      for (const c of record.courses.filter((c) => c.status === "COMPLETED")) {
        const course = catalog.find((x) => x.id === c.courseId);
        if (rule.subject && course?.subject !== rule.subject) continue;
        const n =
          c.credits ??
          (course?.minCredits === course?.maxCredits
            ? course?.minCredits
            : undefined);
        if (n === undefined) unknown = true;
        else credits += n;
      }
      return credits >= rule.credits
        ? yes
        : no(
            `Requires ${rule.credits} completed credits`,
            unknown ? "UNKNOWN" : "MISSING",
          );
    }
    case "AND":
    case "OR": {
      const e = rule.rules.map((r) => evaluatePrerequisite(r, record, catalog));
      if (rule.type === "AND") {
        if (e.every((r) => r.status === "SATISFIED")) return yes;
        return {
          status: e.some((r) => r.status === "MISSING") ? "MISSING" : "UNKNOWN",
          reasons: e.flatMap((r) => r.reasons),
        };
      }
      if (e.some((r) => r.status === "SATISFIED")) return yes;
      return {
        status: e.some((r) => r.status === "UNKNOWN") ? "UNKNOWN" : "MISSING",
        reasons: [
          `One alternative required: ${e.map((r) => r.reasons.join(" and ")).join(" OR ")}`,
        ],
      };
    }
  }
}
export function getMissingPrerequisites(
  course: Course,
  record: RecordContext,
  catalog: Course[] = [],
) {
  return evaluatePrerequisite(course.prerequisite, record, catalog);
}
export function referencedCourses(rule: Rule): string[] {
  if ("course" in rule) return [rule.course];
  if ("rules" in rule)
    return [...new Set(rule.rules.flatMap(referencedCourses))];
  return [];
}
export function ruleLabel(rule: Rule): string {
  if (rule.type === "TRUE") return "No required prerequisite listed";
  if ("rules" in rule)
    return `(${rule.rules.map(ruleLabel).join(rule.type === "AND" ? " AND " : " OR ")})`;
  if ("course" in rule)
    return (
      rule.course +
      (rule.type === "MIN_GRADE"
        ? ` ≥ ${rule.grade}`
        : rule.type === "CONCURRENT_ALLOWED"
          ? " (concurrent allowed)"
          : "")
    );
  if ("text" in rule) return rule.text;
  if (rule.type === "MIN_CREDITS") return `${rule.credits} credits`;
  return `Program: ${rule.program}`;
}

export function missingPrerequisiteCourseIds(
  rule: Rule,
  record: RecordContext,
  catalog: Course[],
  path = new Set<string>(),
): string[] {
  if (evaluatePrerequisite(rule, record, catalog).status === "SATISFIED")
    return [];
  if ("rules" in rule) {
    const branches = rule.rules.map((r) =>
      missingPrerequisiteCourseIds(r, record, catalog, path),
    );
    return rule.type === "AND"
      ? [...new Set(branches.flat())]
      : (branches
          .filter((b) => b.length)
          .sort(
            (a, b) =>
              a.reduce(
                (s, id) =>
                  s + (catalog.find((c) => c.id === id)?.maxCredits ?? 100),
                0,
              ) -
                b.reduce(
                  (s, id) =>
                    s + (catalog.find((c) => c.id === id)?.maxCredits ?? 100),
                  0,
                ) || a.join().localeCompare(b.join()),
          )[0] ?? []);
  }
  if ("course" in rule) {
    if (
      record.courses.some(
        (c) => c.courseId === rule.course && c.status === "COMPLETED",
      ) ||
      path.has(rule.course)
    )
      return [];
    const c = catalog.find((c) => c.id === rule.course);
    return [
      ...new Set([
        rule.course,
        ...(c
          ? missingPrerequisiteCourseIds(
              c.prerequisite,
              record,
              catalog,
              new Set([...path, rule.course]),
            )
          : []),
      ]),
    ];
  }
  return [];
}
