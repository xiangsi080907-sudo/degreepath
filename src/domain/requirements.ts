import { Course, Requirement, StudentCourse } from "./types";
export type Audit = {
  id: string;
  title: string;
  status: "COMPLETE" | "PARTIAL" | "REMAINING" | "REVIEW";
  earned: number;
  needed: number;
  used: string[];
  children: Audit[];
  warnings: string[];
};
export function courseCredits(record: StudentCourse, courses: Course[]) {
  const c = courses.find((c) => c.id === record.courseId);
  return (
    record.credits ?? (c && c.minCredits === c.maxCredits ? c.minCredits : 0)
  );
}
export function evaluateRequirement(
  rule: Requirement,
  record: StudentCourse[],
  courses: Course[],
  reserved = new Set<string>(),
): Audit {
  const base: Audit = {
    id: rule.id,
    title: rule.title,
    status: "REMAINING",
    earned: 0,
    needed: rule.minCredits ?? rule.chooseCount ?? 1,
    used: [],
    children: [],
    warnings: [],
  };
  if (
    rule.type === "MANUAL_REVIEW" ||
    ["NEEDS_REVIEW", "UNSUPPORTED"].includes(rule.parseStatus)
  )
    return { ...base, status: "REVIEW", warnings: [rule.rawText] };
  const independent =
    rule.allowDoubleCount === true ||
    ["MINIMUM_TOTAL_CREDITS", "MINIMUM_UPPER_DIVISION_CREDITS"].includes(
      rule.type,
    );
  const available = record.filter(
    (c) =>
      c.status === "COMPLETED" && (independent || !reserved.has(c.courseId)),
  );
  if (rule.children?.length) {
    const used = new Set(reserved);
    const children: Audit[] = [];
    // Alternative groups evaluate independently; ALL_OF consumes allocations unless explicitly shared.
    for (const child of rule.children) {
      const result = evaluateRequirement(
        child,
        record,
        courses,
        rule.type === "ALL_OF" && !rule.allowDoubleCount ? used : reserved,
      );
      children.push(result);
      if (rule.type === "ALL_OF" && !rule.allowDoubleCount)
        result.used.forEach((id) => used.add(id));
    }
    const n =
      rule.type === "ANY_OF"
        ? 1
        : rule.type === "CHOOSE_N"
          ? (rule.chooseCount ?? 1)
          : children.length;
    const selected =
      rule.type === "ALL_OF"
        ? children
        : [...children]
            .sort(
              (a, b) =>
                Number(b.status === "COMPLETE") -
                  Number(a.status === "COMPLETE") || b.earned - a.earned,
            )
            .slice(0, n);
    // Overlapping alternative allocations are not silently counted twice.
    const ids = selected.flatMap((c) => c.used);
    const overlap =
      !rule.allowDoubleCount &&
      rule.type === "CHOOSE_N" &&
      new Set(ids).size !== ids.length;
    const earned = selected.filter((c) => c.status === "COMPLETE").length;
    return {
      ...base,
      children,
      earned,
      needed: n,
      used: [...new Set(ids)],
      status: overlap
        ? "REVIEW"
        : earned >= n
          ? "COMPLETE"
          : selected.some((c) => c.status === "REVIEW")
            ? "REVIEW"
            : selected.some((c) => c.earned > 0)
              ? "PARTIAL"
              : "REMAINING",
      warnings: overlap
        ? ["Overlapping choices need an explicit course allocation"]
        : selected.flatMap((c) => c.warnings),
    };
  }
  let matching = available.filter((r) => {
    const c = courses.find((c) => c.id === r.courseId);
    if (!c) return false;
    if (rule.courseIds && !rule.courseIds.includes(c.id)) return false;
    if (rule.subject && c.subject !== rule.subject) return false;
    if (rule.attribute && !c.attributes.includes(rule.attribute)) return false;
    if (rule.level && Number(c.number) < rule.level) return false;
    if (
      rule.type === "MINIMUM_UPPER_DIVISION_CREDITS" &&
      Number(c.number) < 300
    )
      return false;
    return true;
  });
  const missingGrade = matching.some(
    (c) => rule.minGrade !== undefined && c.grade === undefined,
  );
  if (rule.minGrade !== undefined)
    matching = matching.filter(
      (c) => c.grade !== undefined && c.grade >= rule.minGrade!,
    );
  const countMode = ["COURSE", "COURSE_LIST", "CHOOSE_N", "ANY_OF"].includes(
    rule.type,
  );
  const needed = countMode
    ? rule.type === "COURSE_LIST"
      ? (rule.courseIds?.length ?? 1)
      : (rule.chooseCount ?? 1)
    : (rule.minCredits ?? 0);
  let earned = 0;
  const used: string[] = [];
  for (const r of matching) {
    if (earned >= needed) break;
    used.push(r.courseId);
    earned += countMode ? 1 : courseCredits(r, courses);
  }
  return {
    ...base,
    earned,
    needed,
    used,
    status:
      earned >= needed
        ? "COMPLETE"
        : missingGrade
          ? "REVIEW"
          : earned > 0
            ? "PARTIAL"
            : "REMAINING",
    warnings: missingGrade
      ? ["Enter grades to verify the minimum-grade rule"]
      : [],
  };
}
export function requirementCourseIds(rule: Requirement): string[] {
  return [
    ...new Set([
      ...(rule.courseIds ?? []),
      ...(rule.children ?? []).flatMap(requirementCourseIds),
    ]),
  ];
}
export function requirementLeaves(rule: Requirement): Requirement[] {
  return rule.children?.length
    ? rule.children.flatMap(requirementLeaves)
    : [rule];
}
export function remainingCourseIds(
  rule: Requirement,
  record: StudentCourse[],
  courses: Course[],
): string[] {
  if (
    evaluateRequirement(rule, record, courses).status === "COMPLETE" ||
    rule.type === "MANUAL_REVIEW"
  )
    return [];
  if (rule.children?.length) {
    const branches = rule.children.map((child) => ({
      child,
      ids: remainingCourseIds(child, record, courses),
    }));
    if (rule.type === "ANY_OF" || rule.type === "CHOOSE_N") {
      const done = branches.filter(
        (b) =>
          evaluateRequirement(b.child, record, courses).status === "COMPLETE",
      ).length;
      const count = Math.max(
        0,
        (rule.type === "ANY_OF" ? 1 : (rule.chooseCount ?? 1)) - done,
      );
      const choices = branches
        .filter(
          (b) =>
            evaluateRequirement(b.child, record, courses).status !== "COMPLETE",
        )
        .sort(
          (a, b) =>
            a.ids.reduce(
              (s, id) =>
                s + (courses.find((c) => c.id === id)?.maxCredits ?? 100),
              0,
            ) -
              b.ids.reduce(
                (s, id) =>
                  s + (courses.find((c) => c.id === id)?.maxCredits ?? 100),
                0,
              ) || a.child.id.localeCompare(b.child.id),
        );
      return [...new Set(choices.slice(0, count).flatMap((b) => b.ids))];
    }
    return [...new Set(branches.flatMap((b) => b.ids))];
  }
  return (
    rule.courseIds ??
    courses
      .filter(
        (c) =>
          (!rule.subject || c.subject === rule.subject) &&
          (!rule.level || Number(c.number) >= rule.level) &&
          (!rule.attribute || c.attributes.includes(rule.attribute)) &&
          !!(rule.subject || rule.attribute),
      )
      .map((c) => c.id)
  ).filter(
    (id) => !record.some((c) => c.courseId === id && c.status === "COMPLETED"),
  );
}
