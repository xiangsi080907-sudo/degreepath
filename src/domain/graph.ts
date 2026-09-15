import { Course, Rule } from "./types";
import { referencedCourses } from "./prerequisites";
export function getTransitivePrerequisites(
  id: string,
  courses: Course[],
): string[] {
  const seen = new Set<string>();
  const visit = (key: string) => {
    for (const dep of referencedCourses(
      courses.find((c) => c.id === key)?.prerequisite ?? { type: "TRUE" },
    )) {
      if (!seen.has(dep) && dep !== id) {
        seen.add(dep);
        visit(dep);
      }
    }
  };
  visit(id);
  return [...seen].sort();
}
export const getCoursesUnlockedBy = (id: string, courses: Course[]) =>
  courses
    .filter((c) => referencedCourses(c.prerequisite).includes(id))
    .map((c) => c.id)
    .sort();
export function detectPrerequisiteCycles(courses: Course[]): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack: string[] = [];
  const visit = (id: string) => {
    const i = stack.indexOf(id);
    if (i >= 0) {
      cycles.push([...stack.slice(i), id]);
      return;
    }
    if (visited.has(id)) return;
    stack.push(id);
    for (const p of referencedCourses(
      courses.find((c) => c.id === id)?.prerequisite ?? { type: "TRUE" },
    ))
      visit(p);
    stack.pop();
    visited.add(id);
  };
  courses.forEach((c) => visit(c.id));
  return cycles;
}
export function shortestDependencyChain(
  from: string,
  to: string,
  courses: Course[],
): string[] | null {
  const queue = [[from]];
  const seen = new Set([from]);
  while (queue.length) {
    const path = queue.shift()!;
    const last = path.at(-1)!;
    if (last === to) return path;
    for (const id of getCoursesUnlockedBy(last, courses))
      if (!seen.has(id)) {
        seen.add(id);
        queue.push([...path, id]);
      }
  }
  return null;
}
// Keep OR alternatives through AND unions so shared prerequisites are counted once.
// Bound pathological expressions; a truncated result is explicitly marked for review.
export function shortestPrerequisiteSet(
  id: string,
  completed: Set<string>,
  courses: Course[],
): { courses: string[]; review: boolean } {
  type Option = { courses: string[]; review: boolean };
  let truncated = false;
  const compact = (options: Option[]): Option[] => {
    const unique = new Map<string, Option>();
    for (const o of options) {
      o.courses = [...new Set(o.courses)].sort();
      const key = o.courses.join("|");
      const old = unique.get(key);
      if (!old || (old.review && !o.review)) unique.set(key, o);
    }
    const sorted = [...unique.values()].sort(
      (a, b) =>
        Number(a.review) - Number(b.review) ||
        a.courses.length - b.courses.length ||
        a.courses.join().localeCompare(b.courses.join()),
    );
    if (sorted.length > 128) truncated = true;
    return sorted.slice(0, 128);
  };
  const visit = (key: string, path: Set<string>): Option[] => {
    if (completed.has(key)) return [{ courses: [], review: false }];
    if (path.has(key)) return [{ courses: [key], review: true }];
    const c = courses.find((c) => c.id === key);
    if (!c) return [{ courses: [key], review: true }];
    return expand(c.prerequisite, new Set([...path, key])).map((o) => ({
      ...o,
      courses: [...o.courses, key],
    }));
  };
  const expand = (r: Rule, path: Set<string>): Option[] => {
    if (r.type === "TRUE") return [{ courses: [], review: false }];
    if ("course" in r)
      return visit(r.course, path).map((o) => ({
        ...o,
        review: o.review || r.type === "MIN_GRADE",
      }));
    if ("rules" in r) {
      if (r.type === "OR")
        return compact(r.rules.flatMap((rule) => expand(rule, path)));
      let combinations: Option[] = [{ courses: [], review: false }];
      for (const child of r.rules) {
        const branch = expand(child, path);
        combinations = compact(
          combinations.flatMap((a) =>
            branch.map((b) => ({
              courses: [...a.courses, ...b.courses],
              review: a.review || b.review,
            })),
          ),
        );
      }
      return combinations;
    }
    return [{ courses: [], review: true }];
  };
  const best = compact(visit(id, new Set()))[0] ?? {
    courses: [],
    review: true,
  };
  return {
    courses: best.courses.filter((c) => c !== id),
    review: best.review || truncated,
  };
}
